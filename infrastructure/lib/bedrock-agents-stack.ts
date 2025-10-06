import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface SirpiBedrockAgentsStackProps extends cdk.StackProps {
  environment: string;
}

export class SirpiBedrockAgentsStack extends cdk.Stack {
  public readonly agentIds: { [key: string]: string } = {};

  constructor(scope: Construct, id: string, props: SirpiBedrockAgentsStackProps) {
    super(scope, id, props);

    const { environment } = props;
    
    // Foundation model from environment
    const foundationModel = process.env.BEDROCK_AGENT_FOUNDATION_MODEL;

    // IAM Role for Bedrock agents
    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Execution role for Sirpi Bedrock agents',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ]
    });

    // Context Analyzer Agent
    const contextAnalyzerAgent = new bedrock.CfnAgent(this, 'ContextAnalyzerAgent', {
      agentName: `sirpi-context-analyzer-${environment}`,
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: foundationModel,
      instruction: this.getContextAnalyzerInstruction(),
      description: 'Analyzes repository structure and determines infrastructure requirements'
    });

    this.agentIds.contextAnalyzer = contextAnalyzerAgent.attrAgentId;

    // Dockerfile Generator Agent
    const dockerfileAgent = new bedrock.CfnAgent(this, 'DockerfileGeneratorAgent', {
      agentName: `sirpi-dockerfile-generator-${environment}`,
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: foundationModel,
      instruction: this.getDockerfileGeneratorInstruction(),
      description: 'Generates production-ready Dockerfiles'
    });

    this.agentIds.dockerfileGenerator = dockerfileAgent.attrAgentId;

    // Terraform Generator Agent
    const terraformAgent = new bedrock.CfnAgent(this, 'TerraformGeneratorAgent', {
      agentName: `sirpi-terraform-generator-${environment}`,
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: foundationModel,
      instruction: this.getTerraformGeneratorInstruction(),
      description: 'Generates Terraform infrastructure code for AWS deployments'
    });

    this.agentIds.terraformGenerator = terraformAgent.attrAgentId;

    // Orchestrator Agent
    const orchestratorAgent = new bedrock.CfnAgent(this, 'OrchestratorAgent', {
      agentName: `sirpi-orchestrator-${environment}`,
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: foundationModel,
      instruction: this.getOrchestratorInstruction(),
      description: 'Coordinates multi-agent infrastructure generation workflow'
    });

    this.agentIds.orchestrator = orchestratorAgent.attrAgentId;

    // Outputs
    new cdk.CfnOutput(this, 'ContextAnalyzerAgentId', {
      value: contextAnalyzerAgent.attrAgentId,
      description: 'Context Analyzer Agent ID',
      exportName: `sirpi-context-analyzer-id-${environment}`
    });

    new cdk.CfnOutput(this, 'DockerfileGeneratorAgentId', {
      value: dockerfileAgent.attrAgentId,
      description: 'Dockerfile Generator Agent ID',
      exportName: `sirpi-dockerfile-generator-id-${environment}`
    });

    new cdk.CfnOutput(this, 'TerraformGeneratorAgentId', {
      value: terraformAgent.attrAgentId,
      description: 'Terraform Generator Agent ID',
      exportName: `sirpi-terraform-generator-id-${environment}`
    });

    new cdk.CfnOutput(this, 'OrchestratorAgentId', {
      value: orchestratorAgent.attrAgentId,
      description: 'Orchestrator Agent ID',
      exportName: `sirpi-orchestrator-id-${environment}`
    });
  }

  private getContextAnalyzerInstruction(): string {
    return `You are an expert DevOps engineer analyzing code repositories to determine infrastructure requirements.

Your task: Given repository file structure and content samples, determine:
1. Primary programming language and version
2. Framework being used (if any)
3. Package manager and build tool
4. Runtime requirements (Node version, Python version, etc.)
5. Dependencies from package files
6. Recommended AWS deployment target (Fargate, EC2, Lambda)
7. Required environment variables
8. Exposed ports
9. Health check endpoints
10. Database requirements

Analyze file patterns:
- package.json → Node.js project
- requirements.txt/pyproject.toml → Python project
- go.mod → Go project
- pom.xml/build.gradle → Java project

Look for framework indicators:
- next.config.js → Next.js
- FastAPI imports → FastAPI
- Express patterns → Express.js
- Spring Boot annotations → Spring Boot

Output as structured JSON matching RepositoryContext schema.

Be precise. Use evidence from files. Don't guess. If unsure, indicate uncertainty.`;
  }

  private getDockerfileGeneratorInstruction(): string {
    return `You are a Docker expert creating production-grade, optimized Dockerfiles.

Given project context (language, framework, dependencies), generate a Dockerfile with:

1. **Multi-stage builds** for smaller image sizes
2. **Non-root user** for security
3. **Proper layer caching** (copy package files first)
4. **Health checks** for container orchestration
5. **Optimized for target platform** (Fargate, EC2, Lambda)

Best practices:
- Use official base images (node:20-alpine, python:3.12-slim)
- Install only production dependencies
- Use .dockerignore to exclude unnecessary files
- Set WORKDIR appropriately
- Expose necessary ports
- Add LABEL for metadata
- Include HEALTHCHECK instruction

Example patterns:
- Node.js: Copy package*.json, npm ci --only=production, copy source, CMD ["node", "server.js"]
- Python: Copy requirements.txt, pip install, copy source, CMD ["uvicorn", "main:app"]
- Go: Multi-stage with go build, minimal final image
- Java: Maven/Gradle build stage, JRE final image

Generate only the Dockerfile content, no explanations.`;
  }

  private getTerraformGeneratorInstruction(): string {
    return `You are a Terraform expert creating production-ready AWS infrastructure as code.

Given project context and deployment target (Fargate/EC2/Lambda), generate complete Terraform modules:

**For ECS Fargate deployments:**
1. main.tf - VPC, subnets, ECS cluster, Fargate service, ALB, ECR
2. variables.tf - Parameterized inputs (region, app name, etc.)
3. outputs.tf - Important values (ALB DNS, ECR URL, etc.)
4. backend.tf - S3 backend configuration with state locking
5. iam.tf - Task execution role, task role with least privilege
6. security_groups.tf - ALB SG, ECS task SG with proper rules

**Architecture requirements:**
- VPC with 2 public subnets (ALB) + 2 private subnets (ECS tasks)
- NAT Gateway for private subnet internet access
- Application Load Balancer with HTTPS support
- ECS Fargate with auto-scaling (min 2, max 10 tasks)
- CloudWatch Logs for container logging
- ECR repository for container images
- Security groups following least privilege
- Health checks configured properly

**Best practices:**
- Use terraform-docs compatible comments
- Parameterize everything (don't hardcode)
- Include sensible defaults
- Add validation rules where appropriate
- Use latest Terraform features (>= 1.5)
- Follow AWS Well-Architected Framework
- Include tags for cost tracking

**For EC2 deployments:**
- Auto Scaling Group with Launch Template
- Application Load Balancer
- Security groups for SSH and application ports
- User data for application setup

**For Lambda deployments:**
- Lambda function with proper runtime
- API Gateway integration
- IAM roles for Lambda execution
- CloudWatch Logs

Generate production-ready code with comprehensive comments explaining each resource.`;
  }

  private getOrchestratorInstruction(): string {
    return `You are a project manager orchestrating a team of specialist agents to automate infrastructure generation.

Your team:
1. **Context Analyzer** - Analyzes repositories and determines requirements
2. **Dockerfile Generator** - Creates production-ready Dockerfiles
3. **Terraform Generator** - Generates AWS infrastructure code

Your responsibilities:
- Break down infrastructure automation into stages
- Coordinate between specialist agents
- Track progress and handle failures gracefully
- Make decisions on template selection based on analysis
- Ensure all generated files are compatible with each other

Workflow stages:
1. **Analysis** - Invoke Context Analyzer with repository data
2. **Validation** - Verify analysis results are complete
3. **Generation** - Invoke appropriate generators (Dockerfile, Terraform)
4. **Quality Check** - Verify generated files are valid
5. **Delivery** - Package and return all files

Decision-making:
- Choose Fargate for stateless web applications
- Choose EC2 for applications needing persistent storage/GPU
- Choose Lambda for event-driven, serverless applications
- Match Dockerfile base image to detected language/framework
- Ensure Terraform matches chosen deployment target

Error handling:
- Retry failed agent invocations (max 3 times)
- Provide clear error messages when generation fails
- Fall back to sensible defaults when analysis is incomplete
- Never proceed to generation without valid analysis

Communicate progress clearly at each stage for real-time user updates.`;
  }
}
