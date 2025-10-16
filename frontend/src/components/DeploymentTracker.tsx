"use client";

import React from "react";
import { CheckCircleIcon, ClockIcon } from "@/components/ui/icons";

interface DeploymentStage {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "complete" | "failed";
  startTime?: string;
  endTime?: string;
  duration?: string;
  logs?: string[];
}

interface DeploymentTrackerProps {
  stages: DeploymentStage[];
  currentStage?: string;
  prUrl?: string;
  deploymentUrl?: string;
}

export function DeploymentTracker({
  stages,
  currentStage,
  prUrl,
  deploymentUrl,
}: DeploymentTrackerProps) {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🚀</span>
          Deployment Pipeline
        </h3>

        {deploymentUrl && (
          <a
            href={deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>View Live</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>

      {/* Stages Timeline */}
      <div className="space-y-4">
        {stages.map((stage, index) => (
          <DeploymentStageCard
            key={stage.id}
            stage={stage}
            isLast={index === stages.length - 1}
            isActive={stage.id === currentStage}
          />
        ))}
      </div>

      {/* PR Link */}
      {prUrl && (
        <div className="mt-6 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-white">
                  Pull Request Created
                </div>
                <div className="text-xs text-gray-400">
                  Review and merge to deploy
                </div>
              </div>
            </div>
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-purple-500 text-purple-400 text-sm font-medium rounded-lg hover:bg-purple-500/10 transition-colors"
            >
              View PR
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function DeploymentStageCard({
  stage,
  isLast,
  isActive,
}: {
  stage: DeploymentStage;
  isLast: boolean;
  isActive: boolean;
}) {
  const getStatusIcon = () => {
    switch (stage.status) {
      case "complete":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case "failed":
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (stage.status) {
      case "complete":
        return "border-green-500 bg-green-500/5";
      case "in_progress":
        return "border-blue-500 bg-blue-500/5";
      case "failed":
        return "border-red-500 bg-red-500/5";
      default:
        return "border-gray-800 bg-gray-900/30";
    }
  };

  return (
    <div className="relative">
      {/* Connecting Line */}
      {!isLast && (
        <div
          className={`absolute left-[22px] top-12 w-0.5 h-full ${
            stage.status === "complete"
              ? "bg-green-500"
              : stage.status === "in_progress"
              ? "bg-blue-500"
              : "bg-gray-800"
          }`}
        />
      )}

      <div
        className={`relative border-2 rounded-lg p-4 transition-all ${getStatusColor()} ${
          isActive ? "scale-105" : "scale-100"
        }`}
      >
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-0.5">{getStatusIcon()}</div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">{stage.name}</h4>
              {stage.duration && (
                <span className="text-xs text-gray-400">{stage.duration}</span>
              )}
            </div>

            {/* Timestamps */}
            {(stage.startTime || stage.endTime) && (
              <div className="text-xs text-gray-500 mb-2">
                {stage.startTime && (
                  <span>
                    Started: {new Date(stage.startTime).toLocaleTimeString()}
                  </span>
                )}
                {stage.endTime && (
                  <span className="ml-4">
                    Ended: {new Date(stage.endTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {/* Logs */}
            {stage.logs && stage.logs.length > 0 && (
              <div className="mt-2 bg-gray-900 rounded p-2 max-h-24 overflow-y-auto">
                {stage.logs.map((log, index) => (
                  <div key={index} className="text-xs text-gray-400 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default stages
export const DEFAULT_STAGES: DeploymentStage[] = [
  {
    id: "pr_created",
    name: "Pull Request Created",
    status: "pending",
  },
  {
    id: "terraform_init",
    name: "Terraform Initialize",
    status: "pending",
  },
  {
    id: "terraform_plan",
    name: "Terraform Plan",
    status: "pending",
  },
  {
    id: "terraform_apply",
    name: "Terraform Apply",
    status: "pending",
  },
  {
    id: "deployment_complete",
    name: "Deployment Complete",
    status: "pending",
  },
];
