/**
 * Updated Project Detail Page
 * Connects to Bedrock AgentCore backend for infrastructure generation
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { apiCall } from "@/lib/api-client";
import {
  GitHubIcon,
  ExternalLinkIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  XCircleIcon,
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";
import { workflowApi } from "@/lib/api/workflow";
import { githubApi } from "@/lib/api/github";
import { pullRequestsApi } from "@/lib/api/pull-requests";
import { downloadFilesAsZip } from "@/lib/utils/download";
import FilePreviewTabs from "@/components/FilePreviewTabs";
import ProgressPipeline from "@/components/ProgressPipeline";
import NextStepsGuide from "@/components/NextStepsGuide";
import AWSSetupFlow from "@/components/AWSSetupFlow";
import toast from "react-hot-toast";

const INFRASTRUCTURE_TEMPLATES = [
  {
    id: "ecs-fargate",
    name: "ECS Fargate",
    description:
      "Serverless container deployment with auto-scaling and load balancer",
    provider: "AWS",
    features: ["Auto-scaling", "Load Balancer", "Container Registry", "VPC"],
    recommended: true,
  },
  {
    id: "ec2",
    name: "EC2 Auto Scaling",
    description: "Traditional auto-scaling web application on EC2 instances",
    provider: "AWS",
    features: ["EC2 Instances", "Auto Scaling", "Load Balancer", "EBS Storage"],
    recommended: false,
  },
  {
    id: "lambda",
    name: "Lambda API",
    description: "Serverless REST API with Lambda and API Gateway",
    provider: "AWS",
    features: ["Serverless", "API Gateway", "Pay-per-use", "Zero maintenance"],
    recommended: false,
  },
];

type WorkflowStatus =
  | "not_started"
  | "started"
  | "analyzing"
  | "generating"
  | "completed"
  | "failed";

interface WorkflowFile {
  filename: string;
  content: string;
  type: string;
}

interface AgentLog {
  timestamp: string;
  agent: string;
  message: string;
  level: string;
}

interface WorkflowState {
  status: WorkflowStatus;
  message: string;
  progress: number;
  error?: string;
  logs: AgentLog[];
  files: WorkflowFile[];
}

export default function ProjectPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;
  const projectSlug = params.projectSlug as string;

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoringState, setIsRestoringState] = useState(false);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("ecs-fargate");
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    status: "not_started",
    message: "Ready to generate infrastructure",
    progress: 0,
    logs: [],
    files: [],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [showAWSSetup, setShowAWSSetup] = useState(false);
  const [prInfo, setPrInfo] = useState<{
    pr_number: number;
    pr_url: string;
    branch: string;
  } | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  useEffect(() => {
    if (
      workflowState.status === "analyzing" ||
      workflowState.status === "generating" ||
      workflowState.status === "started"
    ) {
      setShowLogs(true);
    }
  }, [workflowState.status]);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [workflowState.logs, showLogs]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expectedNamespace = getUserProjectNamespace(user as any);
      if (userProjects !== expectedNamespace) {
        router.replace(`/${expectedNamespace}/${projectSlug}`);
        return;
      }
    }
  }, [user, userProjects, projectSlug, router]);

  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);

        const [overview, installation] = await Promise.all([
          projectsApi.getUserOverview(),
          githubApi.getInstallation(),
        ]);

        if (installation) {
          setInstallationId(installation.installation_id);
        }

        if (overview) {
          const foundProject = (
            overview as { projects: { items: Project[] } }
          ).projects.items.find((p: Project) => p.slug === projectSlug);

          if (foundProject) {
            setProject(foundProject);

            // Try to restore previous generation state
            await restoreGenerationState(foundProject.id);
          } else {
            router.push(`/${userProjects}`);
          }
        }
      } catch {
        router.push(`/${userProjects}`);
      } finally {
        setIsLoading(false);
      }
    }

    if (user && projectSlug && userProjects) {
      loadProject();
    }
  }, [user, projectSlug, userProjects, router]);

  const restoreGenerationState = async (projectId: string) => {
    try {
      setIsRestoringState(true);

      // Fetch both generation and project data to get complete state
      const [generation, projectData] = await Promise.all([
        workflowApi.getGenerationByProject(projectId),
        projectsApi.getProjectById(projectId),
      ]);

      if (!projectData) {
        setIsRestoringState(false);
        return; // Project not found
      }

      // Update project state with latest data
      setProject(projectData);

      if (generation) {
        // Store generation ID for PR creation  
        setGenerationId(generation.id);

        // Restore PR info if exists
        if (generation.pr_number && generation.pr_url && generation.pr_branch) {
          setPrInfo({
            pr_number: generation.pr_number,
            pr_url: generation.pr_url,
            branch: generation.pr_branch,
          });
        }

        // Restore state based on generation status
        if (generation.status === "completed") {
          const restoredFiles = Array.isArray(generation.files)
            ? generation.files
            : [];

          setWorkflowState((prev) => ({
            ...prev,
            status: "completed",
            message: "Infrastructure generated successfully!",
            progress: 100,
            logs: [],
            files: restoredFiles,
          }));
        } else if (generation.status === "failed") {
          setWorkflowState((prev) => ({
            ...prev,
            status: "failed",
            message: "Previous generation failed",
            progress: 0,
            logs: [],
            files: [],
            error: generation.error,
          }));
        } else {
          // In progress or other status - show as not started but preserve project deployment status
          setWorkflowState((prev) => ({
            ...prev,
            status: "not_started",
            message: "Ready to generate infrastructure",
            progress: 0,
            logs: [],
            files: [],
          }));
        }
      } else if (
        projectData.deployment_status === "pr_created" ||
        projectData.status === "pr_created"
      ) {
        // No generation found but project indicates PR was created
        // This means files were generated and PR was created, but generation record might be missing
        setWorkflowState((prev) => ({
          ...prev,
          status: "completed",
          message: "Infrastructure files generated and PR created!",
          progress: 100,
          logs: [],
          files: [], // Files might need to be regenerated
        }));
      } else {
        // No previous generation and no PR created
        setWorkflowState((prev) => ({
          ...prev,
          status: "not_started",
          message: "Ready to generate infrastructure",
          progress: 0,
          logs: [],
          files: [],
        }));
      }
    } catch (error) {
      // Ensure we don't leave in loading state on error
      setWorkflowState((prev) => ({
        ...prev,
        status: "not_started",
        message: "Ready to generate infrastructure",
        progress: 0,
        logs: [],
        files: [],
      }));
    } finally {
      setIsRestoringState(false);
    }
  };

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleStartGeneration = async () => {
    if (!project || !installationId) {
      setWorkflowState((prev) => ({
        ...prev,
        status: "failed",
        message: "Missing GitHub installation",
        error: "Please reconnect your GitHub account",
      }));
      return;
    }

    setIsGenerating(true);
    setShowLogs(true);
    setWorkflowState({
      status: "started",
      message: "Starting infrastructure generation...",
      progress: 5,
      logs: [],
      files: [],
    });

    try {
      const response = await workflowApi.startWorkflow({
        repository_url: project.repository_url,
        installation_id: installationId,
        template_type: selectedTemplate as "ecs-fargate" | "ec2" | "lambda",
        project_id: project.id,
      });

      const es = workflowApi.openWorkflowStream(response.session_id);
      setEventSource(es);

      es.addEventListener("status", (event) => {
        const data = JSON.parse(event.data);
        setWorkflowState((prev) => ({
          ...prev,
          status: data.status,
          message: data.message,
        }));
      });

      es.addEventListener("log", (event) => {
        const log = JSON.parse(event.data);
        setWorkflowState((prev) => ({
          ...prev,
          logs: [...prev.logs, log],
          progress: getProgressForAgent(log.agent),
        }));
      });

      es.addEventListener("complete", async (event) => {
        const data = JSON.parse(event.data);
        setWorkflowState((prev) => ({
          ...prev,
          status: data.status === "completed" ? "completed" : "failed",
          message:
            data.status === "completed"
              ? "Infrastructure generated successfully!"
              : "Generation failed",
          progress: 100,
          files: data.files || [],
          error: data.error,
        }));
        setIsGenerating(false);
        es.close();

        // Fetch generation ID after completion
        if (data.status === "completed" && project) {
          try {
            const generation = await workflowApi.getGenerationByProject(
              project.id
            );
            if (generation && generation.id) {
              setGenerationId(generation.id);
            }
          } catch (error) {
            // Silently continue if fetch fails
          }
        }
      });

      es.onerror = () => {
        setWorkflowState((prev) => ({
          ...prev,
          status: "failed",
          message: "Connection error",
          error: "Lost connection to server",
        }));
        setIsGenerating(false);
        es.close();
      };
    } catch (error) {
      setWorkflowState({
        status: "failed",
        message: "Failed to start generation",
        progress: 0,
        logs: [],
        files: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setIsGenerating(false);
    }
  };

  const getErrorGuidance = (error: string | undefined) => {
    if (!error) return null;

    if (error.includes("timeout") || error.includes("Timeout")) {
      return {
        cause: "Repository analysis timed out",
        suggestion: "Repository might be too large or complex",
        action: "Try with a smaller repository or contact support",
      };
    }

    if (error.includes("GitHub") || error.includes("installation")) {
      return {
        cause: "GitHub connection issue",
        suggestion: "Your GitHub App installation may need to be refreshed",
        action: "Reconnect your GitHub account",
      };
    }

    if (error.includes("Bedrock") || error.includes("Agent")) {
      return {
        cause: "AI agent processing error",
        suggestion: "Temporary service issue with Bedrock",
        action: "Please retry in a few moments",
      };
    }

    return {
      cause: "Generation failed",
      suggestion: error,
      action: "Try again or contact support if issue persists",
    };
  };

  const getProgressForAgent = (agent: string): number => {
    const progressMap: Record<string, number> = {
      orchestrator: 10,
      github_analyzer: 25,
      context_analyzer: 50,
      dockerfile_generator: 75,
      terraform_generator: 90,
    };
    return progressMap[agent] || 50;
  };

  const handleDownloadZip = async () => {
    if (!workflowState.files || workflowState.files.length === 0) return;

    await downloadFilesAsZip(
      workflowState.files,
      `${project?.name || "infrastructure"}-files.zip`
    );
  };

  const handleCreatePR = async () => {
    if (!project) {
      toast.error("Cannot create PR: Project not found");
      return;
    }

    if (!generationId) {
      toast.error(
        "Cannot create PR: No generation ID found. Please regenerate infrastructure."
      );
      return;
    }

    // Check if PR already exists by fetching current project data
    try {
      const currentProject = await projectsApi.getProjectById(project.id);
      if (currentProject?.deployment_status === "pr_created") {
        // PR already exists or deployment has started, just open it
        if (prInfo) {
          window.open(prInfo.pr_url, "_blank");
          return;
        }
      }
    } catch (error) {
      // Silently continue if check fails
    }

    if (prInfo) {
      // PR already exists, open it
      window.open(prInfo.pr_url, "_blank");
      return;
    }

    try {
      setIsCreatingPR(true);
      toast.loading("Creating pull request...", { id: "create-pr" });

      const result = await pullRequestsApi.createPR({
        project_id: project.id,
        generation_id: generationId,
        base_branch: "main",
      });

      setPrInfo({
        pr_number: result.pr_number,
        pr_url: result.pr_url,
        branch: result.branch,
      });

      // Refetch project data to get updated deployment_status
      try {
        const updatedProject = await projectsApi.getProjectById(project.id);
        if (updatedProject) {
          setProject(updatedProject);
        }
      } catch (error) {
        // Silently continue if refetch fails
      }

      toast.success(`Pull request #${result.pr_number} created successfully!`, {
        id: "create-pr",
        duration: 5000,
      });

      if (result.validation_warnings.length > 0) {
        toast(`Note: ${result.validation_warnings.length} warnings detected`, {
          icon: "⚠️",
          duration: 4000,
        });
      }

      // Open PR in new tab
      window.open(result.pr_url, "_blank");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create pull request",
        { id: "create-pr" }
      );
    } finally {
      setIsCreatingPR(false);
    }
  };

  const handleDeploy = () => {
    if (!project || !generationId) {
      toast.error("Cannot deploy: Missing project or generation data");
      return;
    }

    // Navigate to the dedicated deploy page for real-time logs
    router.push(`/${params.userProjects}/${params.projectSlug}/deploy`);
  };

  const handleSetupAWS = () => {
    setShowAWSSetup(true);
  };

  const handleAWSSetupComplete = async (roleArn: string) => {
    setShowAWSSetup(false);

    try {
      // Update project status to aws_verified
      if (project?.id) {
        const response = await apiCall(`/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            deployment_status: "aws_verified",
            aws_role_arn: roleArn,
          }),
        });

        if (response.ok) {
          // Refetch project data to ensure we have the latest deployment_status
          try {
            const updatedProject = await projectsApi.getProjectById(project.id);
            if (updatedProject) {
              setProject(updatedProject);
            }
          } catch (error) {
            // Still update local state as fallback
            setProject((prev) =>
              prev ? { ...prev, deployment_status: "aws_verified" } : null
            );
          }
          toast.success("AWS account connected successfully!");
        } else {
          toast.error("Failed to update project status");
        }
      }
    } catch (error) {
      toast.error("Failed to update project status");
    }
  };

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case "not_started":
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
      case "started":
      case "analyzing":
      case "generating":
        return (
          <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        );
      case "completed":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
  };

  if (!user || isLoading || isRestoringState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
          {isRestoringState && (
            <p className="text-gray-400">Restoring previous state...</p>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <button
            onClick={() => router.push(`/${userProjects}`)}
            className="px-6 py-3 bg-white text-black rounded-lg"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => router.push(`/${userProjects}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Projects
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {getStatusIcon(workflowState.status)}
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <GitHubIcon className="w-4 h-4" />
                <span>{project.repository_name}</span>
              </div>
              {project.language && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>{project.language}</span>
                </div>
              )}
              <span>{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {project.repository_url && (
            <a
              href={project.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <GitHubIcon className="w-4 h-4" />
              <span>Repository</span>
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          )}
        </div>

        {workflowState.status !== "not_started" && (
          <div className="mb-8 bg-black border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(workflowState.status)}
                <span className="font-medium">{workflowState.message}</span>
              </div>
              <span className="text-sm text-gray-400">
                {workflowState.progress}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  workflowState.status === "failed"
                    ? "bg-red-500"
                    : workflowState.status === "completed"
                    ? "bg-green-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${workflowState.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {workflowState.status === "not_started" && (
              <div className="bg-black border border-gray-800 rounded-lg p-8">
                <h2 className="text-xl font-semibold mb-3">
                  Choose Infrastructure Template
                </h2>
                <p className="text-gray-400 mb-8">
                  Select the deployment template that best fits your application
                </p>

                <div className="space-y-4 mb-8">
                  {INFRASTRUCTURE_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      className={`p-6 rounded-lg cursor-pointer transition-all border ${
                        selectedTemplate === template.id
                          ? "bg-gray-900 border-blue-500"
                          : "bg-gray-900/50 border-gray-700 hover:border-gray-600"
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium">
                              {template.name}
                            </h3>
                            {template.recommended && (
                              <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mb-3">
                            {template.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(template.features || []).map((feature) => (
                              <span
                                key={feature}
                                className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 ${
                            selectedTemplate === template.id
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-600"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartGeneration}
                  disabled={isGenerating}
                  className="w-full px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-3 font-medium"
                >
                  {isGenerating ? (
                    <>
                      <RefreshIcon className="w-5 h-5 animate-spin" />
                      <span>Starting Generation...</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-5 h-5" />
                      <span>Generate Infrastructure</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {(workflowState.status === "started" ||
              workflowState.status === "analyzing" ||
              workflowState.status === "generating") && (
              <ProgressPipeline
                workflowStatus={workflowState.status}
                currentMessage={workflowState.message}
              />
            )}

            {workflowState.status === "failed" && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <XCircleIcon className="w-6 h-6 text-red-400" />
                  <h3 className="text-lg font-medium text-red-400">
                    Generation Failed
                  </h3>
                </div>

                {(() => {
                  const guidance = getErrorGuidance(workflowState.error);
                  return guidance ? (
                    <div className="space-y-4">
                      <div className="bg-red-900/20 border border-red-500/20 rounded p-4">
                        <p className="text-sm text-red-200 mb-2">
                          <strong className="text-red-300">Problem:</strong>{" "}
                          {guidance.cause}
                        </p>
                        <p className="text-sm text-red-200 mb-2">
                          <strong className="text-red-300">Details:</strong>{" "}
                          {guidance.suggestion}
                        </p>
                        <p className="text-sm text-red-200">
                          <strong className="text-red-300">Action:</strong>{" "}
                          {guidance.action}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setWorkflowState({
                              status: "not_started",
                              message: "Ready to generate infrastructure",
                              progress: 0,
                              logs: [],
                              files: [],
                            });
                            setShowLogs(false);
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                          <RefreshIcon className="w-4 h-4" />
                          <span>Try Again</span>
                        </button>
                        <a
                          href="https://github.com/your-repo/sirpi/issues/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-900/20"
                        >
                          Report Issue
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-400 mb-4">
                        {workflowState.error || "An unexpected error occurred"}
                      </p>
                      <button
                        onClick={() => {
                          setWorkflowState({
                            status: "not_started",
                            message: "Ready to generate infrastructure",
                            progress: 0,
                            logs: [],
                            files: [],
                          });
                          setShowLogs(false);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <RefreshIcon className="w-4 h-4" />
                        <span>Try Again</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {workflowState.logs && workflowState.logs.length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-900/30 transition-colors"
                >
                  <h3 className="text-lg font-medium flex items-center gap-3">
                    <span>🤖</span>
                    <span>
                      AI Agent Logs ({(workflowState.logs || []).length})
                    </span>
                  </h3>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      showLogs ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showLogs && (
                  <div className="px-4 py-4 bg-black max-h-96 overflow-y-auto font-mono text-sm">
                    {(workflowState.logs || []).map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 mb-2 text-gray-300"
                      >
                        <span className="text-gray-500 text-xs min-w-[80px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`text-xs uppercase font-semibold min-w-[120px] ${
                            log.level === "ERROR"
                              ? "text-red-400"
                              : log.level === "THINKING"
                              ? "text-green-400"
                              : log.level === "SYSTEM"
                              ? "text-gray-500"
                              : log.agent === "orchestrator"
                              ? "text-blue-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {log.level === "SYSTEM"
                            ? `[${log.agent}]`
                            : `[${log.agent}]`}
                        </span>
                        <span
                          className={`flex-1 ${
                            log.level === "THINKING"
                              ? "text-green-300 italic"
                              : "text-gray-300"
                          }`}
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {workflowState.files && workflowState.files.length > 0 && (
              <FilePreviewTabs
                files={workflowState.files || []}
                onDownloadAll={handleDownloadZip}
              />
            )}

            {(workflowState.status === "completed" ||
              workflowState.files?.length > 0) && (
              <NextStepsGuide
                projectName={project?.name || "infrastructure"}
                onCreatePR={
                  workflowState.status === "completed" &&
                  !prInfo?.pr_url &&
                  !isCreatingPR
                    ? handleCreatePR
                    : undefined
                }
                onDeploy={
                  (project?.deployment_status === "aws_verified" ||
                    project?.deployment_status === "planned" ||
                    project?.deployment_status === "pr_created" ||
                    project?.deployment_status === "pr_merged" ||
                    project?.deployment_status === "ready_for_deployment") &&
                  !isCreatingPR &&
                  generationId
                    ? handleDeploy
                    : undefined
                }
                onSetupAWS={
                  !project?.deployment_status ||
                  project?.deployment_status === "not_deployed" ||
                  project?.deployment_status === "pr_created" ||
                  project?.deployment_status === "pr_merged" ||
                  project?.deployment_status === "ready_for_deployment" ||
                  project?.deployment_status === "aws_verified" ||
                  project?.deployment_status === "planned"
                    ? handleSetupAWS
                    : undefined
                }
                isCreatingPR={isCreatingPR}
                prUrl={prInfo?.pr_url || null}
                prCreated={
                  !!prInfo?.pr_url ||
                  project?.status === "pr_created" ||
                  project?.deployment_status === "ready_for_deployment"
                }
                projectStatus={project?.status || "pending"}
                deploymentStatus={project?.deployment_status || "not_deployed"}
                deploymentError={project?.deployment_error || null}
              />
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Project Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className="capitalize">
                    {workflowState.status.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Language</p>
                  <p>{project.language || "Not detected"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Template</p>
                  <p>
                    {INFRASTRUCTURE_TEMPLATES.find(
                      (t) => t.id === selectedTemplate
                    )?.name || "ECS Fargate"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Repository</p>
                  <p className="text-sm break-all">{project.repository_name}</p>
                </div>
              </div>
            </div>

            {selectedTemplate && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Template Info</h3>
                {(() => {
                  const template = INFRASTRUCTURE_TEMPLATES.find(
                    (t) => t.id === selectedTemplate
                  );
                  return template ? (
                    <div className="space-y-4">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-gray-400 text-sm">
                        {template.description}
                      </p>
                      <div>
                        <p className="text-sm text-gray-400 mb-3">Features:</p>
                        <div className="space-y-2">
                          {(template.features || []).map((feature) => (
                            <div
                              key={feature}
                              className="flex items-center gap-2"
                            >
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-gray-300">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <AWSSetupFlow
        isVisible={showAWSSetup}
        onComplete={handleAWSSetupComplete}
        onClose={() => setShowAWSSetup(false)}
        projectId={project?.id}
      />
    </div>
  );
}
