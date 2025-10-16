"use client";

import React from "react";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: "idle" | "thinking" | "working" | "complete" | "error";
  message?: string;
  progress?: number;
}

interface AgentVisualizationProps {
  agents: Agent[];
  currentAgent?: string;
}

export function AgentVisualization({
  agents,
  currentAgent,
}: AgentVisualizationProps) {
  return (
    <div className="relative">
      {/* Agent Pipeline - Horizontal Flow */}
      <div className="flex items-center gap-4 overflow-x-auto pb-4">
        {agents.map((agent, index) => (
          <React.Fragment key={agent.id}>
            <AgentCard
              agent={agent}
              isActive={agent.id === currentAgent}
              index={index}
            />
            {index < agents.length - 1 && (
              <Arrow
                isActive={
                  agent.status === "complete" ||
                  agents[index + 1].status !== "idle"
                }
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Active Agent Details */}
      {currentAgent && (
        <ActiveAgentDetails
          agent={agents.find((a) => a.id === currentAgent)!}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  isActive,
  index,
}: {
  agent: Agent;
  isActive: boolean;
  index: number;
}) {
  const getStatusColor = () => {
    switch (agent.status) {
      case "complete":
        return "border-green-500 bg-green-500/10";
      case "working":
      case "thinking":
        return "border-blue-500 bg-blue-500/10 animate-pulse";
      case "error":
        return "border-red-500 bg-red-500/10";
      default:
        return "border-gray-700 bg-gray-900/50";
    }
  };

  const getStatusIcon = () => {
    switch (agent.status) {
      case "complete":
        return "✓";
      case "working":
      case "thinking":
        return (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case "error":
        return "✗";
      default:
        return "⋯";
    }
  };

  return (
    <div
      className={`relative flex-shrink-0 transition-all duration-300 ${
        isActive ? "scale-110" : "scale-100"
      }`}
    >
      <div
        className={`relative p-6 rounded-xl border-2 ${getStatusColor()} transition-all duration-300 min-w-[180px]`}
      >
        {/* Agent Number Badge */}
        <div className="absolute -top-3 -left-3 w-6 h-6 bg-gray-800 border-2 border-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>

        {/* Agent Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={`text-4xl ${
              agent.status === "working" || agent.status === "thinking"
                ? "animate-bounce"
                : ""
            }`}
          >
            {agent.emoji}
          </div>

          {/* Agent Name */}
          <div className="text-center">
            <div className="text-sm font-semibold text-white">{agent.name}</div>
            <div className="text-xs text-gray-400 capitalize mt-1">
              {agent.status}
            </div>
          </div>

          {/* Status Icon */}
          <div className="flex items-center justify-center w-6 h-6">
            {getStatusIcon()}
          </div>

          {/* Progress Bar */}
          {agent.progress !== undefined && agent.progress > 0 && (
            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${agent.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Thinking Bubble (when active) */}
        {isActive && agent.message && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white text-black text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            {agent.message}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}

function Arrow({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex-shrink-0">
      <svg
        className={`w-8 h-8 transition-colors ${
          isActive ? "text-blue-500" : "text-gray-700"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7l5 5m0 0l-5 5m5-5H6"
        />
      </svg>
    </div>
  );
}

function ActiveAgentDetails({ agent }: { agent: Agent }) {
  return (
    <div className="mt-6 p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{agent.emoji}</span>
        <div>
          <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
          <p className="text-sm text-gray-400 capitalize">{agent.status}</p>
        </div>
      </div>

      {agent.message && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-sm text-gray-300">{agent.message}</p>
        </div>
      )}
    </div>
  );
}

// Default agents configuration
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "github_analyzer",
    name: "GitHub Analyzer",
    emoji: "🔍",
    status: "idle",
  },
  {
    id: "context_analyzer",
    name: "Context Analyzer",
    emoji: "🧠",
    status: "idle",
  },
  {
    id: "dockerfile_generator",
    name: "Dockerfile Generator",
    emoji: "🐳",
    status: "idle",
  },
  {
    id: "terraform_generator",
    name: "Terraform Generator",
    emoji: "☁️",
    status: "idle",
  },
];
