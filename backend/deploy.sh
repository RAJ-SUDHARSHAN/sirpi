#!/bin/bash
set -e

echo "🚀 Deploying Sirpi Backend to AWS Lambda..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI not found. Install it first:"
    echo "   brew install aws-sam-cli"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Create one from .env.example"
    exit 1
fi

echo -e "${YELLOW}⚙️  Loading credentials from .env...${NC}"

# Export AWS credentials from .env
export $(grep -E '^AWS_ACCESS_KEY_ID=' .env | xargs)
export $(grep -E '^AWS_SECRET_ACCESS_KEY=' .env | xargs)
export $(grep -E '^AWS_REGION=' .env | xargs)

# Verify credentials are loaded
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "❌ AWS credentials not found in .env file"
    echo "   Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set"
    exit 1
fi

echo -e "${GREEN}✅ Credentials loaded${NC}"
echo "   Region: ${AWS_REGION:-us-east-1}"
echo ""

echo -e "${BLUE}📦 Syncing dependencies with UV...${NC}"
source .venv/bin/activate
uv sync

echo -e "${BLUE}🔨 Building Lambda package...${NC}"
sam build

echo -e "${BLUE}🚀 Deploying to AWS...${NC}"
sam deploy \
  --stack-name sirpi-backend \
  --capabilities CAPABILITY_IAM \
  --region ${AWS_REGION:-us-east-1} \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --resolve-s3

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Run: ./setup-secrets.sh to upload environment variables to AWS"
echo "2. Copy the API URL from CloudFormation outputs"
echo "3. Update frontend NEXT_PUBLIC_API_URL"
echo "4. (Optional) Set up custom domain: api.sirpi.rajs.dev"
