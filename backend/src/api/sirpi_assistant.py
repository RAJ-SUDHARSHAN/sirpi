"""
Sirpi AI Assistant API - Powered by Amazon Nova Pro.
Chat interface for deployment assistance and terraform configuration.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging

from src.services.sirpi_assistant import get_sirpi_assistant
from src.utils.clerk_auth import get_current_user_id
from src.services.supabase import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    project_id: str
    question: str
    include_logs: bool = True


@router.post("/assistant/chat")
async def chat(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Chat with Sirpi AI Assistant (powered by Nova)."""
    try:
        # Verify ownership
        project = supabase.get_project_by_id(request.project_id)
        if not project or project["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get deployment logs
        deployment_logs = None
        if request.include_logs:
            try:
                logs = supabase.get_deployment_logs(request.project_id)
                if logs:
                    deployment_logs = []
                    for log_record in logs:
                        if log_record.get("logs"):
                            deployment_logs.extend(log_record["logs"])
            except:
                pass
        
        # Get AgentCore memory
        agentcore_memory = None
        try:
            generation = supabase.get_latest_generation_by_project(request.project_id)
            if generation and generation.get("session_id"):
                from src.api.workflows import active_sessions
                session_id = generation["session_id"]
                if session_id in active_sessions:
                    agentcore_memory = active_sessions[session_id].get("agentcore_memory")
        except:
            pass
        
        # Call assistant
        assistant = get_sirpi_assistant()
        result = await assistant.chat(
            question=request.question,
            project_id=request.project_id,
            deployment_logs=deployment_logs,
            agentcore_memory=agentcore_memory
        )
        
        if result["success"]:
            return {
                "success": True,
                "data": {
                    "answer": result["answer"],
                    "model": result["model"],
                    "has_agentcore_context": result["has_agentcore_context"]
                }
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
