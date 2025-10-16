"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  GitHubIcon,
  ExclamationCircleIcon,
  SearchIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { githubApi } from "@/lib/api/github";
import {
  projectsApi,
  Project,
  getUserProjectNamespace,
} from "@/lib/api/projects";

interface GitHubInstallation {
  installation_id: number;
}

interface UserOverview {
  projects: {
    count: number;
    items: Project[];
  };
}

export default function UserProjectsPage() {
  const { user } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;

  const [githubInstallation, setGithubInstallation] =
    useState<GitHubInstallation | null>(null);
  const [userOverview, setUserOverview] = useState<UserOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("activity");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Validate user namespace
  useEffect(() => {
    if (user && isClient) {
      const expectedNamespace = getUserProjectNamespace(
        user as unknown as Record<string, unknown>
      );
      if (userProjects !== expectedNamespace) {
        // Redirect to correct namespace
        router.replace(`/${expectedNamespace}`);
        return;
      }
    }
  }, [user, userProjects, router, isClient]);

  // Check URL params for errors
  useEffect(() => {
    if (!isClient) return;

    // Check for GitHub auth errors
    const errorParam = searchParams.get("error");
    if (errorParam === "github_auth_failed") {
      setError("Failed to connect to GitHub. Please try again.");
      // Remove the error parameter from URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Check for import success
    const importedParam = searchParams.get("imported");
    const createdParam = searchParams.get("created");
    if (importedParam === "true") {
      // Show success message (you can add a success state if needed)
      // Remove the imported parameter from URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (createdParam === "true") {
      // Show success message for project creation
      // Remove the created parameter from URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, isClient]);

  // Fetch GitHub installation status and user overview
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [installation, overview] = await Promise.all([
          githubApi.getInstallation(),
          projectsApi.getUserOverview(),
        ]);
        setGithubInstallation(installation);
        setUserOverview(overview as unknown as UserOverview);
      } catch {
        // Error is handled by the calling code
      } finally {
        setIsLoading(false);
      }
    }

    if (user && isClient) {
      fetchData();
    }
  }, [user, isClient]);

  // Filter and sort projects
  const filteredProjects =
    userOverview?.projects.items.filter(
      (project: Project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.repository_name &&
          project.repository_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()))
    ) || [];

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "created":
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case "updated":
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "activity":
      default:
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });

  const hasProjects = userOverview && userOverview.projects.count > 0;

  if (!user || isLoading || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error message for GitHub connection */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationCircleIcon className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="font-medium text-red-200">Connection Error</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar + Sort + Add New Row */}
      <div className="flex items-center gap-4 px-60">
        {/* Search Bar - Wide and Centered */}
        <div className="flex-1 relative">
          <SearchIcon
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
            style={{ color: "#A1A1A1" }}
          />
          <input
            type="text"
            placeholder="Search repositories and projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black rounded-lg text-white focus:outline-none transition-colors placeholder:text-[#A1A1A1]"
            style={{
              border: "1px solid #3D3D3D",
              color: "#FFFFFF",
            }}
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-black rounded-lg px-3 py-2 pr-8 text-white text-sm focus:outline-none transition-colors cursor-pointer"
            style={{
              border: "1px solid #3D3D3D",
            }}
          >
            <option value="activity">Sort by activity</option>
            <option value="name">Sort by name</option>
            <option value="created">Sort by created</option>
            <option value="updated">Sort by updated</option>
          </select>
          <ChevronDownIcon
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "#A1A1A1" }}
          />
        </div>

        {/* Add New Button */}
        <button
          onClick={() => router.push(`/${userProjects}/import`)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <PlusIcon className="w-4 h-4" />
          Add New...
        </button>
      </div>

      {/* Projects Grid or Empty State */}
      {hasProjects ? (
        <ProjectsGrid projects={sortedProjects} userNamespace={userProjects} />
      ) : (
        <EmptyState
          installation={githubInstallation}
          isLoading={isLoading}
          userNamespace={userProjects}
        />
      )}
    </div>
  );
}

function ProjectsGrid({
  projects,
  userNamespace,
}: {
  projects: Project[];
  userNamespace: string;
}) {
  return (
    <div className="px-60">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            userNamespace={userNamespace}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  userNamespace,
}: {
  project: Project;
  userNamespace: string;
}) {
  const router = useRouter();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "#22c55e"; // green
      case "generating":
      case "pending":
        return "#f59e0b"; // yellow
      case "failed":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "Ready";
      case "generating":
        return "Building";
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleProjectClick = () => {
    if (project.slug) {
      router.push(`/${userNamespace}/${project.slug}`);
    } else {
      // Fallback to old URL structure
      router.push(`/projects/${project.id}`);
    }
  };

  return (
    <div
      className="bg-black rounded-lg p-6 hover:border-gray-600 transition-colors cursor-pointer"
      style={{ border: "1px solid #3D3D3D" }}
      onClick={handleProjectClick}
    >
      {/* Project Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-white font-medium text-sm">{project.name}</h3>
            {project.repository_name && (
              <p className="text-xs text-gray-400">{project.repository_name}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${getStatusColor(project.status)}20`,
            color: getStatusColor(project.status),
          }}
        >
          {getStatusText(project.status)}
        </div>
      </div>

      {/* Project Info */}
      <div className="space-y-2">
        {project.language && (
          <p className="text-xs text-gray-400">{project.language}</p>
        )}

        <p className="text-xs text-gray-500">
          Created {formatDate(project.created_at)}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  installation,
  isLoading,
  userNamespace,
}: {
  installation: GitHubInstallation | null;
  isLoading: boolean;
  userNamespace: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Cloud Icon */}
      <div className="w-16 h-16 mb-6" style={{ color: "#A1A1A1" }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-full h-full"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* Title and Description */}
      <h2 className="text-xl font-semibold text-white mb-2">
        Deploy your first project
      </h2>
      <p className="mb-8 max-w-md" style={{ color: "#A1A1A1" }}>
        Start with one of our templates or create something new.
      </p>

      {/* Import Project Card - Vercel Style */}
      <div className="w-full max-w-md">
        <ImportProjectCard
          installation={installation}
          isLoading={isLoading}
          userNamespace={userNamespace}
        />
      </div>

      {/* Browse Templates Section */}
      <div className="mt-8 w-full max-w-md">
        <div
          className="bg-black rounded-lg p-4 hover:border-gray-600 transition-colors"
          style={{ border: "1px solid #3D3D3D" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-blue-500 rounded-sm flex items-center justify-center">
                  <span className="text-xs font-bold text-white">R</span>
                </div>
                <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center border border-gray-600">
                  <span className="text-xs font-bold text-white">S</span>
                </div>
                <div className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center">
                  <span className="text-xs font-bold text-white">V</span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-white" lang="en">
                  Browse Templates
                </div>
                <div className="text-xs" lang="en" style={{ color: "#A1A1A1" }}>
                  Start with AI projects, ecommerce, and more
                </div>
              </div>
            </div>
            <button
              style={{ color: "#A1A1A1" }}
              className="hover:text-white transition-colors"
            >
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportProjectCard({
  installation,
  isLoading,
  userNamespace,
}: {
  installation: GitHubInstallation | null;
  isLoading: boolean;
  userNamespace: string;
}) {
  const router = useRouter();
  const { user } = useUser();

  if (isLoading) {
    return (
      <div
        className="bg-black rounded-lg p-4"
        style={{ border: "1px solid #3D3D3D" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-800 rounded animate-pulse mb-2"></div>
            <div className="h-3 bg-gray-800 rounded animate-pulse w-2/3"></div>
          </div>
          <div className="w-16 h-8 bg-gray-800 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const handleImportClick = () => {
    if (!installation) {
      // Need to install GitHub App first
      if (!user || !user.id) {
        return;
      }

      const authUrl = githubApi.getAuthUrl(user.id);
      window.location.href = authUrl;
    } else {
      // Navigate to import page
      router.push(`/${userNamespace}/import`);
    }
  };

  return (
    <div
      className="bg-black rounded-lg p-4 transition-colors cursor-pointer"
      style={{
        border: installation ? "1px solid #22c55e" : "1px solid #3D3D3D",
        backgroundColor: installation ? "rgba(34, 197, 94, 0.05)" : "black",
      }}
      onClick={handleImportClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: installation
                ? "rgba(34, 197, 94, 0.2)"
                : "#374151",
            }}
          >
            <GitHubIcon
              className="w-4 h-4"
              style={{
                color: installation ? "#22c55e" : "#A1A1A1",
              }}
            />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              {installation ? "Select Repositories" : "Import Project"}
            </div>
            <div className="text-xs" style={{ color: "#A1A1A1" }}>
              {installation
                ? "Choose repos to create projects from"
                : "Add a repo from your git provider"}
            </div>
          </div>
        </div>
        <button
          className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            border: installation ? "1px solid #22c55e" : "1px solid #FFFFFF",
            backgroundColor: "transparent",
            color: installation ? "#22c55e" : "#FFFFFF",
          }}
        >
          {installation ? "Select" : "Import"}
        </button>
      </div>
    </div>
  );
}
