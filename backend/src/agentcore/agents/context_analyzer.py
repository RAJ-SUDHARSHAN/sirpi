"""
Context Analyzer Agent - Analyzes repository and determines infrastructure requirements.
"""

import json
import logging
from typing import Dict, Any

from src.agentcore.agents.base import BaseBedrockAgent, BedrockAgentError
from src.agentcore.models import RawRepositoryData, RepositoryContext
from src.core.config import settings

logger = logging.getLogger(__name__)


class ContextAnalyzerAgent(BaseBedrockAgent):
    """
    Bedrock agent that analyzes repository data and outputs structured context.
    """
    
    def __init__(self):
        super().__init__(
            agent_id=settings.agentcore_context_analyzer_agent_id,
            agent_name="Context Analyzer"
        )
    
    async def invoke(self, input_data: Dict[str, Any]) -> RepositoryContext:
        """
        Analyze repository and return structured context.
        
        Args:
            input_data: {
                'session_id': str,
                'raw_data': RawRepositoryData
            }
            
        Returns:
            RepositoryContext with analyzed project details
        """
        session_id = input_data['session_id']
        raw_data: RawRepositoryData = input_data['raw_data']
        
        prompt = self._build_analysis_prompt(raw_data)
        
        response_text = await self._call_bedrock_agent(
            session_id=session_id,
            prompt=prompt,
            enable_trace=False
        )
        
        context_data = self._parse_json_response(response_text)
        
        return RepositoryContext(**context_data)
    
    def _build_analysis_prompt(self, raw_data: RawRepositoryData) -> str:
        """Build comprehensive analysis prompt for the agent."""
        
        file_list = [f['name'] for f in raw_data.files[:100]]  # First 100 files
        
        prompt = f"""Analyze this {raw_data.detected_language or 'unknown'} repository and provide structured infrastructure context.

Repository: {raw_data.owner}/{raw_data.repo}

File Structure (first 100 files):
{json.dumps(file_list, indent=2)}

Package Files:
{json.dumps(raw_data.package_files, indent=2)}

Configuration Files:
{json.dumps(list(raw_data.config_files.keys()), indent=2)}

Your task:
1. Identify the primary programming language
2. Detect framework (FastAPI, Express, Next.js, Django, Spring Boot, etc.)
3. Determine exact runtime version needed (e.g., python3.12, node20, go1.21)
4. Identify package manager (npm, pip, uv, yarn, go mod, maven, etc.)
5. Extract key dependencies with versions
6. Recommend deployment target:
   - "fargate" for stateless web applications
   - "ec2" for applications needing persistent storage or GPU
   - "lambda" for serverless event-driven applications
7. Identify exposed ports (default or from config)
8. List required environment variables (from .env.example or config)
9. Detect health check endpoint (if any)
10. Determine start command for the application
11. Determine build command (if needed)

Output ONLY valid JSON matching this exact schema:
{{
  "language": "python",
  "framework": "fastapi",
  "runtime": "python3.12",
  "package_manager": "uv",
  "dependencies": {{
    "fastapi": "0.115.0",
    "uvicorn": "0.30.0"
  }},
  "deployment_target": "fargate",
  "ports": [8000],
  "environment_vars": ["DATABASE_URL", "API_KEY"],
  "health_check_path": "/health",
  "start_command": "uvicorn main:app --host 0.0.0.0 --port 8000",
  "build_command": null
}}

Be precise. Use evidence from files. If uncertain, make best guess based on conventions.
"""
        
        return prompt
