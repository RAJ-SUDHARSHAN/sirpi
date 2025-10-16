"""
Terraform Deployment Service.
Deploys applications using Terraform with role assumption for cross-account access.
"""

import logging
import json
import boto3
import asyncio
from typing import Dict, List, Optional, Tuple, AsyncGenerator
from dataclasses import dataclass
from pathlib import Path
import tempfile
import os

from src.core.config import settings

# E2B imports for streaming deployment
try:
    from e2b import Sandbox

    E2B_AVAILABLE = True
except ImportError:
    E2B_AVAILABLE = False
    logger.warning("E2B not available, falling back to subprocess deployment")

logger = logging.getLogger(__name__)


@dataclass
class TerraformResult:
    """Result of Terraform deployment execution."""

    success: bool
    logs: List[str]
    error: Optional[str] = None
    outputs: Optional[Dict[str, str]] = None


class TerraformDeploymentService:
    """
    Service for deploying applications using Terraform with role assumption.
    Assumes user's IAM role and runs Terraform to deploy infrastructure.
    """

    async def deploy_terraform(
        self,
        project_id: str,
        generation_id: str,
        owner: str,
        repo: str,
        installation_id: int,
        session_id: str,
        user_id: str,
        use_streaming: bool = True,
    ) -> TerraformResult:
        """
        Deploy application using Terraform with role assumption.

        Args:
            project_id: Project UUID
            generation_id: Generation UUID
            owner: Repository owner
            repo: Repository name
            installation_id: GitHub App installation ID
            session_id: Workflow session ID
            user_id: User ID for AWS connection lookup

        Returns:
            TerraformResult with success status and logs
        """
        logs = []

        try:
            logger.info(f"Starting Terraform deployment for project {project_id}")
            logger.info(f"Deployment target: {owner}/{repo}, session: {session_id}")

            # 1. Get AWS connection details for the user
            from src.services.supabase import get_supabase_service

            supabase = get_supabase_service()

            # Get the AWS connection for this user
            with supabase.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT role_arn, external_id FROM aws_connections
                        WHERE user_id = %s AND status = 'verified'
                        ORDER BY verified_at DESC
                        LIMIT 1
                        """,
                        (user_id,),
                    )
                    aws_connection = cur.fetchone()

            if not aws_connection or not aws_connection["role_arn"]:
                error_msg = "No verified AWS connection found for user"
                logger.error(error_msg)
                logs.append(f"ERROR: {error_msg}")
                return TerraformResult(success=False, logs=logs, error=error_msg)

            user_role_arn = aws_connection["role_arn"]
            external_id = aws_connection["external_id"]
            logger.info(f"Found user role ARN: {user_role_arn}")
            logs.append(f"Using role ARN: {user_role_arn}")

            # 2. Download Terraform files from S3
            logger.info("Downloading Terraform files from S3")
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
            )

            # Get generation details to find S3 keys
            with supabase.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT s3_keys FROM generations WHERE id = %s
                        """,
                        (generation_id,),
                    )
                    generation_result = cur.fetchone()

            if not generation_result or not generation_result["s3_keys"]:
                error_msg = "No Terraform files found in S3 for this generation"
                logger.error(error_msg)
                logs.append(f"ERROR: {error_msg}")
                return TerraformResult(success=False, logs=logs, error=error_msg)

            s3_keys = generation_result["s3_keys"]
            logger.info(f"Found {len(s3_keys)} Terraform files in S3")
            logs.append(f"Found {len(s3_keys)} Terraform files in S3")

            # Download files to temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                terraform_dir = Path(temp_dir) / "terraform"
                terraform_dir.mkdir()

                for s3_key in s3_keys:
                    if s3_key.startswith("repositories/") and s3_key.endswith(".tf"):
                        local_path = terraform_dir / Path(s3_key).name
                        try:
                            s3_client.download_file(
                                "sirpi-terraform-states", s3_key, str(local_path)
                            )
                            logs.append(f"Downloaded: {s3_key}")
                        except Exception as e:
                            logs.append(f"Warning: Failed to download {s3_key}: {str(e)}")

                # 3. Configure Terraform backend to use user's S3 and DynamoDB
                logger.info("Configuring Terraform backend for user's account")

                # Update backend.tf to use user's resources
                backend_tf_path = terraform_dir / "backend.tf"
                if backend_tf_path.exists():
                    with open(backend_tf_path, "r") as f:
                        backend_content = f.read()

                    # Replace hardcoded values with user's resources
                    backend_content = backend_content.replace(
                        'bucket         = "sirpi-terraform-states"',
                        f'bucket         = "sirpi-terraform-states-{user_id.split("_")[1][:8]}"',
                    )
                    backend_content = backend_content.replace(
                        'dynamodb_table = "sirpi-terraform-locks"',
                        'dynamodb_table = "sirpi-terraform-locks"',
                    )

                    with open(backend_tf_path, "w") as f:
                        f.write(backend_content)

                    logs.append("Updated Terraform backend configuration")

                # 4. Assume user's role and run Terraform
                logger.info("Assuming user's role and running Terraform deployment")

                # Assume the role in the user's account
                sts_client = boto3.client(
                    "sts",
                    aws_access_key_id=settings.aws_access_key_id,
                    aws_secret_access_key=settings.aws_secret_access_key,
                    region_name=settings.aws_region,
                )

                assumed_role = sts_client.assume_role(
                    RoleArn=user_role_arn,
                    ExternalId=external_id,
                    RoleSessionName=f"SirpiTerraform-{project_id[:8]}",
                )

                credentials = assumed_role["Credentials"]

                # Set up AWS credentials for Terraform
                env = os.environ.copy()
                env.update(
                    {
                        "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
                        "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
                        "AWS_SESSION_TOKEN": credentials["SessionToken"],
                        "AWS_DEFAULT_REGION": settings.aws_region,
                    }
                )

                # Run Terraform init, plan, and apply
                terraform_cmd = ["terraform"]

                # Terraform init
                logger.info("Running terraform init")
                result = subprocess.run(
                    terraform_cmd + ["init"],
                    cwd=str(terraform_dir),
                    env=env,
                    capture_output=True,
                    text=True,
                )

                if result.returncode != 0:
                    error_msg = f"Terraform init failed: {result.stderr}"
                    logger.error(error_msg)
                    logs.append(f"ERROR: {error_msg}")
                    return TerraformResult(success=False, logs=logs, error=error_msg)

                logs.append("Terraform initialized successfully")

                # Terraform plan (optional, for validation)
                logger.info("Running terraform plan")
                result = subprocess.run(
                    terraform_cmd + ["plan", "-out=tfplan"],
                    cwd=str(terraform_dir),
                    env=env,
                    capture_output=True,
                    text=True,
                )

                if result.returncode not in [0, 2]:  # 2 is expected for "no changes"
                    error_msg = f"Terraform plan failed: {result.stderr}"
                    logger.error(error_msg)
                    logs.append(f"ERROR: {error_msg}")
                    return TerraformResult(success=False, logs=logs, error=error_msg)

                logs.append("Terraform plan completed")

                # Terraform apply
                logger.info("Running terraform apply")
                result = subprocess.run(
                    terraform_cmd + ["apply", "-auto-approve", "tfplan"],
                    cwd=str(terraform_dir),
                    env=env,
                    capture_output=True,
                    text=True,
                )

                if result.returncode != 0:
                    error_msg = f"Terraform apply failed: {result.stderr}"
                    logger.error(error_msg)
                    logs.append(f"ERROR: {error_msg}")
                    return TerraformResult(success=False, logs=logs, error=error_msg)

                logs.append("Terraform apply completed successfully")

                # Get Terraform outputs
                logger.info("Getting Terraform outputs")
                result = subprocess.run(
                    terraform_cmd + ["output", "-json"],
                    cwd=str(terraform_dir),
                    env=env,
                    capture_output=True,
                    text=True,
                )

                outputs = {}
                if result.returncode == 0:
                    try:
                        outputs = json.loads(result.stdout)
                        logs.append(f"Terraform outputs: {list(outputs.keys())}")
                    except json.JSONDecodeError:
                        logs.append("Warning: Failed to parse Terraform outputs")

                logger.info(f"Terraform deployment completed successfully for project {project_id}")

                return TerraformResult(success=True, logs=logs, outputs=outputs)

        except Exception as e:
            error_msg = f"Terraform deployment failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            logs.append(f"CRITICAL ERROR: {error_msg}")
            return TerraformResult(success=False, logs=logs, error=error_msg)

    async def _deploy_terraform_with_e2b(
        self, terraform_dir: Path, credentials: Dict, logs: List[str]
    ) -> TerraformResult:
        """Deploy Terraform using E2B sandbox for streaming."""
        try:
            if not E2B_AVAILABLE:
                logs.append("E2B not available, falling back to subprocess")
                return await self._deploy_terraform_subprocess(terraform_dir, credentials, logs)

            # Create E2B sandbox with Terraform installed
            logger.info("Creating E2B sandbox for Terraform deployment")

            # Set up environment variables for AWS credentials in the sandbox
            env_vars = {
                "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
                "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
                "AWS_SESSION_TOKEN": credentials["SessionToken"],
                "AWS_DEFAULT_REGION": settings.aws_region,
            }

            # Upload Terraform files to sandbox
            sandbox = Sandbox.create(env_vars=env_vars)

            # Upload terraform directory to sandbox
            for file_path in terraform_dir.rglob("*"):
                if file_path.is_file():
                    relative_path = file_path.relative_to(terraform_dir)
                    sandbox.files.write(str(relative_path), file_path.read_text())

            logs.append("Uploaded Terraform files to E2B sandbox")

            # Run Terraform commands with streaming
            all_logs = []

            # Terraform init
            logs.append("Running terraform init in sandbox")
            init_result = await self._run_terraform_command_streaming(sandbox, ["init"], all_logs)

            if not init_result["success"]:
                logs.extend(all_logs)
                return TerraformResult(success=False, logs=logs, error=init_result["error"])

            logs.extend(all_logs[-5:])  # Add last 5 logs from init
            all_logs.clear()

            # Terraform plan
            logs.append("Running terraform plan in sandbox")
            plan_result = await self._run_terraform_command_streaming(
                sandbox, ["plan", "-out=tfplan"], all_logs
            )

            if not plan_result["success"]:
                logs.extend(all_logs)
                return TerraformResult(success=False, logs=logs, error=plan_result["error"])

            logs.extend(all_logs[-5:])  # Add last 5 logs from plan
            all_logs.clear()

            # Terraform apply
            logs.append("Running terraform apply in sandbox")
            apply_result = await self._run_terraform_command_streaming(
                sandbox, ["apply", "-auto-approve", "tfplan"], all_logs
            )

            if not apply_result["success"]:
                logs.extend(all_logs)
                return TerraformResult(success=False, logs=logs, error=apply_result["error"])

            logs.extend(all_logs[-5:])  # Add last 5 logs from apply

            # Get outputs
            outputs_result = await self._run_terraform_command_streaming(
                sandbox, ["output", "-json"], all_logs
            )

            outputs = {}
            if outputs_result["success"] and outputs_result["output"]:
                try:
                    outputs = json.loads(outputs_result["output"])
                except json.JSONDecodeError:
                    pass

            logs.append("Terraform deployment completed in E2B sandbox")

            return TerraformResult(success=True, logs=logs, outputs=outputs)

        except Exception as e:
            error_msg = f"E2B deployment failed: {str(e)}"
            logger.error(error_msg)
            logs.append(f"ERROR: {error_msg}")
            return TerraformResult(success=False, logs=logs, error=error_msg)

    async def _run_terraform_command_streaming(
        self, sandbox, cmd_args: List[str], logs: List[str]
    ) -> Dict:
        """Run a Terraform command in E2B sandbox with streaming output."""
        try:
            # Run command in sandbox
            process = await sandbox.commands.run("terraform", *cmd_args)

            # Collect output
            output_lines = []
            async for line in process.stdout:
                output_lines.append(line)
                logs.append(f"terraform {' '.join(cmd_args)}: {line.strip()}")

            # Check if command succeeded
            if process.exit_code == 0:
                return {"success": True, "output": "\n".join(output_lines)}
            else:
                error_output = []
                async for line in process.stderr:
                    error_output.append(line)

                return {
                    "success": False,
                    "error": f"Command failed with exit code {process.exit_code}: {' '.join(error_output)}",
                    "output": "\n".join(output_lines),
                }

        except Exception as e:
            return {"success": False, "error": f"Failed to run command: {str(e)}"}

    async def _deploy_terraform_subprocess(
        self, terraform_dir: Path, credentials: Dict, logs: List[str]
    ) -> TerraformResult:
        """Deploy Terraform using subprocess (fallback method)."""
        try:
            # Set up AWS credentials for Terraform
            env = os.environ.copy()
            env.update(
                {
                    "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
                    "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
                    "AWS_SESSION_TOKEN": credentials["SessionToken"],
                    "AWS_DEFAULT_REGION": settings.aws_region,
                }
            )

            # Run Terraform init, plan, and apply
            terraform_cmd = ["terraform"]

            # Terraform init
            logger.info("Running terraform init")
            result = subprocess.run(
                terraform_cmd + ["init"],
                cwd=str(terraform_dir),
                env=env,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                error_msg = f"Terraform init failed: {result.stderr}"
                logger.error(error_msg)
                logs.append(f"ERROR: {error_msg}")
                return TerraformResult(success=False, logs=logs, error=error_msg)

            logs.append("Terraform initialized successfully")

            # Terraform plan (optional, for validation)
            logger.info("Running terraform plan")
            result = subprocess.run(
                terraform_cmd + ["plan", "-out=tfplan"],
                cwd=str(terraform_dir),
                env=env,
                capture_output=True,
                text=True,
            )

            if result.returncode not in [0, 2]:  # 2 is expected for "no changes"
                error_msg = f"Terraform plan failed: {result.stderr}"
                logger.error(error_msg)
                logs.append(f"ERROR: {error_msg}")
                return TerraformResult(success=False, logs=logs, error=error_msg)

            logs.append("Terraform plan completed")

            # Terraform apply
            logger.info("Running terraform apply")
            result = subprocess.run(
                terraform_cmd + ["apply", "-auto-approve", "tfplan"],
                cwd=str(terraform_dir),
                env=env,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                error_msg = f"Terraform apply failed: {result.stderr}"
                logger.error(error_msg)
                logs.append(f"ERROR: {error_msg}")
                return TerraformResult(success=False, logs=logs, error=error_msg)

            logs.append("Terraform apply completed successfully")

            # Get Terraform outputs
            logger.info("Getting Terraform outputs")
            result = subprocess.run(
                terraform_cmd + ["output", "-json"],
                cwd=str(terraform_dir),
                env=env,
                capture_output=True,
                text=True,
            )

            outputs = {}
            if result.returncode == 0:
                try:
                    outputs = json.loads(result.stdout)
                    logs.append(f"Terraform outputs: {list(outputs.keys())}")
                except json.JSONDecodeError:
                    logs.append("Warning: Failed to parse Terraform outputs")

            logger.info(f"Terraform deployment completed successfully")

            return TerraformResult(success=True, logs=logs, outputs=outputs)

        except Exception as e:
            error_msg = f"Subprocess deployment failed: {str(e)}"
            logger.error(error_msg)
            logs.append(f"ERROR: {error_msg}")
            return TerraformResult(success=False, logs=logs, error=error_msg)


def get_terraform_service() -> TerraformDeploymentService:
    """Get Terraform deployment service instance."""
    return TerraformDeploymentService()
