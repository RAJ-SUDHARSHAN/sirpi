/**
 * Workflow API client for infrastructure generation.
 */

import { apiCall } from "../api-client";

export interface StartWorkflowRequest {
  repository_url: string;
  installation_id: number;
  template_type: "ecs-fargate" | "ec2" | "lambda";
  project_id?: string;
}

export interface StartWorkflowResponse {
  session_id: string;
  status: string;
  message: string;
  stream_url: string;
}

export interface WorkflowFile {
  filename: string;
  content: string;
  type: string;
}

export interface AgentLog {
  timestamp: string;
  agent: string;
  message: string;
  level: string;
}

export const workflowApi = {
  async startWorkflow(
    request: StartWorkflowRequest
  ): Promise<StartWorkflowResponse> {
    const response = await apiCall("/workflows/start", {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("Failed to start workflow");
    }

    return await response.json();
  },

  openWorkflowStream(sessionId: string): EventSource {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // EventSource doesn't support custom headers, so we use the test endpoint for now
    // TODO: Switch to authenticated endpoint with proper token passing
    const url = `${API_BASE}/api/v1/workflows/stream/${sessionId}`;

    return new EventSource(url);
  },

  async getWorkflowStatus(sessionId: string) {
    const response = await apiCall(`/workflows/status/${sessionId}`);

    if (!response.ok) {
      throw new Error("Failed to get workflow status");
    }

    return await response.json();
  },

  async getGenerationByProject(projectId: string) {
    const response = await apiCall(
      `/workflows/generation/by-project/${projectId}`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  },
};
