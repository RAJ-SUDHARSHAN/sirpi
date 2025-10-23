"""
Sirpi AI Assistant - NOW WITH REAL AGENTCORE MEMORY
"""
import boto3
import logging
from typing import Dict, Any, Optional, List
from src.core.config import settings
from src.services.agentcore_memory_real import get_agentcore_memory

logger = logging.getLogger(__name__)

class SirpiAssistantService:
    def __init__(self):
        # Lambda uses execution role automatically - don't pass credentials
        self.client = boto3.client(
            'bedrock-runtime',
            region_name=settings.sirpi_assistant_region
        )
        self.model_id = settings.sirpi_assistant_model_id
        self.agentcore_memory = get_agentcore_memory()
        logger.info(f"Sirpi AI Assistant initialized with AgentCore Memory")
    
    async def chat(self, question: str, project_id: str, 
                   deployment_logs: Optional[List[str]] = None,
                   agentcore_memory: Optional[Dict[str, Any]] = None,
                   application_url: Optional[str] = None) -> Dict[str, Any]:
        try:
            context_parts = []
            
            # Read from REAL AgentCore Memory
            if agentcore_memory and agentcore_memory.get("id"):
                memory_id = agentcore_memory["id"]
                session_id = agentcore_memory.get("session_id", "default")  # Use actual session ID
                logger.info(f"🧠 Reading from AgentCore Memory: {memory_id} (session: {session_id})")
                
                agentcore_context = await self.agentcore_memory.retrieve_memory_context(
                    memory_id=memory_id,
                    session_id=session_id  # Pass the real session ID
                )
                
                if agentcore_context:
                    context_parts.append(agentcore_context)
                    logger.info("✅ Retrieved context from AgentCore Memory")
                else:
                    logger.info("No context found in AgentCore Memory")
            
            # Add application URL if available
            if application_url:
                context_parts.append(f"\n\n**Deployed Application URL**: http://{application_url}")
            
            # Build intelligent system prompt
            system_prompt = """You are Sirpi AI Assistant, an expert DevOps AI powered by Amazon Nova Pro.

Your role:
- Answer questions about infrastructure generation and deployment
- Explain AWS resources in simple, clear terms  
- Provide the deployed application URL when asked
- Be concise and helpful

When answering:
- For URL questions: Provide the URL immediately and clearly
- For resource questions: List the key AWS resources created (VPC, ECS, ALB, etc.)
- For technical questions: Explain simply without jargon
- Always be direct and actionable
"""
            
            prompt = f"{system_prompt}\n\n{chr(10).join(context_parts)}\n\n### User Question:\n{question}"
            
            response = self.client.converse(
                modelId=self.model_id,
                messages=[{"role": "user", "content": [{"text": prompt}]}],
                inferenceConfig={"maxTokens": 1500, "temperature": 0.4}
            )
            
            return {
                "success": True,
                "answer": response['output']['message']['content'][0]['text'],
                "model": self.model_id,  # Add missing model field
                "agentcore_memory_used": bool(context_parts)
            }
        except Exception as e:
            logger.error(f"Chat failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

sirpi_assistant = SirpiAssistantService()
def get_sirpi_assistant():
    return sirpi_assistant
