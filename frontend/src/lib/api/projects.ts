/**
 * Projects API client
 */

import { apiCall } from "../api-client";

export interface Project {
  id: string;
  name: string;
  slug: string;
  repository_url: string;
  repository_name: string;
  installation_id?: number;
  language: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Generation {
  id: string;
  session_id: string;
  status: string;
  files: Record<string, unknown>[];
  created_at: string;
}

export const getUserProjectNamespace = (
  user: Record<string, unknown>
): string => {
  if (!user) return "user-projects";

  const firstName =
    (user as { firstName?: string; first_name?: string }).firstName ||
    (user as { firstName?: string; first_name?: string }).first_name;
  if (firstName) {
    return `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "")}-projects`;
  }

  const emailAddresses = (
    user as { emailAddresses?: { emailAddress: string }[] }
  ).emailAddresses;
  if (emailAddresses?.[0]?.emailAddress) {
    const emailUsername = emailAddresses[0].emailAddress.split("@")[0];
    return `${emailUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}-projects`;
  }

  return "user-projects";
};

export const projectsApi = {
  async importRepository(
    fullName: string,
    installationId: number
  ): Promise<Project | null> {
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

  async getProjects(): Promise<Project[]> {
    try {
      const response = await apiCall("/projects");

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.projects : [];
    } catch {
      return [];
    }
  },

  async getProject(
    slug: string
  ): Promise<{ project: Project; generations: Generation[] } | null> {
    try {
      const response = await apiCall(`/projects/${slug}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success
        ? { project: data.project, generations: data.generations }
        : null;
    } catch {
      return null;
    }
  },

  async getImportedRepositories(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiCall("/projects/repositories");

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.success ? data.repositories : [];
    } catch {
      return [];
    }
  },

  async getUserOverview(): Promise<Record<string, unknown>> {
    const projects = await this.getProjects();

    return {
      projects: {
        count: projects.length,
        items: projects,
      },
    };
  },
};
