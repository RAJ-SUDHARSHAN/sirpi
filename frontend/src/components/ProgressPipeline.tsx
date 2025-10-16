"use client";

import React from "react";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "./ui/icons";

interface PipelineStep {
  id: string;
  title: string;
  subtitle: string;
  status: "completed" | "in-progress" | "pending" | "failed";
}

interface ProgressPipelineProps {
  workflowStatus: string;
  currentMessage?: string;
}

export default function ProgressPipeline({
  workflowStatus,
  currentMessage,
}: ProgressPipelineProps) {
  const getSteps = (): PipelineStep[] => {
    const baseSteps: PipelineStep[] = [
      {
        id: "analyze",
        title: "Repository Analysis",
        subtitle: "Scanning codebase...",
        status: "pending",
      },
      {
        id: "context",
        title: "Context Understanding",
        subtitle: "Analyzing stack...",
        status: "pending",
      },
      {
        id: "dockerfile",
        title: "Dockerfile",
        subtitle: "Generating...",
        status: "pending",
      },
      {
        id: "terraform",
        title: "Infrastructure",
        subtitle: "Creating config...",
        status: "pending",
      },
      {
        id: "storage",
        title: "Storage",
        subtitle: "Saving files...",
        status: "pending",
      },
    ];

    if (workflowStatus === "not_started") {
      return baseSteps;
    }

    if (workflowStatus === "failed") {
      const failedIndex = currentMessage?.includes("Analyzing")
        ? 0
        : currentMessage?.includes("Context")
        ? 1
        : currentMessage?.includes("Dockerfile")
        ? 2
        : currentMessage?.includes("Terraform")
        ? 3
        : 4;

      return baseSteps.map((step, idx) => ({
        ...step,
        status:
          idx < failedIndex
            ? "completed"
            : idx === failedIndex
            ? "failed"
            : "pending",
      }));
    }

    if (workflowStatus === "analyzing" || workflowStatus === "started") {
      baseSteps[0].status = "in-progress";
      baseSteps[0].subtitle = "Detecting language...";
    } else if (
      workflowStatus === "generating" &&
      (currentMessage?.includes("Context") ||
        currentMessage?.includes("Invoking Context"))
    ) {
      baseSteps[0].status = "completed";
      baseSteps[0].subtitle = "Complete";
      baseSteps[1].status = "in-progress";
      baseSteps[1].subtitle = "Analyzing...";
    } else if (
      workflowStatus === "generating" &&
      currentMessage?.includes("Dockerfile")
    ) {
      baseSteps[0].status = "completed";
      baseSteps[1].status = "completed";
      baseSteps[1].subtitle = "Complete";
      baseSteps[2].status = "in-progress";
      baseSteps[2].subtitle = "Generating...";
    } else if (
      workflowStatus === "generating" &&
      currentMessage?.includes("Terraform")
    ) {
      baseSteps[0].status = "completed";
      baseSteps[1].status = "completed";
      baseSteps[2].status = "completed";
      baseSteps[2].subtitle = "Complete";
      baseSteps[3].status = "in-progress";
      baseSteps[3].subtitle = "Generating...";
    } else if (
      workflowStatus === "generating" &&
      currentMessage?.includes("S3")
    ) {
      baseSteps[0].status = "completed";
      baseSteps[1].status = "completed";
      baseSteps[2].status = "completed";
      baseSteps[3].status = "completed";
      baseSteps[3].subtitle = "Complete";
      baseSteps[4].status = "in-progress";
      baseSteps[4].subtitle = "Uploading...";
    } else if (workflowStatus === "completed") {
      return baseSteps.map((step) => ({
        ...step,
        status: "completed" as const,
        subtitle: "Complete",
      }));
    }

    return baseSteps;
  };

  const steps = getSteps();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
            <CheckCircleIcon className="w-3 h-3 text-black" />
          </div>
        );
      case "in-progress":
        return (
          <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
        );
      case "failed":
        return (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <XCircleIcon className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex items-center justify-center">
            <ClockIcon className="w-3 h-3 text-gray-700" />
          </div>
        );
    }
  };

  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-black/40 backdrop-blur-sm">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400">Build Progress</h3>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-px h-8 mt-2 ${
                    step.status === "completed" ? "bg-white" : "bg-gray-800"
                  }`}
                />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4
                className={`text-sm font-medium mb-0.5 ${
                  step.status === "completed"
                    ? "text-white"
                    : step.status === "in-progress"
                    ? "text-white"
                    : step.status === "failed"
                    ? "text-red-400"
                    : "text-gray-600"
                }`}
              >
                {step.title}
              </h4>
              <p
                className={`text-xs ${
                  step.status === "pending" ? "text-gray-700" : "text-gray-500"
                }`}
              >
                {step.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
