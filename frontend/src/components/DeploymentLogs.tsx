"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface DeploymentLogsProps {
  sessionId: string;
  isVisible: boolean;
}

interface LogEntry {
  timestamp: string;
  level: "INFO" | "ERROR" | "WARN" | "DEBUG";
  message: string;
  source?: string;
}

export default function DeploymentLogs({
  sessionId,
  isVisible,
}: DeploymentLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const connectToLogs = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `/api/v1/deployments/stream/${sessionId}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("Connected to deployment logs");
    };

    eventSource.onmessage = (event) => {
      try {
        const logEntry: LogEntry = JSON.parse(event.data);

        setLogs((prev) => {
          const newLogs = [...prev, logEntry];
          // Keep only last 1000 logs to prevent memory issues
          return newLogs.slice(-1000);
        });
      } catch (error) {
        console.error("Failed to parse log entry:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      setIsConnected(false);
    };
  }, [sessionId]);

  const disconnectFromLogs = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    if (isVisible && sessionId) {
      connectToLogs();
    }

    return () => {
      disconnectFromLogs();
    };
  }, [isVisible, sessionId, connectToLogs]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const getLogLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "ERROR":
        return "text-red-400";
      case "WARN":
        return "text-yellow-400";
      case "DEBUG":
        return "text-gray-400";
      default:
        return "text-gray-200";
    }
  };

  const getLogLevelBadge = (level: LogEntry["level"]) => {
    switch (level) {
      case "ERROR":
        return "bg-red-500/20 text-red-400";
      case "WARN":
        return "bg-yellow-500/20 text-yellow-400";
      case "DEBUG":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-blue-500/20 text-blue-400";
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="border border-gray-800 rounded-lg bg-black/60 backdrop-blur-sm overflow-hidden">
      <div className="border-b border-gray-800/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white">Deployment Logs</h3>
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-400" : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{logs.length} entries</span>
          <button
            onClick={clearLogs}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="p-4 h-96 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isConnected
              ? "Waiting for deployment logs..."
              : "Connect to view deployment logs"}
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 flex items-start gap-2">
              <span className="text-gray-500 flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${getLogLevelBadge(
                  log.level
                )}`}
              >
                {log.level}
              </span>
              {log.source && (
                <span className="text-purple-400 flex-shrink-0">
                  {log.source}
                </span>
              )}
              <span className={`flex-1 ${getLogLevelColor(log.level)}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {!isConnected && (
        <div className="border-t border-gray-800/50 px-4 py-2">
          <button
            onClick={connectToLogs}
            className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors"
          >
            Reconnect to Logs
          </button>
        </div>
      )}
    </div>
  );
}
