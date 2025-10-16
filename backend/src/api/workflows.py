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
                project_id=request.project_id,
            )
            logger.info(f"Generation saved to database with project_id: {request.project_id}")

            # Update project status if project_id provided
            if request.project_id:
                try:
                    supabase.update_project_generation_status(
                        project_id=request.project_id, status="generating", increment_count=False
                    )
                    logger.info(f"Project status updated to 'generating'")
                except Exception as e:
                    logger.warning(f"Failed to update project status: {e}")
        except DatabaseError as e:
            logger.error(f"Failed to save generation: {e}", exc_info=True)
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


@router.get("/workflows/stream/{session_id}")
async def stream_workflow_progress(session_id: str):
    """
    Stream workflow progress via SSE.
    Note: EventSource doesn't support auth headers, so we validate session existence only.
    Security: Session IDs are cryptographically random UUIDs (unguessable).
    """
    if session_id not in active_sessions:
        # Check if session exists in database
        try:
            generation = supabase.get_generation(session_id)
            if not generation:
                raise HTTPException(status_code=404, detail="Session not found")
        except DatabaseError:
            raise HTTPException(status_code=500, detail="Database error")

        # Session completed, return empty stream
        async def completed_generator():
            yield {
                "event": "complete",
                "data": json.dumps(
                    {"status": generation["status"], "message": "Workflow already completed"}
                ),
            }

        return EventSourceResponse(completed_generator())

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


@router.get("/generations/{session_id}")
async def get_generation(session_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Get complete generation details including files from S3.
    Used for page refresh/reload to restore state.
    """
    try:
        generation = supabase.get_generation(session_id)
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")

        if generation["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        from src.agentcore.tools.github_analyzer import parse_github_url

        owner, repo = parse_github_url(generation["repository_url"])

        from src.services.s3_storage import get_s3_storage

        s3_storage = get_s3_storage()

        # Get all files for this repository (latest versions)
        files = await s3_storage.get_repository_files(owner, repo)

        # Get download URLs
        s3_keys = generation.get("s3_keys", [])
        download_urls = {}
        if s3_keys:
            download_urls = await s3_storage.get_download_urls(s3_keys)

        return {
            "session_id": session_id,
            "repository_url": generation["repository_url"],
            "template_type": generation["template_type"],
            "status": generation["status"],
            "project_context": generation.get("project_context"),
            "files": files,
            "download_urls": download_urls,
            "s3_keys": s3_keys,
            "error": generation.get("error"),
            "created_at": generation["created_at"],
            "updated_at": generation["updated_at"],
        }

    except HTTPException:
        raise
    except DatabaseError:
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Failed to get generation: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve generation")


@router.get("/user/generations")
async def list_user_generations(user_id: str = Depends(get_current_user_id)):
    """
    List all generations for the current user.
    Shows generation history.
    """
    try:
        generations = supabase.get_user_generations(user_id, limit=50)
        return {"generations": generations}
    except DatabaseError:
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Failed to list generations: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list generations")


@router.get("/workflows/generation/by-project/{project_id}")
async def get_generation_by_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    """
    Get the latest generation for a project.
    Used to restore state on page refresh.
    """
    try:
        # Get project to verify ownership and get repository_url
        from src.services.supabase import supabase

        with supabase.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT repository_url FROM projects
                    WHERE id = %s AND user_id = %s
                    """,
                    (project_id, user_id),
                )
                project = cur.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get latest generation for this project
        generation = supabase.get_generation_by_repository(
            user_id=user_id, repository_url=project["repository_url"]
        )

        if not generation:
            return None

        # If completed, fetch files from S3
        if generation["status"] == "completed":
            from src.agentcore.tools.github_analyzer import parse_github_url

            owner, repo = parse_github_url(generation["repository_url"])

            from src.services.s3_storage import get_s3_storage

            s3_storage = get_s3_storage()

            files = await s3_storage.get_repository_files(owner, repo)

            s3_keys = generation.get("s3_keys", [])
            download_urls = {}
            if s3_keys:
                download_urls = await s3_storage.get_download_urls(s3_keys)

            return {
                "id": generation["id"],
                "session_id": generation["session_id"],
                "repository_url": generation["repository_url"],
                "template_type": generation["template_type"],
                "status": generation["status"],
                "project_context": generation.get("project_context"),
                "files": files,
                "download_urls": download_urls,
                "s3_keys": s3_keys,
                "error": generation.get("error"),
                "pr_number": generation.get("pr_number"),
                "pr_url": generation.get("pr_url"),
                "pr_branch": generation.get("pr_branch"),
                "created_at": generation["created_at"],
                "updated_at": generation["updated_at"],
            }

        return {
            "id": generation["id"],
            "session_id": generation["session_id"],
            "status": generation["status"],
            "error": generation.get("error"),
            "pr_number": generation.get("pr_number"),
            "pr_url": generation.get("pr_url"),
            "pr_branch": generation.get("pr_branch"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get generation by project: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve generation")


@router.get("/debug/generation/{session_id}")
async def debug_generation(session_id: str):
    """
    Debug endpoint to check if generation exists in database (no auth for testing).
    Remove in production!
    """
    try:
        generation = supabase.get_generation(session_id)
        if not generation:
            return {"found": False, "session_id": session_id}

        return {
            "found": True,
            "session_id": generation.get("session_id"),
            "status": generation.get("status"),
            "repository_url": generation.get("repository_url"),
            "created_at": generation.get("created_at"),
            "updated_at": generation.get("updated_at"),
            "has_s3_keys": bool(generation.get("s3_keys")),
            "has_context": bool(generation.get("project_context")),
        }
    except Exception as e:
        logger.error(f"Debug check failed: {e}", exc_info=True)
        return {"error": str(e)}


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
        installation_id=getattr(request, "installation_id", 0),
        template_type=request.template_type,
        project_id=request.project_id,
        session=session,
    )
