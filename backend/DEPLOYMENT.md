# Sirpi Backend - Lambda Deployment Guide

## Quick Deploy to Lambda + API Gateway

### Prerequisites

1. **AWS SAM CLI** installed
```bash
brew install aws-sam-cli
# or
pip install aws-sam-cli
```

2. **AWS credentials** configured
```bash
aws configure
```

3. **Environment variables** set in `.env`

### Deployment Steps

#### 1. Make deploy script executable
```bash
chmod +x deploy.sh
```

#### 2. Deploy to Lambda
```bash
./deploy.sh
```

This will:
- Install dependencies
- Build Lambda package
- Deploy to AWS using CloudFormation
- Create API Gateway endpoint

#### 3. Get API URL
After deployment, SAM will output the API URL:
```
https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/
```

### Custom Domain Setup (api.sirpi.rajs.dev)

#### 1. Create ACM Certificate
```bash
# Request certificate in us-west-2 (required for API Gateway)
aws acm request-certificate \
  --domain-name api.sirpi.rajs.dev \
  --validation-method DNS \
  --region us-west-2
```

#### 2. Validate Certificate
- Add DNS validation records to your domain (rajs.dev)
- Wait for certificate to be validated

#### 3. Update template.yaml
Uncomment the custom domain sections and add your certificate ARN

#### 4. Redeploy
```bash
sam deploy --parameter-overrides CertificateArn=arn:aws:acm:...
```

#### 5. Update DNS
Add CNAME record in your DNS:
```
api.sirpi.rajs.dev → xxxxxxxxxx.execute-api.us-west-2.amazonaws.com
```

### Environment Variables

For production, use AWS Systems Manager Parameter Store:

```bash
# Store secrets
aws ssm put-parameter --name /sirpi/database-url --value "your-value" --type SecureString
aws ssm put-parameter --name /sirpi/supabase-url --value "your-value" --type String
# ... add all your env vars
```

Then update `template.yaml` to reference them:
```yaml
Environment:
  Variables:
    DATABASE_URL: !Sub '{{resolve:ssm:/sirpi/database-url}}'
```

### Testing

```bash
# Test the deployed API
curl https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/api/v1/health

# Or with custom domain
curl https://api.sirpi.rajs.dev/api/v1/health
```

### Updating

After code changes:
```bash
./deploy.sh
```

SAM will update only what changed.

### Logs

```bash
# View Lambda logs
sam logs --stack-name sirpi-backend --tail

# Or via CloudWatch
aws logs tail /aws/lambda/sirpi-backend --follow
```

### Rollback

```bash
# Delete the stack
aws cloudformation delete-stack --stack-name sirpi-backend
```

---

## Alternative: Manual Deployment

If SAM doesn't work, you can deploy manually:

### 1. Package your code
```bash
mkdir package
pip install -r requirements.txt -t package/
cp -r src package/
cp lambda_handler.py package/
cd package && zip -r ../deployment.zip . && cd ..
```

### 2. Create Lambda function
```bash
aws lambda create-function \
  --function-name sirpi-backend \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler lambda_handler.handler \
  --zip-file fileb://deployment.zip \
  --timeout 900 \
  --memory-size 1024
```

### 3. Create API Gateway
- Go to AWS Console → API Gateway
- Create HTTP API
- Add Lambda integration
- Configure custom domain

---

## Troubleshooting

**"Module not found" errors**
- Ensure all dependencies in requirements.txt
- Check package directory structure

**Timeout errors**
- Increase Lambda timeout (max 900 seconds)
- Check for long-running operations

**CORS errors**
- Verify sirpi.rajs.dev in allowed origins
- Check credentials: true is set

**Custom domain not working**
- Verify certificate is in us-west-2
- Check DNS propagation (can take 48 hours)
- Ensure CNAME points to API Gateway domain
