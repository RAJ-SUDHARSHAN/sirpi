#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SirpiBedrockAgentsStack } from '../lib/bedrock-agents-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'development';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || 'us-west-2';

const env = { account, region };

// Stack: Bedrock Agents
const bedrockStack = new SirpiBedrockAgentsStack(app, `SirpiBedrockAgents-${environment}`, {
  env,
  environment,
  description: 'Bedrock agents for Sirpi infrastructure automation'
});

app.synth();
