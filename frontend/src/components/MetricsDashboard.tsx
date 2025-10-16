"use client";

import React from "react";

interface Metric {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
}

interface MetricsDashboardProps {
  metrics: Metric[];
  title?: string;
}

export function MetricsDashboard({
  metrics,
  title = "Impact Metrics",
}: MetricsDashboardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-black border border-gray-800 rounded-xl p-6">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <span>📊</span>
          {title}
        </h3>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const getTrendColor = () => {
    switch (metric.trend) {
      case "up":
        return "text-green-400";
      case "down":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getTrendIcon = () => {
    switch (metric.trend) {
      case "up":
        return "↑";
      case "down":
        return "↓";
      default:
        return "→";
    }
  };

  return (
    <div className="group relative p-5 bg-gray-900/70 border border-gray-800 rounded-lg hover:border-gray-700 transition-all hover:scale-105">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative">
        {/* Icon */}
        <div className="text-3xl mb-3">{metric.icon}</div>

        {/* Label */}
        <div className="text-sm text-gray-400 mb-2">{metric.label}</div>

        {/* Value */}
        <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>

        {/* Change/Trend */}
        {metric.change && (
          <div
            className={`text-sm font-medium ${getTrendColor()} flex items-center gap-1`}
          >
            <span>{getTrendIcon()}</span>
            <span>{metric.change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Preset metrics for different scenarios
export const DEFAULT_METRICS: Metric[] = [
  {
    label: "Time Saved",
    value: "4.5 days",
    change: "vs manual setup",
    trend: "up",
    icon: "⚡",
  },
  {
    label: "Estimated Cost",
    value: "$73/mo",
    change: "45% cheaper",
    trend: "up",
    icon: "💰",
  },
  {
    label: "Success Rate",
    value: "98%",
    change: "+2% this month",
    trend: "up",
    icon: "✓",
  },
  {
    label: "Files Generated",
    value: "8",
    change: "Production-ready",
    trend: "neutral",
    icon: "📄",
  },
];

export const DEPLOYMENT_METRICS: Metric[] = [
  {
    label: "Deploy Time",
    value: "7 min",
    change: "5x faster",
    trend: "up",
    icon: "🚀",
  },
  {
    label: "Uptime",
    value: "99.9%",
    change: "Last 30 days",
    trend: "neutral",
    icon: "⏱️",
  },
  {
    label: "Requests",
    value: "2.4M",
    change: "+12% today",
    trend: "up",
    icon: "📈",
  },
  {
    label: "Latency",
    value: "45ms",
    change: "-15ms improved",
    trend: "up",
    icon: "⚡",
  },
];
