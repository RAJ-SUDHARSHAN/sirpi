"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { GitHubIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { githubApi, GitHubRepository } from "@/lib/api/github";
import { projectsApi, getUserProjectNamespace } from "@/lib/api/projects";
import { Notification } from "@/components/ui/notification";

export default function ImportRepoPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;
  const repoFullName = decodeURIComponent(params.repo as string);
  const [isClient, setIsClient] = useState(false);

  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

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
        router.replace(
          `/${expectedNamespace}/import/${encodeURIComponent(repoFullName)}`
        );
        return;
      }
    }
  }, [user, userProjects, router, isClient, repoFullName]);

  useEffect(() => {
    async function loadRepository() {
      try {
        setIsLoading(true);

        // Get installation
        const installation = await githubApi.getInstallation();
        if (!installation) {
          router.push(`/${userProjects}/import`);
          return;
        }

        setInstallationId(installation.installation_id);

        // Get repos
        const repos = await githubApi.getRepositories(
          installation.installation_id
        );
        const repo = repos.find((r) => r.full_name === repoFullName);

        if (repo) {
          setRepository(repo);
        } else {
          router.push(`/${userProjects}/import`);
        }
      } catch {
        router.push(`/${userProjects}/import`);
      } finally {
        setIsLoading(false);
      }
    }

    if (user && repoFullName) {
      loadRepository();
    }
  }, [user, repoFullName, router, userProjects]);

  const handleImport = async () => {
    if (!repository || !installationId || isImporting) return;

    try {
      setIsImporting(true);

      const project = await projectsApi.importRepository(
        repository.full_name,
        installationId
      );

      if (project) {
        setNotification({
          show: true,
          type: "success",
          title: "Project Created",
          message: `${repository.name} has been imported successfully.`,
        });

        // Redirect to projects dashboard
        setTimeout(() => {
          router.push(`/${userProjects}`);
        }, 1500);
      } else {
        setNotification({
          show: true,
          type: "error",
          title: "Import Failed",
          message: "Failed to import repository. Please try again.",
        });
        setIsImporting(false);
      }
    } catch {
      setNotification({
        show: true,
        type: "error",
        title: "Error",
        message: "An error occurred. Please try again.",
      });
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!repository) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        show={notification.show}
        onClose={() => setNotification({ ...notification, show: false })}
      />

      <div className="mb-8">
        <button
          onClick={() => router.push(`/${userProjects}/import`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Import
        </button>

        <h1 className="text-3xl font-bold text-white mb-4">
          Import Repository
        </h1>
      </div>

      <div
        className="bg-black rounded-lg p-8"
        style={{ border: "1px solid #3D3D3D" }}
      >
        {/* Repository Info */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
              <GitHubIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {repository.name}
              </h2>
              <p className="text-sm text-gray-400">{repository.full_name}</p>
            </div>
          </div>

          {repository.description && (
            <p className="text-gray-300 mb-4">{repository.description}</p>
          )}

          <div className="flex gap-4 text-sm text-gray-400">
            {repository.language && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                {repository.language}
              </span>
            )}
            <span>Default branch: {repository.default_branch}</span>
            {repository.private && <span>🔒 Private</span>}
          </div>
        </div>

        {/* Import Info */}
        <div className="mb-8 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-200">
            This will create a new project that you can deploy and manage
            infrastructure for.
          </p>
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={isImporting}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            isImporting
              ? "bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          {isImporting ? "Importing..." : "Import Repository"}
        </button>
      </div>
    </div>
  );
}
