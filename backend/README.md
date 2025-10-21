# Sirpi Backend

FastAPI backend for AI-Native DevOps Automation Platform.

**AWS Lambda optimized with Supabase Transaction Pooler (Port 6543)**

## Quick Start

```bash
# Install dependencies
uv venv && source .venv/bin/activate
uv pip install -e .

# Configure environment
cp .env.example .env

# Run locally
uvicorn src.main:app --reload --port 8000

# API docs: http://localhost:8000/docs
```

## Environment Variables

```bash
# Required
CLERK_SECRET_KEY=sk_test_...
SUPABASE_USER=postgres.your-project
SUPABASE_PASSWORD=your-password
SUPABASE_HOST=your-project.supabase.co
SUPABASE_PORT=6543
SUPABASE_DBNAME=postgres

# AWS (for Bedrock)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# GitHub App
GITHUB_APP_ID=your-app-id
GITHUB_APP_CLIENT_ID=your-client-id
GITHUB_APP_CLIENT_SECRET=your-client-secret
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret
```

## Database Setup

Run `database/schema.sql` in Supabase SQL Editor.

## API Endpoints

- `GET /api/v1/health` - Health check
- `POST /api/v1/projects/import` - Import GitHub repository
- `GET /api/v1/projects` - List projects
- `POST /api/v1/workflows/start` - Start infrastructure generation
- `GET /api/v1/workflows/stream/{session_id}` - Stream workflow progress

## Development

```bash
# Install dev dependencies
uv sync --dev

# Format code
uv run black src/

# Lint
uv run ruff check src/

# Type check
uv run mypy src/
```

## Deployment to Lambda

1. Package: `uv pip install -t package/ -e . && zip -r function.zip .`
2. Create Lambda function with handler `src.lambda_handler.handler`
3. Set environment variables (use Transaction Pooler for Supabase)
4. Configure API Gateway integration

---


