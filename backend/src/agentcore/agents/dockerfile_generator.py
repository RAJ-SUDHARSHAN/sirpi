"""
Dockerfile Generator Agent - Generates production-ready Dockerfiles.
"""

import logging
from typing import Dict, Any

from src.agentcore.agents.base import BaseBedrockAgent
from src.agentcore.models import RepositoryContext
from src.core.config import settings

logger = logging.getLogger(__name__)


class DockerfileGeneratorAgent(BaseBedrockAgent):
    """
    Bedrock agent that generates production-optimized Dockerfiles.
    """
    
    def __init__(self):
        super().__init__(
            agent_id=settings.agentcore_dockerfile_generator_agent_id,
            agent_name="Dockerfile Generator"
        )
    
    async def invoke(self, input_data: Dict[str, Any]) -> str:
        """
        Generate Dockerfile based on repository context.
        
        Args:
            input_data: {
                'session_id': str,
                'context': RepositoryContext
            }
            
        Returns:
            Dockerfile content as string
        """
        session_id = input_data['session_id']
        context: RepositoryContext = input_data['context']
        
        prompt = self._build_dockerfile_prompt(context)
        
        dockerfile_content = await self._call_bedrock_agent(
            session_id=session_id,
            prompt=prompt
        )
        
        dockerfile_content = self._clean_dockerfile(dockerfile_content)
        
        return dockerfile_content
    
    def _build_dockerfile_prompt(self, context: RepositoryContext) -> str:
        """Build Dockerfile generation prompt."""
        
        return f"""Generate a production-ready Dockerfile for this application.

Project Context:
- Language: {context.language}
- Framework: {context.framework or 'none'}
- Runtime: {context.runtime}
- Package Manager: {context.package_manager}
- Start Command: {context.start_command or 'auto-detect'}
- Build Command: {context.build_command or 'none'}
- Ports: {context.ports}
- Deployment: {context.deployment_target}

Requirements:
1. Use multi-stage build for smaller image size
2. Use official base image (e.g., python:3.12-slim, node:20-alpine)
3. Create non-root user for security
4. Implement proper layer caching (copy package files first)
5. Install only production dependencies
6. Set WORKDIR appropriately
7. Expose ports: {context.ports}
8. Add HEALTHCHECK instruction
9. Use {context.start_command or 'appropriate CMD for ' + context.language}
10. Add labels for metadata

Generate ONLY the Dockerfile content, no explanations or markdown.
Start directly with FROM instruction.
"""
    
    def _clean_dockerfile(self, content: str) -> str:
        """Remove markdown code blocks if present."""
        if '```dockerfile' in content:
            start = content.find('```dockerfile') + 13
            end = content.find('```', start)
            return content[start:end].strip()
        elif '```' in content:
            start = content.find('```') + 3
            end = content.find('```', start)
            return content[start:end].strip()
        return content.strip()
