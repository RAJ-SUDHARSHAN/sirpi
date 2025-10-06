"""
Workflow orchestrator - Coordinates multi-agent infrastructure generation.
"""

import logging
from datetime import datetime
from typing import Dict, Any

from src.agentcore.tools.github_analyzer import GitHubAnalyzer, parse_github_url
from src.agentcore.agents.context_analyzer import ContextAnalyzerAgent
from src.agentcore.agents.dockerfile_generator import DockerfileGeneratorAgent
from src.agentcore.agents.terraform_generator import TerraformGeneratorAgent
from src.services.github_app import get_github_app
from src.services.s3_storage import get_s3_storage
from src.services.supabase import supabase
from src.models import WorkflowStatus

logger = logging.getLogger(__name__)


class WorkflowOrchestrator:
    """
    Coordinates the multi-agent workflow for infrastructure generation.
    """
    
    def __init__(self):
        self.github_analyzer = GitHubAnalyzer(get_github_app())
        self.context_agent = ContextAnalyzerAgent()
        self.dockerfile_agent = DockerfileGeneratorAgent()
        self.terraform_agent = TerraformGeneratorAgent()
        self.s3_storage = get_s3_storage()
    
    async def execute(
        self,
        session_id: str,
        repository_url: str,
        installation_id: int,
        template_type: str,
        session: Dict[str, Any]
    ) -> None:
        """
        Execute complete workflow and update session state.
        
        Args:
            session_id: Unique session identifier
            repository_url: GitHub repository URL
            installation_id: GitHub App installation ID
            template_type: Deployment template (fargate/ec2/lambda)
            session: Active session dict (updated in-place)
        """
        
        try:
            owner, repo = parse_github_url(repository_url)
            
            session['status'] = WorkflowStatus.ANALYZING
            self._add_log(session, "orchestrator", f"Analyzing {owner}/{repo}")
            
            raw_data = await self.github_analyzer.analyze_repository(
                installation_id, owner, repo
            )
            
            self._add_log(
                session, "github_analyzer",
                f"Fetched {len(raw_data.files)} files, detected {raw_data.detected_language}"
            )
            
            self._add_log(session, "orchestrator", "Invoking Context Analyzer agent")
            
            context = await self.context_agent.invoke({
                'session_id': session_id,
                'raw_data': raw_data
            })
            
            self._add_log(
                session, "context_analyzer",
                f"Detected {context.language}/{context.framework} for {context.deployment_target}"
            )
            
            session['context'] = context.dict()
            session['status'] = WorkflowStatus.GENERATING
            
            self._add_log(session, "orchestrator", "Generating Dockerfile")
            
            dockerfile = await self.dockerfile_agent.invoke({
                'session_id': session_id,
                'context': context
            })
            
            session['files'].append({
                'filename': 'Dockerfile',
                'content': dockerfile,
                'type': 'docker'
            })
            
            self._add_log(session, "dockerfile_generator", "Dockerfile generated")
            
            self._add_log(session, "orchestrator", "Generating Terraform infrastructure")
            
            terraform_files = await self.terraform_agent.invoke({
                'session_id': session_id,
                'context': context,
                'template_type': template_type,
                'project_id': session_id
            })
            
            for filename, content in terraform_files.items():
                session['files'].append({
                    'filename': filename,
                    'content': content,
                    'type': 'terraform'
                })
            
            self._add_log(
                session, "terraform_generator",
                f"Generated {len(terraform_files)} Terraform files"
            )
            
            self._add_log(session, "orchestrator", "Saving files to S3")
            
            s3_keys = await self.s3_storage.save_generated_files(
                session_id=session_id,
                files=session['files']
            )
            
            self._add_log(session, "orchestrator", f"Saved {len(s3_keys)} files to S3")
            
            download_urls = await self.s3_storage.get_download_urls(s3_keys)
            session['download_urls'] = download_urls
            
            supabase.update_generation_status(
                session_id=session_id,
                status=WorkflowStatus.COMPLETED.value,
                s3_keys=s3_keys,
                project_context=context.dict()
            )
            
            session['status'] = WorkflowStatus.COMPLETED
            session['updated_at'] = datetime.utcnow()
            self._add_log(session, "orchestrator", "Workflow completed successfully")
            
        except Exception as e:
            logger.error(f"Workflow failed: {e}", exc_info=True)
            
            session['status'] = WorkflowStatus.FAILED
            session['error'] = str(e)
            session['updated_at'] = datetime.utcnow()
            
            self._add_log(session, "orchestrator", f"Error: {str(e)}", level="ERROR")
            
            try:
                supabase.update_generation_status(
                    session_id=session_id,
                    status=WorkflowStatus.FAILED.value,
                    error=str(e)
                )
            except Exception:
                pass
    
    def _add_log(self, session: Dict, agent: str, message: str, level: str = "INFO"):
        """Add log entry to session."""
        session['logs'].append({
            'timestamp': datetime.utcnow(),
            'agent': agent,
            'message': message,
            'level': level
        })
