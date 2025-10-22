# Sirpi Backend

FastAPI backend with Amazon Bedrock AgentCore multi-agent orchestration system.

---

## Architecture

### Core Components

**FastAPI Application** - REST API with HTTP polling for real-time log delivery

**API Gateway HTTP API** - Handles all REST endpoints with CORS configuration for frontend access

**AgentCore Multi-Agent System** - Orchestration via Amazon Bedrock AgentCore Memory primitives
- Orchestrator Agent
- Context Analyzer Agent  
- Dockerfile Generator Agent
- Terraform Generator Agent

**AI Assistant** - Amazon Nova Pro for context-aware deployment support

**External Tool Integration** - GitHub API, E2B sandboxes for secure isolated code execution

**Database** - Supabase PostgreSQL for deployment metadata and user management

---

## Getting Started

### Prerequisites

- Python 3.11+
- UV package manager
- AWS Account with Bedrock access
- Supabase account
- GitHub App credentials
- E2B API key

### Installation

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install UV
pip install uv

# Install dependencies
uv pip install -r requirements.txt
```

### Environment Configuration

Create `.env` in the backend directory:

```bash
# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_ACCOUNT_ID=your_account_id

# Amazon Bedrock
BEDROCK_AGENT_ID=your_agent_id
BEDROCK_AGENT_ALIAS_ID=your_alias_id
BEDROCK_REGION=us-east-1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key

# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Clerk
CLERK_SECRET_KEY=sk_test_your_key

# E2B
E2B_API_KEY=your_e2b_key

# Application
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### Running the Server

```bash
# Development
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

API documentation available at `https://api.sirpi.rajs.dev/docs`

---

## AgentCore System

### Multi-Agent Architecture

Sirpi uses Amazon Bedrock AgentCore for stateful agent collaboration:

```python
# Agents share context via AgentCore Memory
orchestrator = OrchestratorAgent(memory_store)
context_analyzer = ContextAnalyzerAgent(memory_store)
dockerfile_generator = DockerfileGeneratorAgent(memory_store)
terraform_generator = TerraformGeneratorAgent(memory_store)

# Workflow with memory sharing
context = await context_analyzer.analyze(repo_url)
dockerfile = await dockerfile_generator.generate()  # Reads context from memory
terraform = await terraform_generator.generate()    # Reads from memory
```

### AgentCore Memory

Enables agents to share state and build on each other's work:

```python
# Write analysis to memory
await memory_store.put("repository_context", context_data)

# Subsequent agents read shared context
context = await memory_store.get("repository_context")
```

### External Tool Integration

**GitHub API Integration**  
OAuth-based repository access for cloning and analyzing code. Automated Pull Request creation with generated artifacts.

**E2B Sandbox Execution**  
All code execution happens in isolated E2B cloud sandboxes for security:

- Repository dependency analysis runs in sandbox environment
- Docker image builds execute in isolated containers
- Terraform plan and apply operations run in sandboxed environments
- Real-time logs delivered via polling

This ensures untrusted code in user repositories cannot compromise Sirpi infrastructure while providing full execution visibility.

**Why Polling Instead of Streaming?**  
API Gateway HTTP API buffers responses, preventing true Server-Sent Events streaming. Polling every 2 seconds provides acceptable near real-time experience for deployment operations that take minutes. Future improvement: migrate to Lambda Function URLs with response streaming for true real-time logs.

---

## API Endpoints

### Health
```
GET /health
```

### GitHub
```
GET  /github/app/callback    OAuth callback
GET  /github/repos           List repositories
POST /github/analyze         Analyze repository
```

### Agents
```
POST /agents/orchestrate     Trigger workflow
GET  /agents/status/{id}     Get status
```

### Deployments
```
POST /deployment/projects/{project_id}/{operation}  Trigger deployment operation
GET  /deployment/operations/{operation_id}/logs      Poll for logs (incremental fetch)
GET  /deployment/operations/{operation_id}/status    Get operation status
GET  /deployment/projects/{project_id}/logs          Get historical logs
POST /deployment/projects/{project_id}/force-unlock Force unlock Terraform state
```

**Log Polling Architecture:**
- Backend stores logs in-memory during active deployments (up to 15 minutes)
- Frontend polls `/logs?since_index=X` every 2 seconds
- Only new logs since last index are returned (efficient)
- Sessions auto-cleanup after 5 minutes of completion
- API Gateway buffers prevent true SSE streaming, polling provides near real-time experience

### Assistant
```
POST /assistant/chat         Chat with AI
GET  /assistant/context/{id} Get deployment context
```

---

**Reasoning LLMs for Decision-Making**  
Amazon Bedrock models power all agent decisions—analyzing tech stacks, selecting optimal base images, determining resource requirements, and generating production-ready configurations.

**Autonomous Capabilities**  
Multi-agent workflow executes end-to-end autonomously. Agents coordinate repository analysis, artifact generation, and infrastructure deployment without human intervention. User approval only required for security gates: Pull Request review, CloudFormation IAM role setup, and final deployment confirmation.

**External Tool Integration**
- GitHub API for repository access and PR management
- E2B Sandboxes for secure, isolated code execution
- Terraform for infrastructure provisioning
- AWS APIs for cross-account deployment
- DynamoDB for state locking

**Agent-to-Agent Collaboration**  
Agents communicate via AgentCore Memory primitives, enabling stateful collaboration where each agent builds on previous agents' work.

---

## Troubleshooting

**AgentCore connection errors**
- Verify AWS credentials and Bedrock access
- Check agent ID and alias configuration

**GitHub OAuth failures**
- Verify GitHub App credentials
- Check callback URL matches configuration

**E2B sandbox timeout errors**
- E2B sandboxes have 1-hour maximum timeout
- Verify E2B API key is valid
- Check sandbox execution logs

**Polling not updating**
- Check browser console for polling debug logs
- Verify operation_id is correct
- Ensure session hasn't been cleaned up (5-minute retention)
- Check API Gateway CORS configuration

**Database connection issues**
- Verify Supabase connection string
- Check database migrations applied
