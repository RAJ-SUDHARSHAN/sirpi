from fastapi import APIRouter, HTTPException, Depends
from sse_starlette.sse import EventSourceResponse
import logging
import json
import asyncio
from datetime import datetime
from typing import AsyncGenerator, Dict, Any
import uuid

from src.models import (
    WorkflowStartRequest,
    WorkflowStartResponse,
    WorkflowStatusResponse,
    WorkflowStatus,
)
from src.core.config import settings
from src.services.supabase import supabase, DatabaseError
from src.utils.clerk_auth import get_current_user_id

router = APIRouter()
logger = logging.getLogger(__name__)

active_sessions: Dict[str, Dict[str, Any]] = {}


def generate_session_id() -> str:
    return f"sess_{uuid.uuid4().hex[:12]}"


@router.post("/workflows/start", response_model=WorkflowStartResponse)
async def start_workflow(
    request: WorkflowStartRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        logger.info(f"Workflow start request: {request.dict()}")
        session_id = generate_session_id()

        try:
            supabase.save_generation(
                user_id=user_id,
                session_id=session_id,
                repository_url=str(request.repository_url),
                template_type=request.template_type,
                status=WorkflowStatus.STARTED.value,
                project_context=getattr(request, "project_context", None),
            )
        except DatabaseError:
            raise HTTPException(status_code=500, detail="Failed to initialize workflow")

        active_sessions[session_id] = {
            "user_id": user_id,
            "status": WorkflowStatus.STARTED,
            "repository_url": str(request.repository_url),
            "template_type": request.template_type,
            "created_at": datetime.utcnow(),
            "logs": [],
            "files": [],
        }

        asyncio.create_task(execute_agentcore_workflow(session_id, request, user_id))

        return WorkflowStartResponse(
            session_id=session_id,
            status=WorkflowStatus.STARTED,
            message="Workflow started successfully",
            stream_url=f"{settings.api_v1_prefix}/workflows/stream/{session_id}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workflow start error: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start workflow")


@router.post("/workflows/test-start", response_model=WorkflowStartResponse)
async def test_start_workflow(request: WorkflowStartRequest):
    """
    Test endpoint without authentication for local development.
    Remove in production!
    """
    test_user_id = "test_user_123"
    
    try:
        session_id = generate_session_id()

        active_sessions[session_id] = {
            "user_id": test_user_id,
            "status": WorkflowStatus.STARTED,
            "repository_url": str(request.repository_url),
            "template_type": request.template_type,
            "created_at": datetime.utcnow(),
            "logs": [],
            "files": [],
        }

        asyncio.create_task(execute_agentcore_workflow(session_id, request, test_user_id))

        return WorkflowStartResponse(
            session_id=session_id,
            status=WorkflowStatus.STARTED,
            message="Workflow started successfully",
            stream_url=f"{settings.api_v1_prefix}/workflows/stream/{session_id}",
        )

    except Exception as e:
        logger.error(f"Workflow start error: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start workflow")


@router.get("/workflows/stream/{session_id}")
async def stream_workflow_progress(session_id: str, user_id: str = Depends(get_current_user_id)):
    if session_id not in active_sessions:
        try:
            generation = supabase.get_generation(session_id)
            if not generation or generation["user_id"] != user_id:
                raise HTTPException(status_code=404, detail="Session not found")
        except DatabaseError:
            raise HTTPException(status_code=500, detail="Database error")

    session = active_sessions.get(session_id, {})
    if not session or session.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Ensure session has status, default to STARTED if missing
    if "status" not in session:
        session["status"] = WorkflowStatus.STARTED

    # Create a local reference for the event generator
    current_session = session

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield {
                "event": "status",
                "data": json.dumps(
                    {
                        "status": (
                            current_session["status"].value
                            if hasattr(current_session["status"], "value")
                            else current_session["status"]
                        ),
                        "message": "Connected to workflow stream",
                    }
                ),
            }

            last_log_index = 0
            while session_id in active_sessions:
                session = active_sessions[session_id]

                logs = session.get("logs", [])
                if len(logs) > last_log_index:
                    for log in logs[last_log_index:]:
                        yield {
                            "event": "log",
                            "data": json.dumps(
                                {
                                    "timestamp": log["timestamp"].isoformat(),
                                    "agent": log["agent"],
                                    "message": log["message"],
                                    "level": log.get("level", "INFO"),
                                }
                            ),
                        }
                    last_log_index = len(logs)

                status = session["status"]
                if isinstance(status, WorkflowStatus):
                    status = status.value

                if status in [WorkflowStatus.COMPLETED.value, WorkflowStatus.FAILED.value]:
                    yield {
                        "event": "complete",
                        "data": json.dumps(
                            {
                                "status": status,
                                "files": session.get("files", []),
                                "error": session.get("error"),
                            }
                        ),
                    }
                    break

                await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Stream error: {type(e).__name__}", exc_info=True)
            yield {"event": "error", "data": json.dumps({"error": "Stream error occurred"})}

    return EventSourceResponse(event_generator())


@router.get("/workflows/test-stream/{session_id}")
async def test_stream_workflow_progress(session_id: str):
    """
    Test SSE stream without authentication.
    Remove in production!
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions.get(session_id, {})
    if "status" not in session:
        session["status"] = WorkflowStatus.STARTED

    current_session = session

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield {
                "event": "status",
                "data": json.dumps(
                    {
                        "status": (
                            current_session["status"].value
                            if hasattr(current_session["status"], "value")
                            else current_session["status"]
                        ),
                        "message": "Connected to workflow stream",
                    }
                ),
            }

            last_log_index = 0
            while session_id in active_sessions:
                session = active_sessions[session_id]

                logs = session.get("logs", [])
                if len(logs) > last_log_index:
                    for log in logs[last_log_index:]:
                        yield {
                            "event": "log",
                            "data": json.dumps(
                                {
                                    "timestamp": log["timestamp"].isoformat(),
                                    "agent": log["agent"],
                                    "message": log["message"],
                                    "level": log.get("level", "INFO"),
                                }
                            ),
                        }
                    last_log_index = len(logs)

                status = session["status"]
                if isinstance(status, WorkflowStatus):
                    status = status.value

                if status in [WorkflowStatus.COMPLETED.value, WorkflowStatus.FAILED.value]:
                    yield {
                        "event": "complete",
                        "data": json.dumps(
                            {
                                "status": status,
                                "files": session.get("files", []),
                                "error": session.get("error"),
                            }
                        ),
                    }
                    break

                await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Stream error: {type(e).__name__}", exc_info=True)
            yield {"event": "error", "data": json.dumps({"error": "Stream error occurred"})}

    return EventSourceResponse(event_generator())


@router.get("/workflows/status/{session_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(session_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if session_id in active_sessions:
            session = active_sessions[session_id]
            if session.get("user_id") != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            return WorkflowStatusResponse(
                session_id=session_id,
                status=session["status"],
                current_step=session.get("current_step"),
                progress=session.get("progress", 0),
                files=session.get("files", []),
                error=session.get("error"),
                created_at=session["created_at"],
                updated_at=session.get("updated_at", session["created_at"]),
            )

        generation = supabase.get_generation(session_id)
        if not generation:
            raise HTTPException(status_code=404, detail="Session not found")

        if generation["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return WorkflowStatusResponse(
            session_id=session_id,
            status=WorkflowStatus(generation["status"]),
            files=generation.get("files", []),
            error=generation.get("error"),
            created_at=generation["created_at"],
            updated_at=generation["updated_at"],
        )

    except HTTPException:
        raise
    except DatabaseError:
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Status fetch error: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")


async def execute_agentcore_workflow(session_id: str, request: WorkflowStartRequest, user_id: str):
    from src.agentcore.orchestrator import WorkflowOrchestrator
    
    if session_id not in active_sessions:
        logger.error(f"Session {session_id} not found")
        return
    
    session = active_sessions[session_id]
    orchestrator = WorkflowOrchestrator()
    
    await orchestrator.execute(
        session_id=session_id,
        repository_url=str(request.repository_url),
        installation_id=getattr(request, 'installation_id', 0),
        template_type=request.template_type,
        session=session
    )
