// Workflow API client for infrastructure deployment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Declare Clerk global type
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>;
      };
    };
  }
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
  // For client-side usage
  if (typeof window !== "undefined") {
    const token = await window.Clerk?.session?.getToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // For server-side usage
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { getToken } = await auth();
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  } catch {
    return {
      "Content-Type": "application/json",
    };
  }
};

// Types for workflow API
export interface StartWorkflowRequest {
  project_id: number;
  template_name?: string;
  force_reconnect?: boolean;
}

export interface WorkflowStatusResponse {
  success: boolean;
  project_id?: number;
  status?: string;
  infrastructure_branch?: string;
  commit_sha?: string;
  analysis_results?: Record<string, unknown>;
  tools_used?: string[];
  created_at?: string;
  updated_at?: string;
  error?: string;
}

export interface ComposioConnectionResponse {
  connected: boolean;
  entity_id?: string;
  connection_id?: string;
  status?: string;
  connected_at?: string;
  error?: string;
}

export interface WorkflowEvent {
  type: string;
  message?: string;
  content?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface ProjectWorkflowData {
  success: boolean;
  project_id?: number;
  project_name?: string;
  status?: string;
  events: WorkflowEvent[];
  perplexity_analysis: string;
  generated_files: Record<string, string>;
  github_urls: Record<string, string>;
  infrastructure_branch?: string;
  deployment_commit_sha?: string;
  error?: string;
}

// Workflow API client
export const workflowApi = {
  // Start infrastructure workflow
  async startInfrastructureWorkflow(request: StartWorkflowRequest): Promise<{
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/start-infrastructure`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(request),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error starting infrastructure workflow:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Get project workflow data
  async getProjectWorkflowData(
    projectSlug: string
  ): Promise<ProjectWorkflowData> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/project-workflow/${projectSlug}`,
        { headers }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching project workflow data:", error);
      return {
        success: false,
        events: [],
        perplexity_analysis: "",
        generated_files: {},
        github_urls: {},
        error: "Network error occurred",
      };
    }
  },

  // Get workflow status
  async getWorkflowStatus(projectId: number): Promise<{
    success: boolean;
    data?: WorkflowStatusResponse;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/status/${projectId}`,
        {
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting workflow status:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Get Composio connection status
  async getComposioConnectionStatus(): Promise<{
    success: boolean;
    data?: ComposioConnectionResponse;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/status`,
        {
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting Composio connection status:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Connect to Composio (non-blocking)
  async connectComposio(): Promise<{
    success: boolean;
    redirect_url?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/connect`,
        {
          method: "POST",
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error connecting to Composio:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Connect to Composio (blocking - waits for completion)
  async connectComposioBlocking(): Promise<{
    success: boolean;
    connection_id?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/connect-and-wait`,
        {
          method: "POST",
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error connecting to Composio (blocking):", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Disconnect from Composio
  async disconnectComposio(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/disconnect`,
        {
          method: "DELETE",
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error disconnecting from Composio:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Get Composio auth URL
  async getComposioAuthUrl(): Promise<{
    success: boolean;
    already_connected?: boolean;
    auth_url?: string;
    connection_id?: string;
    message?: string;
    instructions?: string;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/auth-url`,
        {
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting Composio auth URL:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },

  // Check Composio auth completion
  async checkComposioAuthCompletion(): Promise<{
    success: boolean;
    connected?: boolean;
    connection_id?: string;
    status?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/workflow/composio/check-auth`,
        {
          method: "POST",
          headers,
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking Composio auth completion:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  },
};
