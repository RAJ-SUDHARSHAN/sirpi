"""
Sirpi AI Assistant Service - Powered by Amazon Nova Pro via Bedrock.
Intelligent error analysis, code review, and infrastructure configuration.
"""

import boto3
import json
import logging
from typing import Dict, Any, Optional, List

from src.core.config import settings

logger = logging.getLogger(__name__)


class SirpiAssistantService:
    """AI Assistant powered by Amazon Nova Pro for deployment assistance."""
    
    def __init__(self):
        self.client = boto3.client(
            'bedrock-runtime',
            region_name=settings.sirpi_assistant_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key
        )
        self.model_id = settings.sirpi_assistant_model_id
        logger.info(f"Sirpi AI Assistant initialized ({self.model_id}, {settings.sirpi_assistant_region})")
    
    async def chat(
        self,
        question: str,
        project_id: str,
        deployment_logs: Optional[List[str]] = None,
        agentcore_memory: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        General chat with AI assistant.
        Has access to AgentCore memory and deployment logs.
        """
        try:
            question_lower = question.lower()
            
            if 'what' in question_lower and ('created' in question_lower or 'resources' in question_lower):
                system_prompt = """You are Sirpi AI Assistant. The user asked what resources were created.

Provide a CONCISE, high-level summary in conversational language.

Good example (keep it short!):
"Your application is running on AWS with:

**Network**: VPC with public/private subnets across 2 availability zones for redundancy.

**Compute**: 2 ECS Fargate containers (serverless) that can auto-scale to 10 based on load.

**Load Balancer**: Distributes traffic and handles health checks.

**Security**: IAM roles and security groups controlling access.

Total: 26 AWS resources working together."

Keep response under 150 words. Focus on WHAT they do, not technical names.
DO NOT mention databases, CI/CD, or monitoring unless they were actually created.
"""
            elif 'min' in question_lower and ('instance' in question_lower or 'task' in question_lower):
                system_prompt = """You are Sirpi AI Assistant. The user asked about minimum instances.

Provide a direct answer with context:

Example: "Your application runs with a minimum of **2 instances** at all times. This ensures high availability - if one fails, the other keeps your app running while a replacement spins up. The system can automatically scale up to 10 instances during high traffic."

Be conversational and explain the reasoning, not just the number.
"""
            elif 'explain' in question_lower:
                system_prompt = """You are Sirpi AI Assistant. The user wants an explanation.

Provide a clear, educational explanation:

Focus on:
- How the pieces work together
- Why this architecture was chosen  
- What benefits it provides
- Use analogies if helpful

Example: "Think of your infrastructure like a restaurant: The VPC is the building, subnets are different rooms, the load balancer is the host distributing customers to tables (your app instances), and security groups are the bouncers controlling who gets in."
"""
            else:
                system_prompt = """You are Sirpi AI Assistant, an expert DevOps AI helping developers deploy applications to AWS.

Your role:
- Explain infrastructure in simple, user-friendly terms
- Answer questions about the deployment conversationally
- Help troubleshoot issues with clear guidance
- Be concise but thorough

Communication style:
- Use natural, friendly language (not robotic)
- Explain technical concepts simply
- Use analogies when helpful
- Be encouraging and supportive
- Keep responses under 200 words unless detailed explanation requested

When answering:
- Focus on what the user asked specifically
- Explain WHY things are the way they are
- Use plain English when possible
- Only use technical terms when necessary and explain them
"""

            user_context_parts = []
            
            if agentcore_memory and agentcore_memory.get("items"):
                user_context_parts.append("\n### Infrastructure Context:\n")
                
                if "github-analysis" in agentcore_memory["items"]:
                    github_data = agentcore_memory["items"]["github-analysis"]["content"]
                    repo_name = f"{github_data.get('owner')}/{github_data.get('repo')}"
                    user_context_parts.append(f"- Application: {repo_name}")
                    user_context_parts.append(f"- Language: {github_data.get('detected_language')}")
                
                if "context-analysis" in agentcore_memory["items"]:
                    ctx = agentcore_memory["items"]["context-analysis"]["content"]
                    if ctx.get('framework'):
                        user_context_parts.append(f"- Framework: {ctx.get('framework')}")
                    user_context_parts.append(f"- Deployment: ECS Fargate on AWS")
                    if ctx.get('ports'):
                        user_context_parts.append(f"- App runs on port: {ctx.get('ports')[0] if ctx.get('ports') else 'unknown'}")
                
                if "terraform-files" in agentcore_memory["items"]:
                    tf = agentcore_memory["items"]["terraform-files"]["content"]
                    user_context_parts.append(f"\n- Infrastructure: {len(tf)} Terraform configuration files generated")
                    user_context_parts.append("- Resources created: VPC, Load Balancer, ECS Fargate cluster, Security Groups, IAM roles")
            
            if deployment_logs and any(keyword in question.lower() for keyword in ['error', 'fail', 'wrong', 'issue', 'problem']):
                user_context_parts.append("\n### Recent Deployment Logs (last 20 lines):\n")
                user_context_parts.extend(deployment_logs[-20:])
            
            user_message = f"{system_prompt}\n\n{''.join(user_context_parts)}\n\n### User Question:\n{question}"
            
            response = self.client.converse(
                modelId=self.model_id,
                messages=[{"role": "user", "content": [{"text": user_message}]}],
                inferenceConfig={"maxTokens": 1500, "temperature": 0.4}
            )
            
            answer = response['output']['message']['content'][0]['text']
            
            return {
                "success": True,
                "answer": answer,
                "model": self.model_id,
                "has_agentcore_context": agentcore_memory is not None
            }
            
        except Exception as e:
            logger.error(f"Chat failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}


sirpi_assistant = SirpiAssistantService()

def get_sirpi_assistant():
    return sirpi_assistant
