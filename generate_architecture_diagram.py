from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Lambda, ECS, ECR
from diagrams.aws.network import VPC, ELB, APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.database import RDS, Dynamodb
from diagrams.aws.ml import Bedrock
from diagrams.aws.management import Cloudformation
from diagrams.aws.security import IAMRole
from diagrams.aws.general import User
from diagrams.onprem.vcs import Github
from diagrams.custom import Custom
from urllib.request import urlretrieve

# Download custom logos
clerk_url = "https://avatars.githubusercontent.com/u/49538330?s=200&v=4"
clerk_icon = "clerk_logo.png"
urlretrieve(clerk_url, clerk_icon)

supabase_url = "https://avatars.githubusercontent.com/u/54469796?s=200&v=4"
supabase_icon = "supabase_logo.png"
urlretrieve(supabase_url, supabase_icon)

# HIGH RESOLUTION settings for clarity
graph_attr = {
    "fontsize": "14",
    "bgcolor": "white",
    "pad": "1.5",
    "ranksep": "1.2",           # Tighter vertical spacing - keeps related steps close
    "nodesep": "1.5",           # Reduce horizontal gap between left and right
    "splines": "ortho",
    "dpi": "600"
}

with Diagram(
    "Sirpi Architecture Diagram",
    show=False,
    direction="TB",
    filename="sirpi_architecture",
    graph_attr=graph_attr,
    outformat="png"
):
    
    # USER
    developer = User("Developer/User")
    
    # ============================================
    # SIRPI PLATFORM - AWS ACCOUNT
    # ============================================
    with Cluster("Sirpi Platform - AWS Account", graph_attr={"bgcolor": "#FFF8E1", "penwidth": "2"}):
        
        # Frontend Layer
        with Cluster("User Interface", graph_attr={"bgcolor": "#E3F2FD", "penwidth": "1.5"}):
            frontend = Lambda("Next.js 14")
            clerk = Custom("Clerk Auth", clerk_icon)
        
        # API Gateway Layer
        with Cluster("API Layer", graph_attr={"bgcolor": "#F3E5F5", "penwidth": "1.5"}):
            api_gateway = APIGateway("HTTP API Gateway")
        
        # Backend Layer
        with Cluster("Backend Services", graph_attr={"bgcolor": "#FCE4EC", "penwidth": "1.5"}):
            backend = Lambda("FastAPI Backend")
            supabase = Custom("Supabase", supabase_icon)
        
        # AgentCore System
        with Cluster("Amazon Bedrock AgentCore", graph_attr={"bgcolor": "#E0F2F1", "penwidth": "2"}):
            orchestrator = Bedrock("Orchestrator Agent")
            
            with Cluster("Specialized Agents", graph_attr={"penwidth": "1"}):
                context_analyzer = Bedrock("Context Analyzer")
                dockerfile_gen = Bedrock("Dockerfile Generator")
                terraform_gen = Bedrock("Terraform Generator")
            
            agentcore_memory = S3("AgentCore Memory")
            sirpi_assistant = Bedrock("Sirpi Assistant\nAmazon Nova Pro")
        
        # External Services
        with Cluster("External Integrations", graph_attr={"bgcolor": "#F5F5F5", "penwidth": "1.5"}):
            github = Github("GitHub")
            e2b = Lambda("E2B Sandbox")
        
        # Storage
        s3_artifacts = S3("Artifact Storage")
    
    # ============================================
    # USER'S AWS ACCOUNT - CROSS-ACCOUNT
    # ============================================
    with Cluster("User's AWS Account - Cross-Account Deployment", graph_attr={"bgcolor": "#FFEBEE", "style": "dashed", "penwidth": "3"}):
        
        # User creates CloudFormation stack first
        with Cluster("User Creates Stack", graph_attr={"bgcolor": "#FCE4EC", "penwidth": "1.5"}):
            cfn = Cloudformation("CloudFormation\nStack")
        
        # CloudFormation creates IAM role
        with Cluster("Security", graph_attr={"bgcolor": "#FFCCBC", "penwidth": "1.5"}):
            iam_role = IAMRole("Cross-Account\nIAM Role")
        
        # Container Registry
        with Cluster("Container Registry", graph_attr={"bgcolor": "#FFF3E0", "penwidth": "1.5"}):
            ecr = ECR("Amazon ECR")
        
        # Terraform State Management
        with Cluster("Terraform State", graph_attr={"bgcolor": "#E0F2F1", "penwidth": "1.5"}):
            terraform_state = S3("State File\nS3 Backend")
            state_lock = Dynamodb("State Lock\nDynamoDB")
        
        # Deployed Infrastructure
        with Cluster("Deployed Infrastructure", graph_attr={"bgcolor": "#E8F5E9", "penwidth": "1.5"}):
            vpc = VPC("VPC")
            alb = ELB("Load Balancer")
            ecs = ECS("ECS Fargate")
    
    # ============================================
    # USER WORKFLOW SEQUENCE
    # ============================================
    
    # Step 1-3: User interacts with Sirpi platform
    developer >> Edge(label="1. Access Platform", color="#1565C0", penwidth="2") >> frontend
    frontend >> Edge(color="#1565C0", penwidth="2") >> api_gateway
    api_gateway >> Edge(label="2. Analyze Repo", color="#1565C0", penwidth="2") >> backend
    
    # Auth and database
    frontend >> Edge(penwidth="1.5") >> clerk
    backend >> Edge(penwidth="1.5") >> supabase
    
    # Step 3: Trigger orchestration
    backend >> Edge(label="3. Generate Files", color="#1565C0", penwidth="2") >> orchestrator
    
    # Agent coordination
    orchestrator >> Edge(penwidth="1.5") >> context_analyzer
    orchestrator >> Edge(penwidth="1.5") >> dockerfile_gen
    orchestrator >> Edge(penwidth="1.5") >> terraform_gen
    
    # Memory collaboration
    context_analyzer >> Edge(color="#E65100", style="bold", penwidth="2") >> agentcore_memory
    agentcore_memory >> Edge(color="#EF6C00", style="dashed", penwidth="1.5") >> dockerfile_gen
    dockerfile_gen >> Edge(color="#E65100", style="bold", penwidth="2") >> agentcore_memory
    agentcore_memory >> Edge(color="#EF6C00", style="dashed", penwidth="1.5") >> terraform_gen
    terraform_gen >> Edge(color="#E65100", style="bold", penwidth="2") >> agentcore_memory
    agentcore_memory >> Edge(color="#EF6C00", style="dashed", penwidth="1.5") >> sirpi_assistant
    
    # External access
    context_analyzer >> Edge(penwidth="1.5") >> github
    context_analyzer >> Edge(penwidth="1.5") >> e2b
    
    # Artifact storage
    dockerfile_gen >> Edge(penwidth="1.5") >> s3_artifacts
    terraform_gen >> Edge(penwidth="1.5") >> s3_artifacts
    
    # Pull request
    backend >> Edge(penwidth="1.5") >> github
    
    # ============================================
    # CROSS-ACCOUNT DEPLOYMENT FLOW
    # ============================================
    
    # Step 4: User creates CloudFormation stack in their AWS account
    developer >> Edge(label="4. Create Stack", color="#9C27B0", penwidth="2") >> cfn
    
    # Step 5: CloudFormation creates IAM role
    cfn >> Edge(label="5. Creates Role", color="#9C27B0", penwidth="2") >> iam_role
    
    # Step 6: Backend assumes the IAM role for deployment
    backend >> Edge(label="6. AssumeRole", color="#D84315", penwidth="2") >> iam_role
    
    # Step 7: E2B uses assumed role credentials
    iam_role >> Edge(label="7. Temp Credentials", color="#D84315", style="dashed") >> e2b
    
    # Step 8: E2B builds and pushes Docker image
    e2b >> Edge(label="8. Build & Push", color="#D84315", penwidth="2") >> ecr
    
    # Step 9: E2B runs Terraform
    e2b >> Edge(label="9. Terraform Apply", color="#D84315", penwidth="2") >> terraform_state
    
    # Terraform state management
    terraform_state >> Edge(color="#757575", style="dotted") >> state_lock
    
    # Step 10: Terraform provisions infrastructure
    terraform_state >> Edge(label="10. Provision", color="#2E7D32", penwidth="2") >> vpc
    terraform_state >> Edge(color="#2E7D32") >> alb
    terraform_state >> Edge(color="#2E7D32") >> ecs
    
    # Container runtime
    ecs >> Edge(label="Pull Image", color="#2E7D32") >> ecr
    alb >> Edge(label="Route Traffic", color="#2E7D32") >> ecs
    
    # Step 11: User accesses deployed app
    alb >> Edge(label="11. Live Application", color="#1565C0", penwidth="2") >> developer
    
    # Assistant support
    developer >> Edge(color="#6A1B9A", style="dotted", penwidth="1.5") >> sirpi_assistant

print("✅ Architecture diagram generated!")
print("   ✓ Compact layout with clear flow")
print("   ✓ Steps numbered and aligned")
print("   ✓ API Gateway included")
print("   ✓ High resolution (300 DPI)")