"""
Context Analyzer Agent - Analyzes repository and determines infrastructure requirements.
"""

import json
import logging
from typing import Dict, Any, Optional, Callable

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
            agent_alias_id=settings.agentcore_context_analyzer_alias_id,
            agent_name="Context Analyzer",
        )

    async def invoke(
        self, input_data: Dict[str, Any], thinking_callback: Optional[Callable] = None
    ) -> RepositoryContext:
        """
        Analyze repository and return structured context.

        Args:
            input_data: {
                'session_id': str,
                'raw_data': RawRepositoryData
            }
            thinking_callback: Optional callback for streaming agent thinking

        Returns:
            RepositoryContext with analyzed project details
        """
        session_id = input_data["session_id"]
        raw_data: RawRepositoryData = input_data["raw_data"]

        prompt = self._build_analysis_prompt(raw_data)

        response_text = await self._call_bedrock_agent(
            session_id=session_id,
            prompt=prompt,
            thinking_callback=thinking_callback,
            enable_trace=False,
        )

        # Extract and log the complete thinking section
        if thinking_callback and "<thinking>" in response_text:
            thinking_start = response_text.find("<thinking>") + 10
            thinking_end = response_text.find("</thinking>")
            if thinking_end > thinking_start:
                thinking_content = response_text[thinking_start:thinking_end].strip()
                if thinking_content:
                    thinking_callback("Context Analyzer", f"💭 {thinking_content}")

        context_data = self._parse_json_response(response_text)

        # Sanitize parsed data to ensure correct types for Pydantic
        if context_data.get('dependencies') is None:
            context_data['dependencies'] = {}
        if not isinstance(context_data.get('dependencies'), dict):
            context_data['dependencies'] = {}
        
        if context_data.get('environment_vars') is None:
            context_data['environment_vars'] = []
        if not isinstance(context_data.get('environment_vars'), list):
            context_data['environment_vars'] = []
        
        if context_data.get('ports') is None:
            context_data['ports'] = [3000]
        if not isinstance(context_data.get('ports'), list):
            context_data['ports'] = [3000]

        # Add existing infrastructure file information
        context_data["has_existing_dockerfile"] = raw_data.existing_dockerfile is not None
        context_data["existing_dockerfile_content"] = raw_data.existing_dockerfile
        context_data["has_existing_terraform"] = len(raw_data.existing_terraform) > 0
        context_data["existing_terraform_files"] = raw_data.existing_terraform
        context_data["terraform_location"] = raw_data.terraform_location

        return RepositoryContext(**context_data)

    def _build_analysis_prompt(self, raw_data: RawRepositoryData) -> str:
        """Build comprehensive analysis prompt for the agent."""

        # Limit file list to 50 most relevant files to avoid token limits
        file_list = [f["name"] for f in raw_data.files[:50]]
        
        # Truncate large package files to avoid exceeding token limits
        truncated_package_files = {}
        MAX_FILE_SIZE = 5000  # ~5KB per file
        
        for filename, content in raw_data.package_files.items():
            if len(content) > MAX_FILE_SIZE:
                truncated_package_files[filename] = content[:MAX_FILE_SIZE] + "\n... (truncated)"
                logger.warning(f"{filename} truncated from {len(content)} to {MAX_FILE_SIZE} chars")
            else:
                truncated_package_files[filename] = content
        
        # Limit config files similarly
        truncated_config_files = {}
        for filename, content in raw_data.config_files.items():
            if len(content) > MAX_FILE_SIZE:
                truncated_config_files[filename] = content[:MAX_FILE_SIZE] + "\n... (truncated)"
            else:
                truncated_config_files[filename] = content

        prompt = f"""You are a code analysis agent. You MUST respond with ONLY a valid JSON object. No markdown, no explanations, no text outside the JSON.

Analyze this {raw_data.detected_language or "unknown"} repository and provide structured infrastructure context.

Repository: {raw_data.owner}/{raw_data.repo}

File Structure (first 50 files):
{json.dumps(file_list, indent=2)}

Package Files:
{json.dumps(truncated_package_files, indent=2)}

Configuration Files:
{json.dumps(list(truncated_config_files.keys()), indent=2)}

Your task:
1. Identify the primary programming language
2. Detect framework (FastAPI, Express, Next.js, Django, Spring Boot, Strapi, etc.)
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

CRITICAL: Respond with ONLY this JSON format. Your entire response must be valid JSON that can be parsed by json.loads():

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

Your response must start with {{ and end with }}. Do not include any other text, markdown formatting, or explanations.
"""

        return prompt
