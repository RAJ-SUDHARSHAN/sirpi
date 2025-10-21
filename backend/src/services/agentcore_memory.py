"""
AgentCore Memory Service - Shared memory for multi-agent collaboration.
"""

import boto3
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from src.core.config import settings

logger = logging.getLogger(__name__)


class AgentCoreMemoryService:
    """Manages AgentCore memory stores for agent collaboration."""
    
    def __init__(self):
        self.client = boto3.client(
            'bedrock-agent-runtime',
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key
        )
        logger.info("AgentCore Memory Service initialized")
    
    def create_session_memory(self, session_id: str) -> Dict[str, Any]:
        """
        Create in-memory session storage for agent collaboration.
        Note: Using in-memory dict as AgentCore memory primitives are session-based.
        """
        memory_key = f"agentcore_memory_{session_id}"
        
        memory_data = {
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "items": {},
            "agent_sequence": []
        }
        
        # Store in active sessions (passed from orchestrator)
        logger.info(f"Created AgentCore memory for session {session_id}")
        return memory_data
    
    def store_item(
        self, 
        memory_data: Dict[str, Any],
        item_id: str, 
        content: Any,
        agent_name: str
    ) -> bool:
        """Store item in memory with agent attribution."""
        try:
            memory_data["items"][item_id] = {
                "content": content,
                "stored_by": agent_name,
                "stored_at": datetime.utcnow().isoformat()
            }
            memory_data["agent_sequence"].append({
                "agent": agent_name,
                "action": "store",
                "item_id": item_id,
                "timestamp": datetime.utcnow().isoformat()
            })
            logger.info(f"[AgentCore Memory] {agent_name} stored {item_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store memory item: {e}")
            return False
    
    def retrieve_item(
        self, 
        memory_data: Dict[str, Any],
        item_id: str,
        agent_name: str
    ) -> Optional[Any]:
        """Retrieve item from memory."""
        try:
            if item_id in memory_data["items"]:
                memory_data["agent_sequence"].append({
                    "agent": agent_name,
                    "action": "retrieve",
                    "item_id": item_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
                content = memory_data["items"][item_id]["content"]
                logger.info(f"[AgentCore Memory] {agent_name} retrieved {item_id}")
                return content
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve memory item: {e}")
            return None
    
    def get_all_items(self, memory_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get all items from memory (for Amazon Q access)."""
        return {
            item_id: item["content"] 
            for item_id, item in memory_data["items"].items()
        }
    
    def get_memory_summary(self, memory_data: Dict[str, Any]) -> str:
        """Get human-readable summary of memory contents."""
        summary_parts = []
        
        for item_id, item in memory_data["items"].items():
            summary_parts.append(f"- {item_id}: stored by {item['stored_by']}")
        
        summary_parts.append(f"\nAgent collaboration sequence:")
        for seq in memory_data["agent_sequence"]:
            summary_parts.append(
                f"  {seq['agent']}: {seq['action']} {seq['item_id']}"
            )
        
        return "\n".join(summary_parts)


# Global instance
agentcore_memory = AgentCoreMemoryService()


def get_agentcore_memory() -> AgentCoreMemoryService:
    """Get AgentCore memory service instance."""
    return agentcore_memory
