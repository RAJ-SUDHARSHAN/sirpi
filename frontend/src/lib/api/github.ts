/**
 * GitHub API client
 */

import { apiCall } from "../api-client";
import { getGitHubAppInstallationUrl } from "../config/github";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export interface ImportedRepository {
  id: string;
  github_id: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  default_branch: string;
  user_id: string;
  created_at: string;
}

export const githubApi = {
  getAuthUrl: (userId: string | undefined) => {
    if (!userId) {
      return getGitHubAppInstallationUrl("ERROR");
    }
    return getGitHubAppInstallationUrl(userId);
  },

  async getInstallation(): Promise<{ installation_id: number } | null> {
    try {
      const response = await apiCall("/github/installation");
      if (!response.ok) return null;

      const data = await response.json();
      return data.connected ? { installation_id: data.installation_id } : null;
    } catch {
      return null;
    }
  },

  async getRepositories(installationId: number): Promise<GitHubRepository[]> {
    try {
      const response = await apiCall(`/github/repos/${installationId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch repos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.repositories || [];
    } catch {
      return [];
    }
  },

  async getRepositoriesSmart(): Promise<GitHubRepository[]> {
    const installation = await this.getInstallation();
    if (!installation) return [];
    return await this.getRepositories(installation.installation_id);
  },

  async getConnectionStatus(): Promise<{
    hasOAuth: boolean;
    hasApp: boolean;
    recommended: "app";
  }> {
    const installation = await this.getInstallation();
    return {
      hasOAuth: false,
      hasApp: !!installation,
      recommended: "app",
    };
  },

  async getImportedRepositories(): Promise<ImportedRepository[]> {
    try {
      const response = await apiCall("/projects/repositories");
      if (!response.ok) return [];

      const data = await response.json();
      return data.success ? data.repositories : [];
    } catch {
      return [];
    }
  },

  async importRepository(
    fullName: string,
    installationId: number
  ): Promise<ImportedRepository | null> {
    try {
      const response = await apiCall("/projects/import", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          installation_id: installationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to import: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.project : null;
    } catch {
      return null;
    }
  },
};
