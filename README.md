# Sirpi - AI-Native DevOps Automation Platform

> Democratizing infrastructure deployment through AI-powered automation

<div align="center">

[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock%20AgentCore-FF9900?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![Hackathon](https://img.shields.io/badge/AWS%20Bedrock-Devpost%20Hackathon-success)](https://amazonbedrock.devpost.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Demo](#-demo) • [Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture)

</div>

---

## 🎯 What is Sirpi?

**Sirpi** (Tamil for "sculptor") transforms raw GitHub repositories into production-ready AWS infrastructure. Just connect your repo, and watch as AI agents analyze your code and generate:

- 🐳 **Dockerfiles** - Optimized for your stack
- ☁️ **Terraform configs** - Complete AWS infrastructure
- 🔄 **CI/CD workflows** - Automated deployment pipelines
- 📊 **Real-time logs** - Watch your deployment happen live

**No DevOps expertise required.**

---

## ✨ Features

### 🤖 **AI-Powered Analysis**
- Automatic language and framework detection
- Dependency analysis and optimization
- Best practices baked in

### 🏗️ **Infrastructure as Code**
- Complete Terraform configurations
- ECS Fargate deployments
- Load balancers and auto-scaling
- Secure VPC networking

### 🔗 **GitHub Integration**
- Connect via GitHub App
- Auto-generate infrastructure PRs
- Merge to deploy automatically

### ☁️ **AWS Deployment**
- Cross-account role assumption
- One-click CloudFormation setup
- Real-time deployment logs
- Direct application URLs

### 📊 **Enterprise Ready**
- Multi-agent orchestration via Bedrock AgentCore
- S3-backed file storage with versioning
- Supabase PostgreSQL database
- Production-grade error handling

---

## 🚀 Quick Start

### Prerequisites
- AWS Account (for deployment)
- GitHub Account (for repository access)
- Node.js 18+ and Python 3.12+

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/sirpi-aws-devpost.git
cd sirpi-aws-devpost
```

### 2. Setup Backend
```bash
cd backend

# Install dependencies (uses uv)
pip install uv
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run locally
uv run uvicorn src.main:app --reload
```

### 3. Setup Frontend
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Add your Clerk keys

# Run development server
npm run dev
```

### 4. Setup Database
```bash
# In Supabase Dashboard → SQL Editor, run:
backend/database/schema.sql
```

### 5. Deploy Backend to AWS Lambda
```bash
cd infrastructure
npm install
cdk bootstrap  # First time only
cdk deploy SirpiBackendStack
```

---

## 🏛️ Architecture

### High-Level Overview

```
┌─────────────┐
│   GitHub    │────────────┐
│    Repo     │            │
└─────────────┘            ↓
                    ┌─────────────┐
┌─────────────┐    │   FastAPI   │    ┌──────────────┐
│  Next.js    │───→│   Backend   │───→│   Bedrock    │
│  Frontend   │    │  (Lambda)   │    │  AgentCore   │
└─────────────┘    └─────────────┘    └──────────────┘
                           │                   │
                           ↓                   ↓
                    ┌─────────────┐    ┌──────────────┐
                    │  Supabase   │    │      S3      │
                    │  PostgreSQL │    │  (Files)     │
                    └─────────────┘    └──────────────┘
                           │
                           ↓
                    ┌─────────────┐
                    │   AWS ECS   │
                    │   Fargate   │────→ 🚀 Your App
                    └─────────────┘
```

### Multi-Agent System

Powered by **Amazon Bedrock AgentCore**, Sirpi orchestrates specialized AI agents:

1. **Context Analyzer** - Detects languages, frameworks, dependencies
2. **Dockerfile Generator** - Creates optimized container configs
3. **Terraform Generator** - Generates complete infrastructure
4. **Orchestrator** - Coordinates agent workflows and memory

---

## 📁 Project Structure

```
sirpi-aws-devpost/
├── backend/                    # FastAPI backend
│   ├── src/
│   │   ├── agentcore/         # Bedrock agent orchestration
│   │   ├── api/               # REST endpoints
│   │   ├── services/          # Business logic
│   │   └── models/            # Data models
│   └── database/
│       └── schema.sql         # Complete DB schema
│
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js 14 app router
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities
│   └── public/
│
├── infrastructure/             # AWS CDK
│   ├── lib/                   # Stack definitions
│   └── cdk.json
│
└── scripts/                    # Automation
    ├── production_cleanup.sh
    └── security_audit.sh
```

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** - High-performance Python API framework
- **AWS Lambda** - Serverless deployment via Mangum
- **Bedrock AgentCore** - Multi-agent orchestration
- **Boto3** - AWS SDK for Python
- **UV** - Fast Python package manager

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first styling
- **Clerk** - Authentication and user management
- **Shadcn/ui** - Beautiful UI components

### Infrastructure
- **AWS ECS Fargate** - Serverless container deployment
- **Terraform** - Infrastructure as Code
- **AWS CDK** - Cloud Development Kit
- **Supabase** - PostgreSQL database
- **Amazon S3** - File storage with versioning

---

## 🔐 Security

### Best Practices
- ✅ Cross-account IAM roles (no long-lived credentials)
- ✅ Environment variables for secrets
- ✅ GitHub App permissions (read-only by default)
- ✅ CloudFormation for secure AWS setup
- ✅ HTTPS everywhere

### Setup AWS Connection
```bash
# 1. Deploy CloudFormation template
aws cloudformation create-stack \
  --stack-name sirpi-setup \
  --template-body file://infrastructure/sirpi-setup.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=SirpiAccountId,ParameterValue=YOUR_SIRPI_AWS_ACCOUNT_ID

# 2. Copy Role ARN from outputs
# 3. Add to Sirpi dashboard under "Connect AWS"
```

---

## 📊 Database Schema

<details>
<summary>View Schema</summary>

```sql
-- Core tables
users                    # User accounts (Clerk)
github_installations     # GitHub App connections
aws_connections          # AWS account links
projects                 # User projects
generations              # Infrastructure generation history
deployment_logs          # Deployment operation logs
```

See [`backend/database/schema.sql`](backend/database/schema.sql) for complete schema.

</details>

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# End-to-end
npm run test:e2e
```

---

## 📖 Documentation

- [Production Cleanup Guide](PRODUCTION_CLEANUP.md) - Latest cleanup status
- [Backend API Docs](http://localhost:8000/docs) - Auto-generated Swagger UI
- [Database Schema](backend/database/schema.sql) - Complete SQL schema
- [Infrastructure Guide](infrastructure/README.md) - AWS CDK deployment

---

## 🤝 Contributing

This is a hackathon project for the [AWS Bedrock AgentCore Devpost Challenge](https://amazonbedrock.devpost.com/).

Submissions deadline: **October 20, 2025**

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🏆 Hackathon Submission

**Team:** Solo Developer  
**Challenge:** AWS Bedrock AgentCore Devpost Hackathon  
**Submission Date:** October 2025

### Judging Criteria

✅ **Technical Execution** - Multi-agent system with Bedrock AgentCore  
✅ **Creativity** - Novel approach to DevOps automation  
✅ **Competitive Positioning** - Unique AI-native solution  
✅ **End-to-End Workflow** - Complete repo-to-deployment pipeline

---

## 📞 Contact

**Developer:** Raj Sudharshan  
**Email:** raj@sirpi.dev  
**GitHub:** [@rajsudharshan](https://github.com/rajsudharshan)

---

<div align="center">

**Built with ❤️ using Amazon Bedrock AgentCore**

[Report Bug](https://github.com/YOUR_USERNAME/sirpi-aws-devpost/issues) • [Request Feature](https://github.com/YOUR_USERNAME/sirpi-aws-devpost/issues)

</div>
