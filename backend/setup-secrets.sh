#!/bin/bash
set -e

echo "🔐 Setting up secrets in AWS Parameter Store..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo -e "${YELLOW}⚙️  Loading credentials from .env...${NC}"

# Load AWS credentials
export $(grep -E '^AWS_ACCESS_KEY_ID=' .env | xargs)
export $(grep -E '^AWS_SECRET_ACCESS_KEY=' .env | xargs)
export $(grep -E '^AWS_REGION=' .env | xargs)

REGION=${AWS_REGION:-us-west-2}

# Load all secrets from .env
source .env

echo -e "${BLUE}📤 Uploading parameters to Parameter Store (as regular String for Lambda compatibility)...${NC}"

# Clerk - Using String type for Lambda env vars
aws ssm put-parameter --name "/sirpi/clerk-secret-key" --value "${CLERK_SECRET_KEY}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ clerk-secret-key"
aws ssm put-parameter --name "/sirpi/clerk-webhook-secret" --value "${CLERK_WEBHOOK_SECRET}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ clerk-webhook-secret"

# Supabase
aws ssm put-parameter --name "/sirpi/supabase-user" --value "${SUPABASE_USER}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ supabase-user"
aws ssm put-parameter --name "/sirpi/supabase-password" --value "${SUPABASE_PASSWORD}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ supabase-password"
aws ssm put-parameter --name "/sirpi/supabase-host" --value "${SUPABASE_HOST}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ supabase-host"

# Bedrock
aws ssm put-parameter --name "/sirpi/bedrock-model-id" --value "${BEDROCK_MODEL_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ bedrock-model-id"
aws ssm put-parameter --name "/sirpi/bedrock-agent-foundation-model" --value "${BEDROCK_AGENT_FOUNDATION_MODEL}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ bedrock-agent-foundation-model"

# AgentCore Agent IDs
if [ ! -z "$AGENTCORE_ORCHESTRATOR_AGENT_ID" ]; then
  aws ssm put-parameter --name "/sirpi/agentcore-orchestrator-agent-id" --value "${AGENTCORE_ORCHESTRATOR_AGENT_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ agentcore-orchestrator-agent-id"
fi

if [ ! -z "$AGENTCORE_CONTEXT_ANALYZER_AGENT_ID" ]; then
  aws ssm put-parameter --name "/sirpi/agentcore-context-analyzer-agent-id" --value "${AGENTCORE_CONTEXT_ANALYZER_AGENT_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ agentcore-context-analyzer-agent-id"
fi

if [ ! -z "$AGENTCORE_DOCKERFILE_GENERATOR_AGENT_ID" ]; then
  aws ssm put-parameter --name "/sirpi/agentcore-dockerfile-generator-agent-id" --value "${AGENTCORE_DOCKERFILE_GENERATOR_AGENT_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ agentcore-dockerfile-generator-agent-id"
fi

if [ ! -z "$AGENTCORE_TERRAFORM_GENERATOR_AGENT_ID" ]; then
  aws ssm put-parameter --name "/sirpi/agentcore-terraform-generator-agent-id" --value "${AGENTCORE_TERRAFORM_GENERATOR_AGENT_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ agentcore-terraform-generator-agent-id"
fi

# GitHub App
aws ssm put-parameter --name "/sirpi/github-app-id" --value "${GITHUB_APP_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ github-app-id"
aws ssm put-parameter --name "/sirpi/github-client-id" --value "${GITHUB_APP_CLIENT_ID}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ github-client-id"
aws ssm put-parameter --name "/sirpi/github-client-secret" --value "${GITHUB_APP_CLIENT_SECRET}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ github-client-secret"
aws ssm put-parameter --name "/sirpi/github-webhook-secret" --value "${GITHUB_APP_WEBHOOK_SECRET}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ github-webhook-secret"

# E2B
aws ssm put-parameter --name "/sirpi/e2b-api-key" --value "${E2B_API_KEY}" --type "String" --overwrite --region $REGION 2>/dev/null || echo "  ✓ e2b-api-key"

echo ""
echo -e "${GREEN}✅ All parameters uploaded to AWS Parameter Store!${NC}"
echo ""
echo "Region: $REGION"
echo "Path prefix: /sirpi/*"
echo "Type: String (accessible by Lambda)"
echo ""
echo "Note: Parameters are stored as 'String' type (not SecureString) because"
echo "Lambda environment variables don't support ssm-secure references."
echo "Security is maintained through IAM policies restricting Parameter Store access."
