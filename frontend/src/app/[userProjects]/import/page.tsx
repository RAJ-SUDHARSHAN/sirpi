"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { GitHubIcon, SearchIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { Notification } from "@/components/ui/notification";
import {
  githubApi,
  GitHubRepository,
  ImportedRepository,
} from "@/lib/api/github";
import { getUserProjectNamespace } from "@/lib/api/projects";
import { GITHUB_CONFIG } from "@/lib/config/github";

export default function ImportProjectPage() {
  const { user, isLoaded } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showNotification, setShowNotification] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [importedRepositories, setImportedRepositories] = useState<
    ImportedRepository[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const userProjects = params.userProjects as string;
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
        router.replace(`/${expectedNamespace}/import`);
        return;
      }
    }
  }, [user, userProjects, router, isClient]);

  useEffect(() => {
    const githubConnected = searchParams.get("github_connected");
    if (githubConnected === "true") {
      setShowNotification(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadGitHubData() {
      if (!user) return;

      try {
        setIsLoading(true);
        const status = await githubApi.getConnectionStatus();
        setHasConnection(status.hasApp);
        setIsLoading(false);

        if (status.hasApp) {
          setIsLoadingRepos(true);
          const [reposFromGitHub, importedRepos] = await Promise.all([
            githubApi.getRepositoriesSmart(),
            githubApi.getImportedRepositories(),
          ]);
          setRepositories(reposFromGitHub);
          setImportedRepositories(importedRepos);
          setIsLoadingRepos(false);
        }
      } catch {
        setHasConnection(false);
        setIsLoading(false);
      }
    }

    if (user) {
      loadGitHubData();
    }
  }, [user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {showNotification && (
        <Notification
          type="success"
          title="GitHub Connected Successfully"
          message="You can now import repositories from your GitHub account."
          show={showNotification}
          onClose={() => setShowNotification(false)}
        />
      )}

      <div className="mb-8">
        <button
          onClick={() => router.push(`/${userProjects}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Projects
        </button>

        <h1 className="text-3xl font-bold text-white mb-4">
          Import Git Repository
        </h1>
        <p className="text-lg" style={{ color: "#A1A1A1" }}>
          Select repositories from your GitHub account to create new projects.
        </p>
      </div>

      <div
        className="bg-black rounded-lg p-8"
        style={{ border: "1px solid #3D3D3D" }}
      >
        {isLoading ? (
          <LoadingState />
        ) : !hasConnection ? (
          <ConnectGitHub user={user as unknown as Record<string, unknown>} />
        ) : (
          <RepositoryList
            repositories={filteredRepositories}
            importedRepositories={importedRepositories}
            isLoadingRepos={isLoadingRepos}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            userProjects={userProjects}
          />
        )}

        <div className="mt-12">
          <p style={{ color: "#A1A1A1" }} className="text-sm">
            Missing repositories?{" "}
            <a
              href={GITHUB_CONFIG.SETTINGS_INSTALLATIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              Adjust GitHub App Permissions →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <h2 className="text-xl font-semibold text-white mb-4">
        Checking GitHub connection...
      </h2>
    </div>
  );
}

function ConnectGitHub({ user }: { user: Record<string, unknown> }) {
  const handleInstall = () => {
    if (!user || !(user as { id?: string }).id) {
      alert("User not loaded");
      return;
    }

    const url = githubApi.getAuthUrl((user as { id?: string }).id);
    window.location.href = url;
  };

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
        <GitHubIcon className="w-8 h-8" style={{ color: "#A1A1A1" }} />
      </div>
      <h2 className="text-xl font-semibold text-white mb-4">
        Install Sirpi GitHub App
      </h2>
      <p className="mb-8 max-w-md mx-auto" style={{ color: "#A1A1A1" }}>
        Install the GitHub App to analyze repositories and generate
        infrastructure.
      </p>

      <button
        onClick={handleInstall}
        disabled={!user?.id}
        className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
      >
        <GitHubIcon className="w-5 h-5" />
        Install GitHub App
      </button>
    </div>
  );
}

function RepositoryList({
  repositories,
  importedRepositories,
  isLoadingRepos,
  searchQuery,
  setSearchQuery,
  userProjects,
}: {
  repositories: GitHubRepository[];
  importedRepositories: ImportedRepository[];
  isLoadingRepos: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userProjects: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
          <GitHubIcon className="w-4 h-4 text-green-400" />
        </div>
        <div>
          <div className="text-white font-medium">GitHub App Connected</div>
          <div className="text-sm" style={{ color: "#A1A1A1" }}>
            Select repositories to import
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <SearchIcon
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
          style={{ color: "#A1A1A1" }}
        />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-black rounded-lg text-white focus:outline-none placeholder:text-[#A1A1A1]"
          style={{ border: "1px solid #3D3D3D" }}
        />
      </div>

      <div className="space-y-3">
        {isLoadingRepos ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : repositories.length === 0 ? (
          <div className="text-center py-8">
            <p style={{ color: "#A1A1A1" }}>No repositories found.</p>
          </div>
        ) : (
          repositories.map((repo) => (
            <RepoCard
              key={repo.id}
              repository={repo}
              isImported={importedRepositories.some(
                (imp) => imp.github_id === repo.id.toString()
              )}
              userProjects={userProjects}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="p-4 rounded-lg animate-pulse"
      style={{ border: "1px solid #3D3D3D" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 bg-gray-800 rounded"></div>
        <div>
          <div className="h-4 bg-gray-800 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-800 rounded w-48"></div>
        </div>
      </div>
    </div>
  );
}

function RepoCard({
  repository,
  isImported,
  userProjects,
}: {
  repository: GitHubRepository;
  isImported: boolean;
  userProjects: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!isImported) {
      router.push(
        `/${userProjects}/import/${encodeURIComponent(repository.full_name)}`
      );
    }
  };

  return (
    <div
      className="p-4 rounded-lg transition-colors hover:border-gray-600 cursor-pointer"
      style={{
        border: isImported ? "1px solid #22c55e" : "1px solid #3D3D3D",
        backgroundColor: isImported ? "rgba(34, 197, 94, 0.05)" : "transparent",
      }}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {repository.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">
              {repository.name}
            </h3>
            {repository.description && (
              <p className="text-sm mt-1 truncate" style={{ color: "#A1A1A1" }}>
                {repository.description}
              </p>
            )}
            <div
              className="flex gap-4 mt-2 text-xs"
              style={{ color: "#A1A1A1" }}
            >
              {repository.language && <span>{repository.language}</span>}
              <span>
                Updated {new Date(repository.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          disabled={isImported}
          className={`px-4 py-2 text-sm font-medium rounded-lg ml-4 ${
            isImported
              ? "bg-green-500/20 text-green-400 cursor-not-allowed"
              : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          {isImported ? "Imported" : "Import"}
        </button>
      </div>
    </div>
  );
}
