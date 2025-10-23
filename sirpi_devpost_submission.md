## Inspiration

Every developer has faced it — the anxiety of deploying to production. The endless YAML configurations, Dockerfile debugging sessions, Terraform state conflicts, and that sinking feeling when your infrastructure fails at 2 AM.

While platforms like Heroku and Vercel made deployment simple, they came with vendor lock-in and limited control. AWS offers incredible power and flexibility, but requires deep DevOps expertise to use correctly. Junior developers shouldn't need to master Kubernetes, Docker, and Terraform just to ship their first app.

That's why I built **Sirpi** (*Tamil: sculptor*) — an AI-native platform that sculpts raw GitHub repositories into production-ready AWS infrastructure. It combines the simplicity of platform-as-a-service with the power of infrastructure-as-code—**with zero vendor lock-in and full ownership**.

Think **Vercel meets Terraform meets Amazon Bedrock AgentCore.** — but you own everything.

---

## What it does

Sirpi is an AI-native DevOps automation platform that:

- **Analyzes repositories** using multi-agent AI powered by Amazon Bedrock AgentCore
- **Generates optimized Dockerfiles** tailored to your specific tech stack and dependencies
- **Creates production-ready Terraform** configurations for complete AWS infrastructure
- **Deploys to your AWS account** securely via cross-account IAM roles—no credentials shared
- **Streams real-time logs** from isolated E2B sandboxes during builds and deployments
- **Provides AI assistance** through Amazon Nova Pro with full deployment context via AgentCore Memory
- **Enables complete ownership** — download all Terraform files and state, migrate anywhere, zero vendor lock-in
- **Provides clean exit** — destroy infrastructure anytime with no dangling resources or unexpected AWS costs

In short: from GitHub URL to production in under 5 minutes, with infrastructure you fully own and control.

---

## How I built it

I used a modern stack with sophisticated AI orchestration:

**Frontend**
- Next.js for server-side rendering and optimal performance
- Clerk for seamless authentication
- Server-Sent Events for real-time deployment log streaming
- Tailwind CSS for clean, professional UI

**Backend**
- FastAPI for high-performance async API handling
- Amazon Bedrock AgentCore for multi-agent orchestration
- AgentCore Memory primitives for stateful agent collaboration
- Amazon Nova Pro for intelligent assistant capabilities
- Supabase PostgreSQL for deployment metadata
- UV package manager for fast, reliable dependency management

**AI Agent System**
- Custom orchestrator coordinating specialized agents
- Context Analyzer using GitHub API to understand repository structure
- Dockerfile Generator with template-based optimization
- Terraform Generator with production-ready configurations following AWS best practices
- All agents communicate via AgentCore Memory—enabling stateful workflows without hardcoded logic

**Infrastructure**
- AWS Lambda for backend hosting
- Cross-account IAM roles for secure deployment
- E2B cloud sandboxes for isolated code execution
- Terraform with S3 state backend and DynamoDB locking
- AWS CDK for Sirpi platform infrastructure

**The most technically ambitious part?**

I built a **real-time streaming execution pipeline** that connects the backend, E2B sandboxes, and frontend in a live, transparent flow. Here's how:

1. **Multi-agent orchestration** via AgentCore Memory — agents write context, subsequent agents read and build upon it, creating a stateful workflow without hardcoded logic
2. **Secure sandbox execution** — all Docker builds and Terraform operations run in isolated E2B environments, streaming logs in real-time to prevent infrastructure compromise
3. **Cross-account deployment** — using IAM role assumption to provision infrastructure in user's AWS account without ever touching their credentials
4. **Terraform state management** — integrated S3 backend with DynamoDB locking for production-grade state tracking

This allowed me to:
- Execute untrusted code safely without exposing our infrastructure
- Provide full visibility into every build and deployment step
- Deploy into user's AWS accounts with zero credential sharing
- Stream live progress updates during deployment workflows

---

## Challenges I ran into

**Real-time log streaming from E2B sandboxes** was complex — handling WebSocket connections, buffering outputs, and maintaining streaming state across long-running Terraform operations

**AgentCore Memory state management** required careful orchestration — ensuring agents wrote complete context and subsequent agents could reliably read and parse it

**Cross-account IAM role assumption** required careful handling — managing temporary credential expiration during multi-step deployments, proper permission scoping for ECR and CloudFormation access, and clear error messages when users provided incorrect role ARNs

**Terraform state locking** needed bulletproof implementation — preventing state corruption during concurrent operations and ensuring clean deletion

**Streaming long deployments** without timeout required WebSocket keep-alive logic, chunked SSE messages, and graceful reconnection handling

**Balancing AI autonomy with safety gates** — determining where human approval was essential (PR merge, IAM role setup) versus where agents could proceed autonomously

**Intelligent repository analysis** — handling diverse repository structures including branch name variations (main/master), existing Dockerfiles in different locations (root, docker/, .docker/), multiple package managers, monorepo detection, and framework-specific entry point conventions

---

## Accomplishments that I'm proud of

**Reduced deployment complexity from ~40 configuration files to zero** — developers need only need to connect their GitHub; Sirpi handles Dockerfile, Terraform, IAM policies, and CloudFormation automatically

**Built a production-ready platform, not a demo** — complete error handling, state management, and clean teardown workflows that would work in enterprise environments

**Achieved true multi-agent collaboration** via AgentCore Memory — agents genuinely build on each other's work through shared state, not through prompt chaining

**Created seamless cross-account security** — users never share AWS credentials; infrastructure deploys into their account with full ownership and control

**Implemented real-time execution visibility** — every Docker build layer, every Terraform resource creation, streamed live to the frontend with zero information loss

**Designed for zero vendor lock-in** — users can download all Terraform files and state, manage infrastructure independently, or migrate to other platforms

**Made complex DevOps accessible** — a junior developer with zero DevOps / AWS knowledge can deploy production infrastructure in minutes

- **Achieved end-to-end deployment speed** — complete infrastructure provisioning from repository URL to live application in under 5 minutes

---

## What I learned

**AgentCore Memory transforms multi-agent systems** — stateful context sharing eliminates brittle prompt chains and enables genuine agent collaboration

**Security isolation is non-negotiable** — executing user code requires sandboxes; I learned E2B's API intricacies for reliable isolation

**Real-time streaming requires careful architecture** — Server-Sent Events, chunking strategies, and reconnection logic were essential for 5+ minute operations

**Cross-account IAM is powerful but unforgiving** — I learned trust policy syntax the hard way, debugged AssumeRole permission errors, and built user-friendly error messages for common misconfiguration issues

**Template-based generation beats pure AI** — for Terraform, templates with intelligent variable injection proved more reliable than fully AI-generated code

**Users value ownership over convenience** — the ability to download state files and migrate away is a feature, not a concession

---

## What's next for Sirpi

**Immediate (Post-Hackathon)**
- Support for additional deployment targets (Kubernetes, AWS App Runner, AWS Amplify)
- Enhanced Terraform templates for RDS, ElastiCache, SQS, and EventBridge
- Improved AI Assistant with deployment troubleshooting and optimization suggestions
- Multi-region deployment support

**Near-term**
- Cost estimation before deployment using AWS Pricing API
- Infrastructure drift detection and automatic remediation
- Team collaboration features with shared deployments
- Monitoring and alerting integration (CloudWatch, Datadog)

**Long-term Vision**
- Expand beyond AWS to GCP and Azure
- ML model deployment pipelines
- Database migration automation
- Full platform marketplace for deployment templates

I built Sirpi because deployment should be simple, secure, and empower developers rather than gatekeep them. This hackathon validated that vision, and I'm excited to continue building.

---

## Built With

- amazon-bedrock
- amazon-bedrock-agentcore
- amazon-nova
- aws-lambda
- clerk
- e2b
- fastapi
- github
- nextjs
- postgresql
- supabase
- tailwindcss
- terraform
- typescript
- uv
