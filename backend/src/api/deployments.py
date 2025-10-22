"""
Deployment API - Handles deployment streaming and cross-account deployment triggers.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sse_starlette.sse import EventSourceResponse
import logging
import json
import asyncio
from typing import AsyncGenerator, Dict, Any
import uuid

from src.models.schemas import (
    DeploymentStartRequest,
    DeploymentStartResponse,
    DeploymentStatusResponse,
)
from src.core.config import settings
from src.services.supabase import supabase, DatabaseError
from src.services.deployment import get_deployment_service, DeploymentError
from src.services.docker_build import get_docker_build_service
from src.utils.clerk_auth import get_current_user_id

router = APIRouter()
logger = logging.getLogger(__name__)

# Active deployment sessions for streaming logs
active_deployment_sessions: Dict[str, Dict[str, Any]] = {}


def generate_deployment_session_id() -> str:
    return f"deploy_{uuid.uuid4().hex[:12]}"


@router.post("/deployment/projects/{project_id}/{operation}")
async def trigger_project_deployment(
    project_id: str,
    operation: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    """
    Trigger deployment operation for a specific project.
    Operations: build_image, plan, apply, destroy
    """
    try:
        logger.info(f"Deployment {operation} requested for project {project_id}")
        
        # Get project details
        project = supabase.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify ownership
        if project["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get AWS connection
        aws_connection_id = project.get("aws_connection_id")
        if not aws_connection_id:
            raise HTTPException(
                status_code=400, 
                detail="No AWS connection configured for this project"
            )
        
        aws_connection = supabase.get_aws_connection_by_id(aws_connection_id)
        if not aws_connection:
            raise HTTPException(
                status_code=400, 
                detail="AWS connection not found"
            )
        
        role_arn = project.get("aws_role_arn")
        external_id = aws_connection.get("external_id")
        
        if not role_arn:
            raise HTTPException(
                status_code=400, 
                detail="No AWS role ARN configured for this project"
            )

        # Create deployment session
        session_id = generate_deployment_session_id()
        
        active_deployment_sessions[session_id] = {
            "user_id": user_id,
            "project_id": project_id,
            "status": "starting",
            "operation": operation,
            "created_at": asyncio.get_event_loop().time(),
            "logs": [],  # Will be populated in real-time by deployment service
        }

        # Start operation in background based on type
        if operation == "build_image":
            # Docker build doesn't need pre-fetched ECR URL
            # The build service will create ECR in user's account dynamically
            task = asyncio.create_task(
                execute_docker_build(
                    session_id,
                    project_id,
                    project["repository_url"],
                    role_arn,
                    external_id,
                )
            )
        else:
            # Existing terraform operations
            task = asyncio.create_task(
                execute_project_deployment(
                    session_id,
                    project_id,
                    operation,
                    user_id,
                    role_arn,
                    external_id
                )
            )
        
        # Add error handler to prevent unhandled exceptions
        task.add_done_callback(lambda t: None if t.exception() is None else logger.error(f"Background task error: {t.exception()}"))

        # Return immediately without waiting
        return {
            "success": True,
            "data": {
                "operation_id": session_id,
                "status": "starting",
                "stream_url": f"{settings.api_v1_prefix}/deployment/operations/{session_id}/stream"
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start deployment: {str(e)}")


@router.get("/deployment/operations/{operation_id}/status")
async def get_deployment_operation_status(
    operation_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get status of a deployment operation.
    Allows reconnecting to ongoing operations.
    """
    if operation_id not in active_deployment_sessions:
        return {
            "success": False,
            "error": "Operation not found or expired",
            "data": {
                "status": "expired",
                "operation_id": operation_id,
            }
        }
    
    session = active_deployment_sessions[operation_id]
    
    # Verify ownership
    if session.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "success": True,
        "data": {
            "operation_id": operation_id,
            "status": session["status"],
            "operation": session.get("operation"),
            "project_id": session.get("project_id"),
            "created_at": session.get("created_at"),
            "completed_at": session.get("completed_at"),
            "error": session.get("error"),
            "log_count": len(session.get("logs", [])),
            "stream_url": f"{settings.api_v1_prefix}/deployment/operations/{operation_id}/stream"
        }
    }


@router.get("/deployment/operations/{operation_id}/logs")
async def get_deployment_operation_logs(
    operation_id: str,
    since_index: int = 0,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get deployment logs since a specific index (for polling).
    Returns logs from since_index onwards.
    """
    if operation_id not in active_deployment_sessions:
        return {
            "success": False,
            "error": "Operation not found or expired"
        }
    
    session = active_deployment_sessions[operation_id]
    
    # Verify ownership
    if session.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = session.get("logs", [])
    new_logs = logs[since_index:] if since_index < len(logs) else []
    
    return {
        "success": True,
        "data": {
            "operation_id": operation_id,
            "status": session["status"],
            "logs": new_logs,
            "total_logs": len(logs),
            "next_index": len(logs),
            "completed": session["status"] in ["completed", "failed"],
            "error": session.get("error")
        }
    }


@router.get("/deployment/operations/{operation_id}/stream")
async def stream_project_deployment_logs(operation_id: str):
    """
    Stream deployment logs for project operations via Server-Sent Events.
    """
    if operation_id not in active_deployment_sessions:
        raise HTTPException(status_code=404, detail="Deployment session not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events for deployment logs."""
        try:
            # Send initial connection message
            yield {
                "event": "connected",
                "data": json.dumps({
                    "type": "connected",
                    "message": "🔗 Connected to deployment stream"
                })
            }

            last_log_index = 0
            
            while operation_id in active_deployment_sessions:
                session = active_deployment_sessions[operation_id]
                
                # Send any NEW logs (track index, don't clear)
                logs = session.get("logs", [])
                if len(logs) > last_log_index:
                    for log_entry in logs[last_log_index:]:
                        yield {
                            "event": "log",
                            "data": json.dumps({
                                "type": "terraform_output",
                                "message": log_entry
                            })
                        }
                    last_log_index = len(logs)  # Update index, DON'T clear logs

                # Check if deployment is finished
                status = session.get("status")
                if status in ["completed", "failed"]:
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "type": "deployment_complete",
                            "status": status,
                            "error": session.get("error")
                        })
                    }
                    break

                await asyncio.sleep(0.05)  # Poll every 50ms for real-time feel

        except asyncio.CancelledError:
            logger.info(f"Deployment stream cancelled for {operation_id}")
        except Exception as e:
            logger.error(f"Error in deployment stream: {e}", exc_info=True)
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "message": f"Stream error: {str(e)}"
                })
            }

    return EventSourceResponse(event_generator())


@router.get("/deployment/projects/{project_id}/logs")
async def get_project_deployment_logs(
    project_id: str,
    operation_type: str = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get deployment logs for a project.
    Optionally filter by operation_type (build_image, plan, apply, destroy).
    """
    try:
        # Verify project ownership
        project = supabase.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if project["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get logs
        logs = supabase.get_deployment_logs(project_id, operation_type, limit=10)
        
        return {
            "success": True,
            "data": {
                "logs": logs,
                "count": len(logs)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting deployment logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get deployment logs")


@router.get("/deployment/projects/{project_id}/status")
async def get_project_deployment_status(
    project_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get deployment status for a specific project.
    """
    try:
        # Verify project ownership
        project = supabase.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if project["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if there's an active deployment session for this project
        for session_id, session in active_deployment_sessions.items():
            if session.get("project_id") == project_id:
                return {
                    "success": True,
                    "data": {
                        "status": session["status"],
                        "session_id": session_id,
                        "operation": session.get("operation"),
                    },
                }

        # No active deployment
        return {
            "success": True,
            "data": {
                "status": project.get("deployment_status", "not_started"),
                "session_id": None,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting deployment status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get deployment status")


async def execute_docker_build(
    session_id: str,
    project_id: str,
    repository_url: str,
    role_arn: str,
    external_id: str,
):
    """
    Execute Docker image build and push to ECR in user's account.
    """
    try:
        session = active_deployment_sessions[session_id]
        session["status"] = "running"
        
        logger.info(f"Starting Docker build for project {project_id}")

        # Get Docker build service
        docker_service = get_docker_build_service()

        # Build and push image
        result = await docker_service.build_and_push_image(
            session_id=session_id,
            project_id=project_id,
            repository_url=repository_url,
            role_arn=role_arn,
            external_id=external_id,
            ecr_repository_url="",  # Will be constructed dynamically from user's account
        )

        # Update session with final result
        session.update({
            "status": "completed" if result["success"] else "failed",
            "result": result,
            "error": result.get("error"),
            "completed_at": asyncio.get_event_loop().time(),
        })
        
        # Save logs to database for persistence
        try:
            duration = int(session["completed_at"] - session["created_at"])
            supabase.save_deployment_logs(
                project_id=project_id,
                operation_type="build_image",
                logs=session.get("logs", []),
                status="success" if result["success"] else "error",
                duration_seconds=duration,
                error_message=result.get("error") if not result["success"] else None,
            )
            logger.info(f"Saved Docker build logs to database")
        except Exception as log_error:
            logger.warning(f"Failed to save Docker build logs: {log_error}")
        
        if result["success"]:
            logger.info(f"Docker build completed successfully for project {project_id}")
        else:
            logger.error(f"Docker build failed for project {project_id}: {result.get('error')}")

    except Exception as e:
        logger.error(f"Docker build execution failed: {e}", exc_info=True)

        if session_id in active_deployment_sessions:
            active_deployment_sessions[session_id].update({
                "status": "failed",
                "error": str(e),
                "completed_at": asyncio.get_event_loop().time(),
            })
    
    finally:
        # Cleanup old sessions after some time (keep for 5 minutes for retrieval)
        asyncio.create_task(cleanup_session_after_delay(session_id, delay=300))


async def execute_project_deployment(
    session_id: str,
    project_id: str,
    operation: str,
    user_id: str,
    role_arn: str,
    external_id: str
):
    """
    Execute deployment operation for a specific project.
    Operations: plan, apply, destroy
    """
    try:
        session = active_deployment_sessions[session_id]
        session["status"] = "running"
        
        logger.info(f"Starting {operation} for project {project_id}")
        logger.info(f"Role ARN: {role_arn}")
        logger.info(f"External ID: {external_id}")

        # Get deployment service
        deployment_service = get_deployment_service()

        # Execute deployment based on operation
        if operation == "plan":
            result = await deployment_service.plan_infrastructure(
                session_id=session_id,
                project_id=project_id,
                log_stream=None,  # We use active_deployment_sessions instead
                role_arn=role_arn,
                external_id=external_id,
            )
        elif operation == "apply":
            result = await deployment_service.deploy_infrastructure(
                session_id=session_id,
                project_id=project_id,
                log_stream=None,
                role_arn=role_arn,
                external_id=external_id,
            )
        elif operation == "destroy":
            result = await deployment_service.destroy_infrastructure(
                session_id=session_id,
                project_id=project_id,
                log_stream=None,
                role_arn=role_arn,
                external_id=external_id,
            )
        else:
            raise ValueError(f"Unsupported operation: {operation}")

        # Update session with final result
        session.update({
            "status": "completed" if result.success else "failed",
            "result": result,
            "error": result.error,
            "completed_at": asyncio.get_event_loop().time(),
        })
        
        # Save terraform outputs to database if deployment succeeded
        if result.success and result.outputs:
            try:
                logger.info(f"Saving terraform outputs: {list(result.outputs.keys())}")
                # Extract clean output values (terraform outputs have 'value' field)
                clean_outputs = {
                    key: output.get('value') if isinstance(output, dict) else output
                    for key, output in result.outputs.items()
                }
                supabase.save_terraform_outputs(
                    project_id=project_id,
                    outputs=clean_outputs
                )
                logger.info("Terraform outputs saved to database")
            except Exception as output_error:
                logger.warning(f"Failed to save terraform outputs: {output_error}")
        
        # Save logs to database for persistence
        try:
            duration = int(session["completed_at"] - session["created_at"])
            supabase.save_deployment_logs(
                project_id=project_id,
                operation_type=operation,
                logs=session.get("logs", []),
                status="success" if result.success else "error",
                duration_seconds=duration,
                error_message=result.error if not result.success else None,
            )
            logger.info(f"Saved {len(session.get('logs', []))} logs to database")
        except Exception as log_error:
            logger.warning(f"Failed to save logs to database: {log_error}")
        
        # Update project deployment status in database
        if result.success:
            logger.info(f"Deployment {operation} completed successfully for project {project_id}")
            # Update project status
            try:
                supabase.update_project_deployment_status(
                    project_id=project_id,
                    status="deployed" if operation == "apply" else "planned"
                )
            except Exception as e:
                logger.warning(f"Failed to update project status: {e}")
        else:
            logger.error(f"Deployment {operation} failed for project {project_id}: {result.error}")

    except Exception as e:
        logger.error(f"Deployment execution failed: {e}", exc_info=True)

        if session_id in active_deployment_sessions:
            active_deployment_sessions[session_id].update({
                "status": "failed",
                "error": str(e),
                "completed_at": asyncio.get_event_loop().time(),
            })
    
    finally:
        # Cleanup old sessions after some time (keep for 5 minutes for retrieval)
        asyncio.create_task(cleanup_session_after_delay(session_id, delay=300))


async def cleanup_session_after_delay(session_id: str, delay: int):
    """Remove session from active sessions after delay."""
    await asyncio.sleep(delay)
    if session_id in active_deployment_sessions:
        del active_deployment_sessions[session_id]
        logger.info(f"Cleaned up deployment session {session_id}")


# Legacy endpoints for compatibility
@router.post("/deployments/start", response_model=DeploymentStartResponse)
async def start_deployment(
    request: DeploymentStartRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    """
    Start cross-account deployment with real-time logging (legacy endpoint).
    """
    try:
        session_id = generate_deployment_session_id()

        active_deployment_sessions[session_id] = {
            "user_id": user_id,
            "status": "starting",
            "role_arn": request.role_arn,
            "external_id": request.external_id,
            "created_at": asyncio.get_event_loop().time(),
            "logs": [],
        }

        # This would need to be implemented for direct file deployment
        # For now, redirect to project-based deployment
        
        return DeploymentStartResponse(
            session_id=session_id,
            status="starting",
            message="Deployment started successfully",
            stream_url=f"{settings.api_v1_prefix}/deployments/stream/{session_id}",
        )

    except Exception as e:
        logger.error(f"Deployment start error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start deployment")


@router.get("/deployments/stream/{session_id}")
async def stream_deployment_logs(session_id: str):
    """
    Stream deployment logs via Server-Sent Events (legacy endpoint).
    """
    if session_id not in active_deployment_sessions:
        raise HTTPException(status_code=404, detail="Deployment session not found")

    return await stream_project_deployment_logs(session_id)
