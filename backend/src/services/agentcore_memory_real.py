"""
Real AWS Bedrock AgentCore Memory - Using Pre-Created Memory
"""

import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

from bedrock_agentcore.memory.session import MemorySessionManager
from bedrock_agentcore.memory.constants import ConversationalMessage, MessageRole

from src.core.config import settings

logger = logging.getLogger(__name__)

AGENTCORE_MEMORY_ID = "memory_d76ow-9t0hjc5FH2"
AGENTCORE_MEMORY_ARN = "arn:aws:bedrock-agentcore:us-west-2:183129768772:memory/memory_d76ow-9t0hjc5FH2"


class AgentCoreMemoryService:
    def __init__(self):
        self.memory_id = AGENTCORE_MEMORY_ID
        self.memory_arn = AGENTCORE_MEMORY_ARN
        logger.info(f"AgentCore Memory initialized: {self.memory_id}")
    
    async def create_memory(self, session_id: str, description: str = None) -> Dict[str, Any]:
        logger.info(f"Using AgentCore Memory: {self.memory_id} (session: {session_id})")
        return {
            "id": self.memory_id,
            "arn": self.memory_arn,
            "status": "ACTIVE",
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def store_agent_event(self, memory_id: str, actor_id: str, event_type: str, 
                                content: Dict[str, Any], session_id: str = None) -> bool:
        try:
            logger.info(f"[AgentCore] Storing {event_type} from {actor_id}")
            
            session_manager = MemorySessionManager(memory_id=memory_id, region_name=settings.aws_region)
            session = session_manager.create_memory_session(actor_id=actor_id, session_id=session_id or "default")
            
            message_data = {"type": event_type, "data": content, "timestamp": datetime.utcnow().isoformat()}
            message_text = json.dumps(message_data)
            
            # Truncate if too large
            if len(message_text) > 8500:
                logger.warning(f"Truncating large event ({len(message_text)} chars)")
                summary = {"type": event_type, "summary": f"Truncated {actor_id}", "timestamp": datetime.utcnow().isoformat()}
                if isinstance(content, dict):
                    for key in ['owner', 'repo', 'detected_language', 'framework', 'language', 'runtime']:
                        if key in content:
                            summary[key] = content[key]
                message_text = json.dumps(summary)
            
            result = session.add_turns(messages=[ConversationalMessage(message_text, MessageRole.ASSISTANT)])
            logger.info(f"✅ Stored {event_type} (event: {result.get('eventId')})")
            return True
        except Exception as e:
            logger.error(f"Failed to store: {e}")
            return False
    
    async def retrieve_memory_context(self, memory_id: str, session_id: str = None) -> Optional[str]:
        try:
            logger.info(f"[AgentCore] Retrieving (session: {session_id})")
            session_manager = MemorySessionManager(memory_id=memory_id, region_name=settings.aws_region)
            
            all_context = []
            
            for actor_id in ["github_analyzer", "context_analyzer", "dockerfile_generator", "terraform_generator"]:
                try:
                    session = session_manager.create_memory_session(actor_id=actor_id, session_id=session_id or "default")
                    turns = session.get_last_k_turns(k=5)
                    
                    if not turns:
                        continue
                    
                    logger.info(f"Found {len(turns)} turns for {actor_id}")
                    
                    for turn in turns:
                        for msg in turn:
                            # Get text from message object
                            text = None
                            if hasattr(msg, 'content'):
                                text = str(msg.content)
                            elif isinstance(msg, dict):
                                text = str(msg.get('content') or msg.get('text') or msg)
                            else:
                                text = str(msg)
                            
                            if not text or len(text) < 10:
                                continue
                            
                            try:
                                data = json.loads(text)
                                event_type = data.get("type", "unknown")
                                
                                all_context.append(f"\\n## {actor_id}")
                                all_context.append(f"Event: {event_type}")
                                
                                # Get data fields
                                event_data = data.get("data", data)
                                if isinstance(event_data, dict):
                                    for key in ['owner', 'repo', 'detected_language', 'framework', 'language', 'runtime']:
                                        if key in event_data:
                                            all_context.append(f"  - {key}: {event_data[key]}")
                                
                                all_context.append("")
                                logger.info(f"✅ Parsed {event_type} from {actor_id}")
                            except:
                                all_context.append(f"\\n{actor_id}: {text[:200]}\\n")
                except:
                    pass
            
            if not all_context:
                logger.info("No events found")
                return None
            
            result = "# AgentCore Memory\\n" + "\\n".join(all_context)
            logger.info(f"✅ Built context with {len(all_context)} items")
            return result
        except Exception as e:
            logger.error(f"Retrieve failed: {e}")
            return None
    
    async def list_memories(self) -> List[Dict]:
        return [{"id": self.memory_id, "arn": self.memory_arn, "status": "ACTIVE"}]
    
    async def delete_memory(self, memory_id: str) -> bool:
        logger.info("Skipping delete - shared memory")
        return True


agentcore_memory = AgentCoreMemoryService()

def get_agentcore_memory():
    return agentcore_memory
