"""
Workflow orchestrator - Coordinates multi-agent infrastructure generation.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional

from src.agentcore.tools.github_analyzer import GitHubAnalyzer, parse_github_url
from src.agentcore.agents.context_analyzer import ContextAnalyzerAgent
from src.agentcore.agents.dockerfile_generator import DockerfileGeneratorAgent
from src.agentcore.agents.terraform_generator import TerraformGeneratorAgent
from src.services.github_app import get_github_app
from src.services.s3_storage import get_s3_storage
from src.services.supabase import supabase
from src.models import WorkflowStatus
from src.utils.session_logger import attach_session_logger, detach_session_logger

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
        self._session = None

    def _thinking_callback(self, agent_name: str, chunk: str):
        """Callback for streaming agent thinking chunks."""
        if not self._session or not chunk.strip():
            return

        # Don't show any output from Terraform Generator agent (we show files anyway)
        if "Terraform Generator" in agent_name or agent_name == "terraform_generator":
            return

        # Don't show chunks that are just XML tags
        if chunk.strip() in ["<thinking>", "</thinking>", "<answer>", "</answer>"]:
            return

        # Don't show content inside <answer> tags (the generated files)
        if chunk.startswith("<answer>") or chunk.startswith("</answer>"):
            return

        # Show natural language content (likely thinking)
        if not self._is_generated_code(chunk):
            self._session["logs"].append(
                {
                    "timestamp": datetime.utcnow(),
                    "agent": agent_name,
                    "message": chunk.strip(),
                    "level": "THINKING",
                }
            )

    def _is_generated_code(self, text: str) -> bool:
        """Check if text is generated code/config (not thinking)."""
        text = text.strip()
        if not text or len(text) < 10:
            return False

        # Skip if it looks like code/config
        code_patterns = [
            text.startswith("{") and text.endswith("}"),
            text.startswith("[") and text.endswith("]"),
            text.startswith("FROM "),
            text.startswith("RUN "),
            text.startswith("COPY "),
            text.startswith("ENV "),
            text.startswith("WORKDIR "),
            text.startswith("EXPOSE "),
            text.startswith('resource "'),
            text.startswith("terraform {"),
            text.startswith('provider "'),
            text.startswith('variable "'),
            text.startswith('output "'),
            text.startswith('data "'),
            text.startswith('module "'),
            text.startswith("locals {"),
            "```" in text,
            text.startswith("==="),
            text.startswith("# ") and (".tf" in text or "terraform" in text.lower()),
            'resource "aws_' in text,
            "arn:aws:" in text,
        ]

        return any(code_patterns)

    def _is_thinking_text(self, text: str) -> bool:
        """Check if text is natural language thinking (not generated code/JSON)."""
        text = text.strip()
        if not text:
            return False

        # Skip if it looks like code/config
        skip_patterns = [
            text.startswith("{"),
            text.startswith("["),
            text.startswith("FROM "),
            text.startswith("resource "),
            text.startswith("terraform {"),
            text.startswith("```"),
            text.startswith("RUN "),
            text.startswith("COPY "),
            text.startswith("ENV "),
            '"language":' in text,
            '"framework":' in text,
        ]

        return not any(skip_patterns)

    async def execute(
        self,
        session_id: str,
        repository_url: str,
        installation_id: int,
        template_type: str,
        project_id: Optional[str],
        session: Dict[str, Any],
    ) -> None:
        """
        Execute complete workflow and update session state.

        Args:
            session_id: Unique session identifier
            repository_url: GitHub repository URL
            installation_id: GitHub App installation ID
            template_type: Deployment template (fargate/ec2/lambda)
            project_id: Project UUID to link generation to
            session: Active session dict (updated in-place)
        """

        try:
            owner, repo = parse_github_url(repository_url)

            self._session = session

            # Attach session logger to capture backend logs
            from src.api.workflows import active_sessions

            log_handler = attach_session_logger(session_id, active_sessions)

            session["status"] = WorkflowStatus.ANALYZING
            self._add_log(session, "orchestrator", f"Analyzing {owner}/{repo}")

            # Update database and project status
            try:
                supabase.update_generation_status(
                    session_id=session_id, status=WorkflowStatus.ANALYZING.value
                )
                if project_id:
                    supabase.update_project_generation_status(
                        project_id=project_id, status="analyzing", increment_count=False
                    )
                logger.info(f"Database updated: ANALYZING")
            except Exception as e:
                logger.error(f"Failed to update database status: {e}", exc_info=True)

            raw_data = await self.github_analyzer.analyze_repository(installation_id, owner, repo)

            self._add_log(
                session,
                "github_analyzer",
                f"Fetched {len(raw_data.files)} files, detected {raw_data.detected_language}",
            )

            # Log existing infrastructure detection
            if raw_data.existing_dockerfile:
                self._add_log(
                    session, "github_analyzer", f"✓ Found existing Dockerfile in repository"
                )

            if raw_data.existing_terraform:
                location = raw_data.terraform_location or "unknown location"
                self._add_log(
                    session,
                    "github_analyzer",
                    f"✓ Found {len(raw_data.existing_terraform)} existing Terraform files in {location}",
                )

            if not raw_data.existing_dockerfile and not raw_data.existing_terraform:
                self._add_log(
                    session,
                    "github_analyzer",
                    "No existing infrastructure files found - will create from scratch",
                )

            self._add_log(session, "orchestrator", "Invoking Context Analyzer agent")

            context = await self.context_agent.invoke(
                {"session_id": session_id, "raw_data": raw_data},
                thinking_callback=self._thinking_callback,
            )

            self._add_log(
                session,
                "context_analyzer",
                f"Detected {context.language}/{context.framework} for {context.deployment_target}",
            )

            session["context"] = context.dict()
            session["status"] = WorkflowStatus.GENERATING

            # Update database
            try:
                supabase.update_generation_status(
                    session_id=session_id,
                    status=WorkflowStatus.GENERATING.value,
                    project_context=context.dict(),
                )
                if project_id:
                    supabase.update_project_generation_status(
                        project_id=project_id, status="generating", increment_count=False
                    )
                logger.info(f"Database updated: GENERATING")
            except Exception as e:
                logger.error(f"Failed to update database: {e}", exc_info=True)

            # Log Dockerfile generation mode
            if context.has_existing_dockerfile:
                self._add_log(
                    session,
                    "orchestrator",
                    "Enhancing existing Dockerfile with security and best practices",
                )
            else:
                self._add_log(session, "orchestrator", "Generating new Dockerfile from scratch")

            dockerfile = await self.dockerfile_agent.invoke(
                {"session_id": session_id, "context": context},
                thinking_callback=self._thinking_callback,
            )

            session["files"].append(
                {"filename": "Dockerfile", "content": dockerfile, "type": "docker"}
            )

            if context.has_existing_dockerfile:
                self._add_log(
                    session,
                    "dockerfile_generator",
                    "Enhanced Dockerfile with improvements and security fixes",
                )
            else:
                self._add_log(session, "dockerfile_generator", "Dockerfile generated")

            # Log Terraform generation mode
            if context.has_existing_terraform:
                self._add_log(
                    session,
                    "orchestrator",
                    f"Existing Terraform detected in {context.terraform_location} - generating fresh infrastructure",
                )
            else:
                self._add_log(session, "orchestrator", "Generating Terraform infrastructure")

            terraform_files = await self.terraform_agent.invoke(
                {
                    "session_id": session_id,
                    "context": context,
                    "template_type": template_type,
                    "project_id": session_id,
                    "repo_full_name": f"{owner}/{repo}",
                },
                thinking_callback=self._thinking_callback,
            )

            for filename, content in terraform_files.items():
                session["files"].append(
                    {"filename": filename, "content": content, "type": "terraform"}
                )

            self._add_log(
                session,
                "terraform_generator",
                f"Generated {len(terraform_files)} Terraform files: {', '.join(terraform_files.keys())}",
            )

            self._add_log(session, "orchestrator", "Saving files to S3")

            s3_keys = await self.s3_storage.save_generated_files(
                owner=owner, repo=repo, session_id=session_id, files=session["files"]
            )

            self._add_log(session, "orchestrator", f"Saved {len(s3_keys)} files to S3")

            download_urls = await self.s3_storage.get_download_urls(s3_keys)
            session["download_urls"] = download_urls

            # Final database update with completion status
            try:
                supabase.update_generation_status(
                    session_id=session_id,
                    status=WorkflowStatus.COMPLETED.value,
                    s3_keys=s3_keys,
                    project_context=context.dict(),
                )
                if project_id:
                    supabase.update_project_generation_status(
                        project_id=project_id,
                        status="completed",
                        increment_count=True,  # Increment generation_count on completion
                    )
                logger.info(f"Database updated: COMPLETED")
            except Exception as e:
                logger.error(f"Failed to update final status: {e}", exc_info=True)

            session["status"] = WorkflowStatus.COMPLETED
            session["updated_at"] = datetime.utcnow()
            self._add_log(session, "orchestrator", "Workflow completed successfully")

        except Exception as e:
            logger.error(f"Workflow failed: {e}", exc_info=True)

            session["status"] = WorkflowStatus.FAILED
            session["error"] = str(e)
            session["updated_at"] = datetime.utcnow()

            self._add_log(session, "orchestrator", f"Error: {str(e)}", level="ERROR")

            try:
                supabase.update_generation_status(
                    session_id=session_id, status=WorkflowStatus.FAILED.value, error=str(e)
                )
                if project_id:
                    supabase.update_project_generation_status(
                        project_id=project_id, status="failed", increment_count=False
                    )
                logger.info(f"Database updated: FAILED")
            except Exception as db_error:
                logger.error(f"Failed to update error status: {db_error}", exc_info=True)

        finally:
            # Detach session logger
            detach_session_logger(log_handler)

    def _add_log(self, session: Dict, agent: str, message: str, level: str = "INFO"):
        """Add log entry to session."""
        session["logs"].append(
            {"timestamp": datetime.utcnow(), "agent": agent, "message": message, "level": level}
        )
