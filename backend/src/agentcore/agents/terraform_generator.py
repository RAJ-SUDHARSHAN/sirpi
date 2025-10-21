"""
Terraform Generator Agent - Generates complete AWS infrastructure code.
"""

import logging
from typing import Dict, Any, Optional, Callable

from src.agentcore.agents.base import BaseBedrockAgent
from src.agentcore.models import RepositoryContext, DeploymentTarget
from src.agentcore.templates.terraform_backend import generate_backend_config
from src.core.config import settings

logger = logging.getLogger(__name__)


class TerraformGeneratorAgent(BaseBedrockAgent):
    """
    Bedrock agent that generates complete Terraform infrastructure.
    Generates all required files: main.tf, variables.tf, outputs.tf, iam.tf, security_groups.tf
    """

    def __init__(self):
        super().__init__(
            agent_id=settings.agentcore_terraform_generator_agent_id,
            agent_alias_id=settings.agentcore_terraform_generator_alias_id,
            agent_name="Terraform Generator",
        )

    async def invoke(
        self, input_data: Dict[str, Any], thinking_callback: Optional[Callable] = None
    ) -> Dict[str, str]:
        """
        Generate complete Terraform files based on context and template type.
        Uses pre-built templates for speed and reliability.

        Args:
            input_data: {
                'session_id': str,
                'context': RepositoryContext,
                'template_type': str (fargate/ec2/lambda),
                'project_id': str
            }
            thinking_callback: Optional callback for streaming

        Returns:
            Dict mapping filename to content (all 6+ files)
        """
        session_id = input_data["session_id"]
        context: RepositoryContext = input_data["context"]
        template_type = input_data.get("template_type", context.deployment_target)
        project_id = input_data.get("project_id", session_id)

        # Use template-based generation (instant, no AI calls, no rate limits)
        from src.agentcore.templates.terraform.fargate_template import generate_fargate_terraform

        # Log if existing Terraform files were detected
        if context.has_existing_terraform:
            logger.info(
                f"Existing Terraform files detected in {context.terraform_location}. "
                f"Generating new infrastructure files (existing files will not be overwritten). "
                f"Found: {list(context.existing_terraform_files.keys())}"
            )
        else:
            logger.info("No existing Terraform files detected. Generating new infrastructure.")

        logger.info(f"Generating Terraform using template-based approach (no AI calls)")

        # Get repo name from input_data if available
        repo_full_name = input_data.get("repo_full_name", None)

        # Generate terraform files
        if template_type == "fargate" or template_type == "ecs-fargate":
            files = generate_fargate_terraform(context, project_id, repo_full_name)
        elif template_type == "ec2":
            files = generate_fargate_terraform(context, project_id, repo_full_name)
        elif template_type == "lambda":
            files = generate_fargate_terraform(context, project_id, repo_full_name)
        else:
            files = generate_fargate_terraform(context, project_id, repo_full_name)
        
        # Validate generated terraform
        from src.agentcore.validators.terraform_validator import TerraformValidator
        
        validator = TerraformValidator()
        validation_result = validator.validate(files)
        
        if not validation_result.valid:
            error_msg = validation_result.format_errors()
            logger.error(f"Terraform validation failed:\n{error_msg}")
            raise ValueError(f"Generated Terraform is invalid:\n{error_msg}")
        
        if validation_result.has_warnings:
            warning_msg = validation_result.format_warnings()
            logger.warning(f"Terraform validation warnings:\n{warning_msg}")
        
        logger.info("✅ Terraform validation passed")
        return files

    async def _generate_fargate_complete(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> Dict[str, str]:
        """Generate complete ECS Fargate infrastructure (all files)."""
        import asyncio

        # Generate each file separately to avoid token limits
        files = {}

        # 1. Main infrastructure
        main_tf = await self._generate_main_tf(session_id, context, thinking_callback)
        files["main.tf"] = main_tf
        await asyncio.sleep(3)  # Increased delay to avoid rate limits

        # 2. Variables
        variables_tf = await self._generate_variables_tf(session_id, context, thinking_callback)
        files["variables.tf"] = variables_tf
        await asyncio.sleep(3)  # Increased delay

        # 3. Outputs
        outputs_tf = await self._generate_outputs_tf(session_id, context, thinking_callback)
        files["outputs.tf"] = outputs_tf
        await asyncio.sleep(3)  # Increased delay

        # 4. IAM roles
        iam_tf = await self._generate_iam_tf(session_id, context, thinking_callback)
        files["iam.tf"] = iam_tf
        await asyncio.sleep(3)  # Increased delay

        # 5. Security groups
        sg_tf = await self._generate_security_groups_tf(session_id, context, thinking_callback)
        files["security_groups.tf"] = sg_tf
        await asyncio.sleep(3)  # Increased delay

        # 6. Data sources
        data_tf = await self._generate_data_tf(session_id, context, thinking_callback)
        files["data.tf"] = data_tf

        return files

    async def _generate_main_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate main.tf with core infrastructure."""

        prompt = f"""Generate ONLY main.tf for ECS Fargate deployment.

Application: {context.framework or context.language} app
Port: {context.ports[0] if context.ports else 8000}
Health Check: {context.health_check_path or "/health"}

Include ONLY these resources in main.tf:
1. terraform {{ required_version, required_providers }}
2. provider "aws" {{ region }}  
3. VPC (enable DNS)
4. 2 Public Subnets (for ALB)
5. 2 Private Subnets (for ECS tasks)
6. Internet Gateway
7. NAT Gateway + Elastic IP
8. Public Route Table (IGW route)
9. Private Route Table (NAT route)
10. Route Table Associations
11. ECS Cluster (with container insights)
12. ECS Task Definition (Fargate, references IAM roles)
13. ECS Service (Fargate, references security groups, target group)
14. Application Load Balancer
15. ALB Target Group (health checks)
16. ALB Listener HTTPS (references ACM cert variable)
17. ALB Listener HTTP (redirect to HTTPS)
18. ECR Repository
19. CloudWatch Log Group

Use variables for ALL parameterizable values (var.region, var.app_name, var.vpc_cidr, etc.)
Reference resources from other files (aws_iam_role.ecs_execution_role, aws_security_group.alb, etc.)

NO placeholders. NO hardcoded values. Use variables.
Production-ready, complete, tested Terraform.

Output ONLY the Terraform code, no markdown, no explanations."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-main", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    async def _generate_variables_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate variables.tf with all input parameters."""

        prompt = f"""Generate ONLY variables.tf for ECS Fargate deployment.

Application: {context.framework or context.language}
Port: {context.ports[0] if context.ports else 8000}

Define these variables with descriptions and defaults:

REQUIRED (must have defaults):
- region (default: us-west-2)
- app_name (default: myapp)
- environment (default: production)
- vpc_cidr (default: 10.0.0.0/16)
- public_subnet_cidrs (default: ["10.0.1.0/24", "10.0.2.0/24"])
- private_subnet_cidrs (default: ["10.0.11.0/24", "10.0.12.0/24"])
- container_cpu (default: 256)
- container_memory (default: 512)
- desired_count (default: 2)
- max_count (default: 10)
- min_count (default: 2)

OPTIONAL (no default, user must provide):
- acm_certificate_arn (description: "ACM certificate ARN for HTTPS - REQUIRED")
- domain_name (description: "Optional custom domain")

Use proper variable blocks with type, description, default, validation where appropriate.

Output ONLY the Terraform code, no markdown."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-variables", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    async def _generate_outputs_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate outputs.tf with important values."""

        prompt = """Generate ONLY outputs.tf for ECS Fargate deployment.

Output these values:
- alb_dns_name (ALB DNS for accessing app)
- ecr_repository_url (Where to push Docker images)
- ecs_cluster_name (ECS cluster name)
- ecs_service_name (ECS service name)
- cloudwatch_log_group (Log group name)
- vpc_id (VPC ID)
- private_subnet_ids (Private subnet IDs)
- security_group_ids (Security group IDs)

Each output should have description.

Output ONLY the Terraform code, no markdown."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-outputs", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    async def _generate_iam_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate iam.tf with ECS task roles."""

        prompt = """Generate ONLY iam.tf for ECS Fargate deployment.

Create these IAM resources:

1. ECS Task Execution Role
   - Name: aws_iam_role.ecs_execution_role
   - Trusted entity: ecs-tasks.amazonaws.com
   - Managed policy: AmazonECSTaskExecutionRolePolicy
   - Allow: Pull from ECR, write to CloudWatch Logs

2. ECS Task Role  
   - Name: aws_iam_role.ecs_task_role
   - Trusted entity: ecs-tasks.amazonaws.com
   - Custom policy for app (S3, DynamoDB, etc. - least privilege)

Use proper assume role policies.
Add tags for Name and Environment.

Output ONLY the Terraform code, no markdown."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-iam", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    async def _generate_security_groups_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate security_groups.tf."""

        app_port = context.ports[0] if context.ports else 8000

        prompt = f"""Generate ONLY security_groups.tf for ECS Fargate deployment.

Application Port: {app_port}

Create these security groups:

1. ALB Security Group (aws_security_group.alb)
   - Ingress: 80 (HTTP) from 0.0.0.0/0
   - Ingress: 443 (HTTPS) from 0.0.0.0/0  
   - Egress: All to 0.0.0.0/0

2. ECS Tasks Security Group (aws_security_group.ecs_tasks)
   - Ingress: {app_port} from ALB security group
   - Egress: All to 0.0.0.0/0 (for NAT)

Use vpc_id = aws_vpc.main.id
Add descriptions and tags.

Output ONLY the Terraform code, no markdown."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-sg", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    async def _generate_data_tf(
        self, session_id: str, context: RepositoryContext, thinking_callback: Optional[Callable]
    ) -> str:
        """Generate data.tf with data sources."""

        prompt = """Generate ONLY data.tf with required data sources.

Include:
- data "aws_availability_zones" "available" (for subnet placement)
- data "aws_caller_identity" "current" (for account ID)

Output ONLY the Terraform code, no markdown."""

        response = await self._call_bedrock_agent(
            session_id=f"{session_id}-data", prompt=prompt, thinking_callback=thinking_callback
        )

        return self._clean_terraform(response)

    def _clean_terraform(self, content: str) -> str:
        """Remove markdown code blocks and XML tags."""
        # Remove thinking/answer tags
        content = content.replace("<thinking>", "").replace("</thinking>", "")
        content = content.replace("<answer>", "").replace("</answer>", "")

        # Remove markdown code blocks
        if "```hcl" in content:
            start = content.find("```hcl") + 6
            end = content.find("```", start)
            content = content[start:end] if end > start else content
        elif "```terraform" in content:
            start = content.find("```terraform") + 12
            end = content.find("```", start)
            content = content[start:end] if end > start else content
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            content = content[start:end] if end > start else content

        return content.strip()
