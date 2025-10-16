"use client";

import React from "react";
import {
  CheckCircleIcon,
  ExternalLinkIcon,
  GitHubIcon,
  RocketIcon,
  RefreshIcon,
  XCircleIcon,
} from "./ui/icons";

interface NextStepsGuideProps {
  projectName?: string;
  onCreatePR?: () => void;
  onDeploy?: () => void;
  onSetupAWS?: () => void;
  isCreatingPR?: boolean;
  prUrl?: string | null;
  deploymentStatus?: string;
  deploymentError?: string | null;
  prCreated?: boolean;
  projectStatus?: string;
}

export default function NextStepsGuide({
  onCreatePR,
  onDeploy,
  onSetupAWS,
  isCreatingPR = false,
  prUrl = null,
  deploymentStatus = "not_deployed",
  deploymentError = null,
  prCreated = false,
  projectStatus = "pending",
}: NextStepsGuideProps) {
  // Debug logging
  console.log("NextStepsGuide props:", {
    projectStatus,
    deploymentStatus,
    prCreated,
    prUrl,
    onCreatePR: !!onCreatePR,
    onDeploy: !!onDeploy,
    onSetupAWS: !!onSetupAWS,
  });

  // Build steps dynamically based on current state
  const steps = [];
  let stepNumber = 1;

  // Step 1: Review Generated Files (always shown when completed)
  steps.push({
    number: stepNumber++,
    title: "Review Generated Files",
    description: "Examine Dockerfile and Terraform configuration above",
    status: "completed",
    action: null,
  });

  // Determine if PR has been created (check multiple sources)
  const hasPR =
    prCreated ||
    projectStatus === "pr_created" ||
    projectStatus === "pr_merged" ||
    deploymentStatus === "pr_created" ||
    deploymentStatus === "ready_for_deployment" ||
    prUrl !== null;

  console.log(
    "hasPR calculated:",
    hasPR,
    "(prCreated:",
    prCreated,
    "projectStatus:",
    projectStatus,
    "deploymentStatus:",
    deploymentStatus,
    "prUrl:",
    prUrl,
    ")"
  );

  // Step 2: Create PR (shown when files are generated)
  if (prUrl || onCreatePR || hasPR) {
    steps.push({
      number: stepNumber++,
      title: "Create Pull Request",
      description: "Add infrastructure files to repository",
      status: hasPR ? "completed" : "recommended",
      action: prUrl ? (
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-black rounded-md transition-all flex items-center gap-1.5 font-medium"
        >
          <GitHubIcon className="w-3.5 h-3.5" />
          <span>Open PR</span>
          <ExternalLinkIcon className="w-3 h-3" />
        </a>
      ) : onCreatePR ? (
        <button
          onClick={onCreatePR}
          disabled={isCreatingPR}
          className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-black rounded-md transition-all flex items-center gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitHubIcon className="w-3.5 h-3.5" />
          <span>{isCreatingPR ? "Creating..." : "Create PR"}</span>
        </button>
      ) : null,
    });
  }

  // Step 3: Connect AWS Account (shown when PR is created, disabled until PR merged)
  if (hasPR || onSetupAWS) {
    steps.push({
      number: stepNumber++,
      title: "Connect AWS Account",
      description: hasPR
        ? "Setup IAM role for Sirpi to deploy infrastructure in your AWS account"
        : "Connect AWS account (requires PR to be merged first)",
      status: hasPR ? "next" : "disabled",
      action:
        hasPR && onSetupAWS ? (
          <button
            onClick={onSetupAWS}
            className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-all flex items-center gap-1.5 font-medium"
          >
            <RocketIcon className="w-3.5 h-3.5" />
            <span>Setup AWS Access</span>
            <ExternalLinkIcon className="w-3 h-3" />
          </button>
        ) : (
          <button
            disabled
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-400 rounded-md flex items-center gap-1.5 font-medium cursor-not-allowed"
          >
            <RocketIcon className="w-3.5 h-3.5" />
            <span>Setup AWS Access</span>
          </button>
        ),
    });
  }

  // Step 4: Deploy Infrastructure (always shown, button disabled until AWS verified)
  steps.push({
    number: stepNumber++,
    title: "Deploy Infrastructure",
    description:
      deploymentStatus === "deployed"
        ? "Infrastructure deployed successfully with real-time logs!"
        : deploymentStatus === "deploying"
        ? "Deploying with live build logs... (uses AWS STS, ECS, ALB, etc.)"
        : deploymentStatus === "deployment_failed"
        ? `Deployment failed: ${deploymentError || "Check logs for details"}`
        : prCreated &&
          (deploymentStatus === "aws_verified" ||
            deploymentStatus === "not_deployed" ||
            deploymentStatus === "ready_for_deployment")
        ? "Ready to deploy! Click to start deployment with real-time logs"
        : prCreated
        ? "Deploy infrastructure using your verified AWS connection"
        : "Deploy infrastructure (requires AWS connection and PR merge)",
    status:
      deploymentStatus === "deployed"
        ? "completed"
        : deploymentStatus === "deploying"
        ? "pending"
        : deploymentStatus === "deployment_failed"
        ? "failed"
        : prCreated &&
          (deploymentStatus === "aws_verified" ||
            deploymentStatus === "not_deployed" ||
            deploymentStatus === "ready_for_deployment")
        ? "next"
        : prCreated
        ? "pending"
        : "disabled",
    action:
      deploymentStatus === "deployed" ? (
        <div className="px-3 py-1.5 text-xs bg-green-100 text-green-800 rounded-md flex items-center gap-1.5 font-medium">
          <CheckCircleIcon className="w-3.5 h-3.5" />
          <span>Deployed</span>
        </div>
      ) : deploymentStatus === "deploying" ? (
        <div className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-md flex items-center gap-1.5 font-medium">
          <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
          <span>Deploying...</span>
        </div>
      ) : deploymentStatus === "deployment_failed" ? (
        <div className="px-3 py-1.5 text-xs bg-red-100 text-red-800 rounded-md flex items-center gap-1.5 font-medium">
          <XCircleIcon className="w-3.5 h-3.5" />
          <span>View Logs</span>
        </div>
      ) : prCreated &&
        (deploymentStatus === "aws_verified" ||
          deploymentStatus === "not_deployed" ||
          deploymentStatus === "ready_for_deployment") ? (
        <button
          onClick={onDeploy}
          className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-black rounded-md transition-all flex items-center gap-1.5 font-medium"
        >
          <RocketIcon className="w-3.5 h-3.5" />
          <span>Deploy with Logs</span>
        </button>
      ) : (
        <button
          disabled
          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-400 rounded-md flex items-center gap-1.5 font-medium cursor-not-allowed"
        >
          <RocketIcon className="w-3.5 h-3.5" />
          <span>Deploy with Logs</span>
        </button>
      ),
  });

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
      <div className="border-b border-gray-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-gray-400">Next Steps</h2>
      </div>

      <div className="divide-y divide-gray-800/50">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`flex items-start gap-4 px-6 py-4 ${
              step.status === "recommended" ? "bg-white/[0.02]" : ""
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {step.status === "completed" ? (
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <CheckCircleIcon className="w-3 h-3 text-black" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-gray-800 flex items-center justify-center text-xs text-gray-600 font-medium">
                  {step.number}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white">
                      {step.title}
                    </h3>
                    {step.status === "recommended" && (
                      <span className="px-1.5 py-0.5 bg-white/10 text-white text-[10px] rounded font-medium">
                        Recommended
                      </span>
                    )}
                    {step.status === "optional" && (
                      <span className="px-1.5 py-0.5 bg-gray-800 text-gray-500 text-[10px] rounded font-medium">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {step.action && (
                  <div className="flex-shrink-0">{step.action}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800/50 px-6 py-3 bg-black/20">
        <p className="text-xs text-gray-600">
          Pro tip: Customize Terraform variables before deploying to match your
          AWS setup
        </p>
      </div>
    </div>
  );
}
