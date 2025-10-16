/**
 * Pull Request API Client
 */

import { apiCall } from "../api-client";

export interface CreatePRRequest {
  project_id: string;
  generation_id: string;
  base_branch?: string;
}

export interface CreatePRResponse {
  pr_number: number;
  pr_url: string;
  branch: string;
  validation_warnings: string[];
}

export interface PRStatus {
  pr_number: number;
  pr_url: string;
  state: "open" | "closed";
  merged: boolean;
  mergeable: boolean | null;
  created_at: string;
  updated_at: string;
}

export const pullRequestsApi = {
  /**
   * Create a GitHub PR with generated infrastructure files
   */
  async createPR(request: CreatePRRequest): Promise<CreatePRResponse> {
    const response = await apiCall("/pull-requests/create", {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Failed to create PR" }));
      throw new Error(error.detail || "Failed to create PR");
    }

    return response.json();
  },

  /**
   * Get PR status for a project
   */
  async getPRStatus(projectId: string): Promise<PRStatus> {
    const response = await apiCall(`/pull-requests/${projectId}/status`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Failed to get PR status" }));
      throw new Error(error.detail || "Failed to get PR status");
    }

    return response.json();
  },
};
