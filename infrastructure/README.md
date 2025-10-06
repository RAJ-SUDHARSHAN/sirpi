# Infrastructure

AWS CDK infrastructure for deploying Bedrock agents.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your AWS account details
```

## Deploy

```bash
# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy development environment
npm run deploy:dev

# Deploy production environment
npm run deploy:prod
```

## Environment Variables

See `.env.example` for required variables.
