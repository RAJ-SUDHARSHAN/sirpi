"""
Terraform Generator Agent - Generates AWS infrastructure code.
"""

import logging
from typing import Dict, Any

from src.agentcore.agents.base import BaseBedrockAgent
from src.agentcore.models import RepositoryContext, DeploymentTarget
from src.agentcore.templates.terraform_backend import generate_backend_config
from src.core.config import settings

logger = logging.getLogger(__name__)


class TerraformGeneratorAgent(BaseBedrockAgent):
    """
    Bedrock agent that generates complete Terraform infrastructure.
    """
    
    def __init__(self):
        super().__init__(
            agent_id=settings.agentcore_terraform_generator_agent_id,
            agent_name="Terraform Generator"
        )
    
    async def invoke(self, input_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Generate Terraform files based on context and template type.
        
        Args:
            input_data: {
                'session_id': str,
                'context': RepositoryContext,
                'template_type': str (fargate/ec2/lambda),
                'project_id': str
            }
            
        Returns:
            Dict mapping filename to content
        """
        session_id = input_data['session_id']
        context: RepositoryContext = input_data['context']
        template_type = input_data.get('template_type', context.deployment_target)
        project_id = input_data.get('project_id', session_id)
        
        prompt = self._build_terraform_prompt(context, template_type)
        
        terraform_content = await self._call_bedrock_agent(
            session_id=session_id,
            prompt=prompt
        )
        
        terraform_files = self._parse_terraform_files(terraform_content)
        
        backend_tf = generate_backend_config(project_id)
        terraform_files['backend.tf'] = backend_tf
        
        return terraform_files
    
    def _build_terraform_prompt(self, context: RepositoryContext, template_type: str) -> str:
        """Build Terraform generation prompt."""
        
        if template_type == 'fargate' or template_type == 'ecs-fargate':
            return self._fargate_prompt(context)
        elif template_type == 'ec2':
            return self._ec2_prompt(context)
        elif template_type == 'lambda':
            return self._lambda_prompt(context)
        else:
            return self._fargate_prompt(context)
    
    def _fargate_prompt(self, context: RepositoryContext) -> str:
        """Generate ECS Fargate infrastructure prompt."""
        
        return f"""Generate complete Terraform infrastructure for ECS Fargate deployment.

Application Context:
- Language: {context.language}
- Framework: {context.framework}
- Runtime: {context.runtime}
- Ports: {context.ports}
- Health Check: {context.health_check_path or '/health'}

Generate these Terraform files (separate files with markers):

=== main.tf ===
# Complete VPC, ECS Fargate, ALB setup
# - VPC with 2 public + 2 private subnets
# - Internet Gateway, NAT Gateway
# - ECS Cluster
# - ECS Service with Fargate tasks
# - Application Load Balancer
# - ECR Repository
# - CloudWatch Log Groups

=== variables.tf ===
# All parameterized inputs
# - region, app_name, environment
# - vpc_cidr, subnet_cidrs
# - container_cpu, container_memory
# - desired_count, max_count

=== outputs.tf ===
# Important values
# - ALB DNS name
# - ECR repository URL
# - ECS cluster name
# - Log group names

=== iam.tf ===
# IAM roles
# - ECS task execution role
# - ECS task role
# Least privilege permissions

=== security_groups.tf ===
# Security groups
# - ALB security group (80, 443)
# - ECS task security group ({context.ports[0] if context.ports else 8000})

Use Terraform best practices:
- terraform >= 1.5
- AWS provider ~> 5.0
- Descriptive resource names
- Proper tags
- Health checks configured
- Auto-scaling enabled

Generate all files with === FILENAME === markers between them.
"""
    
    def _ec2_prompt(self, context: RepositoryContext) -> str:
        """Generate EC2 infrastructure prompt."""
        return "EC2 template coming soon"
    
    def _lambda_prompt(self, context: RepositoryContext) -> str:
        """Generate Lambda infrastructure prompt."""
        return "Lambda template coming soon"
    
    def _parse_terraform_files(self, content: str) -> Dict[str, str]:
        """Parse multiple Terraform files from agent response."""
        
        files = {}
        
        if '```' in content:
            content = content.replace('```terraform', '').replace('```hcl', '').replace('```', '')
        
        sections = content.split('===')
        
        current_filename = None
        current_content = []
        
        for section in sections:
            section = section.strip()
            
            if not section:
                continue
            
            if section.endswith('.tf') or section.endswith('.tf ==='):
                if current_filename and current_content:
                    files[current_filename] = '\n'.join(current_content).strip()
                
                current_filename = section.replace('===', '').strip()
                current_content = []
            else:
                current_content.append(section)
        
        if current_filename and current_content:
            files[current_filename] = '\n'.join(current_content).strip()
        
        if not files and content.strip():
            files['main.tf'] = content.strip()
        
        return files
