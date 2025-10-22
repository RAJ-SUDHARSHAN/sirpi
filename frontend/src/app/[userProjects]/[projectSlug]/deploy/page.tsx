"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useDeploymentPolling } from "@/hooks/useDeploymentPolling";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { ansiToHtml } from "@/lib/utils/ansi-to-html";
import {
  XCircleIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";
import toast from "react-hot-toast";
import AWSSetupFlow from "@/components/AWSSetupFlow";
import SirpiAssistant from "@/components/SirpiAssistant";
import { apiCall } from "@/lib/api-client";

type DeploymentStep =
  | "not_started"
  | "building"
  | "built"
  | "planning"
  | "planned"
  | "deploying"
  | "deployed"
  | "failed";

interface DeploymentState {
  currentStep: DeploymentStep;
  imagePushed: boolean;
  planGenerated: boolean;
  deployed: boolean;
  operationId: string | null;
  isStreaming: boolean;
  error: string | null;
}

interface CollapsibleSection {
  id: string;
  title: string;
  logs: string[];
  status: "idle" | "running" | "success" | "error";
  duration?: string;
  isExpanded: boolean;
}

interface LogRecord {
  operation_type: string;
  logs?: string[];
  status: string;
  duration_seconds?: number;
}

interface ClerkWindow {
  Clerk?: {
    session?: {
      getToken: () => Promise<string>;
    };
  };
}

export default function DeployPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;
  const projectSlug = params.projectSlug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({
    currentStep: "not_started",
    imagePushed: false,
    planGenerated: false,
    deployed: false,
    operationId: null,
    isStreaming: false,
    error: null,
  });
  const [sections, setSections] = useState<CollapsibleSection[]>([
    {
      id: "build",
      title: "Build Logs",
      logs: [],
      status: "idle",
      isExpanded: false,
    },
    {
      id: "plan",
      title: "Deployment Summary",
      logs: [],
      status: "idle",
      isExpanded: false,
    },
    {
      id: "deploy",
      title: "Deployment Logs",
      logs: [],
      status: "idle",
      isExpanded: false,
    },
  ]);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [isDestroying, setIsDestroying] = useState(false);
  const [showAWSSetup, setShowAWSSetup] = useState(false);

  // Refs for each section's log container
  const sectionLogRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const operationStartTime = useRef<number | null>(null);
  const [activeOperationType, setActiveOperationType] = useState<'build_image' | 'plan' | 'apply' | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Auto-scroll within the active section's log container only
  useEffect(() => {
    if (activeSectionId && sectionLogRefs.current[activeSectionId]) {
      const logContainer = sectionLogRefs.current[activeSectionId];
      if (logContainer) {
        // Scroll to bottom of the log container, not the page
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.flatMap(s => s.logs).length, activeSectionId]); // Trigger on log count change

  useEffect(() => {
    if (user) {
      const expectedNamespace = getUserProjectNamespace(
        user as { username?: string; firstName?: string; id: string }
      );
      if (userProjects !== expectedNamespace) {
        router.replace(`/${expectedNamespace}/${projectSlug}/deploy`);
        return;
      }
    }
  }, [user, userProjects, projectSlug, router]);

  const loadProject = useCallback(async () => {
    try {
      setIsLoading(true);
      const overview = await projectsApi.getUserOverview();
      if (overview) {
        const userOverview = overview as { projects: { items: Project[] } };
        const foundProject = userOverview.projects.items.find(
          (p) =>
            p.slug === projectSlug ||
            p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === projectSlug
        );

        if (foundProject) {
          console.log("[LoadProject] Found project:", foundProject.name);
          console.log(
            "[LoadProject] Deployment status:",
            foundProject.deployment_status
          );
          console.log(
            "[LoadProject] Application URL:",
            foundProject.application_url
          );
          setProject(foundProject);

          // Set deployment state based on project status
          if (foundProject.deployment_status === "deployed") {
            console.log("[LoadProject] Setting deployed state to true");
            setDeploymentState((prev) => ({
              ...prev,
              currentStep: "deployed",
              imagePushed: true,
              planGenerated: true,
              deployed: true,
            }));
          }

          // Load previous deployment logs from database
          try {
            const token = await (
              window as unknown as ClerkWindow
            ).Clerk?.session?.getToken();
            const logsResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/deployment/projects/${foundProject.id}/logs`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (logsResponse.ok) {
              const logsData = await logsResponse.json();
              if (logsData.success && logsData.data.logs.length > 0) {
                const sectionMap: Record<string, string> = {
                  build_image: "build",
                  plan: "plan",
                  apply: "deploy",
                  destroy: "destroy",
                };

                const initialSections: CollapsibleSection[] = [
                  {
                    id: "build",
                    title: "Build Logs",
                    logs: [],
                    status: "idle",
                    isExpanded: false,
                  },
                  {
                    id: "plan",
                    title: "Deployment Summary",
                    logs: [],
                    status: "idle",
                    isExpanded: false,
                  },
                  {
                    id: "deploy",
                    title: "Deployment Logs",
                    logs: [],
                    status: "idle",
                    isExpanded: false,
                  },
                ];

                const restoredSections = [...initialSections];

                logsData.data.logs.forEach((logRecord: LogRecord) => {
                  const sectionId = sectionMap[logRecord.operation_type];
                  if (sectionId) {
                    const sectionIndex = restoredSections.findIndex(
                      (s) => s.id === sectionId
                    );
                    if (sectionIndex >= 0) {
                      restoredSections[sectionIndex] = {
                        ...restoredSections[sectionIndex],
                        logs: logRecord.logs || [],
                        status:
                          logRecord.status === "success"
                            ? "success"
                            : logRecord.status === "error"
                            ? "error"
                            : "idle",
                        duration: logRecord.duration_seconds
                          ? `${logRecord.duration_seconds}s`
                          : undefined,
                        isExpanded: false,
                      };
                    }
                  }
                });

                setSections(restoredSections);

                const hasCompletedBuild = logsData.data.logs.some(
                  (l: LogRecord) =>
                    l.operation_type === "build_image" && l.status === "success"
                );
                const hasCompletedPlan = logsData.data.logs.some(
                  (l: LogRecord) =>
                    l.operation_type === "plan" && l.status === "success"
                );
                const hasCompletedDeploy = logsData.data.logs.some(
                  (l: LogRecord) =>
                    l.operation_type === "apply" && l.status === "success"
                );

                if (hasCompletedDeploy) {
                  setDeploymentState((prev) => ({
                    ...prev,
                    currentStep: "deployed",
                    imagePushed: true,
                    planGenerated: true,
                    deployed: true,
                  }));
                } else if (hasCompletedPlan) {
                  setDeploymentState((prev) => ({
                    ...prev,
                    currentStep: "planned",
                    imagePushed: true,
                    planGenerated: true,
                  }));
                } else if (hasCompletedBuild) {
                  setDeploymentState((prev) => ({
                    ...prev,
                    currentStep: "built",
                    imagePushed: true,
                  }));
                }
              }
            }
          } catch (logError) {
            console.error("Failed to load deployment logs:", logError);
          }

          const canDeploy =
            foundProject.deployment_status === "aws_verified" ||
            foundProject.deployment_status === "deployed" ||
            foundProject.deployment_status === "completed" ||
            foundProject.status === "pr_merged";

          if (!canDeploy) {
            router.push(`/${userProjects}/${projectSlug}`);
            return;
          }
        } else {
          router.push(`/${userProjects}`);
        }
      }
    } catch {
      router.push(`/${userProjects}`);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, userProjects, router]);

  useEffect(() => {
    if (projectSlug && userProjects) {
      loadProject();
    }
  }, [loadProject, projectSlug, userProjects]);

  // Polling hook for deployment logs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isPolling, stopPolling } = useDeploymentPolling({
    operationId: deploymentState.operationId,
    enabled: deploymentState.isStreaming && !!activeSectionId,
    onLog: (message: string) => {
      if (activeSectionId) {
        addLogToSection(activeSectionId, message.trim());
      }
    },
    onComplete: (status, error) => {
      handleOperationComplete(status, error);
    },
  });

  const toggleSection = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
      )
    );
  };

  const addLogToSection = (sectionId: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              logs: [...s.logs, `[${timestamp}] ${message}`],
              status: "running" as const,
              isExpanded: true,
            }
          : s
      )
    );
  };

  const updateSectionStatus = (
    sectionId: string,
    status: "idle" | "running" | "success" | "error",
    duration?: string
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, status, duration } : s))
    );
  };

  const startOperation = async (
    operation: "build_image" | "plan" | "apply"
  ) => {
    if (!project) return;

    const sectionMap = {
      build_image: "build",
      plan: "plan",
      apply: "deploy",
    };
    const sectionId = sectionMap[operation];

    const stepMap = {
      build_image: "building",
      plan: "planning",
      apply: "deploying",
    } as const;

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, logs: [], status: "running" as const, isExpanded: true }
          : s
      )
    );

    setDeploymentState((prev) => ({
      ...prev,
      currentStep: stepMap[operation],
      isStreaming: true,
      error: null,
    }));

    operationStartTime.current = Date.now();

    try {
      const token = await (
        window as unknown as ClerkWindow
      ).Clerk?.session?.getToken();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/deployment/projects/${project.id}/${operation}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success && data.data.operation_id) {
        setDeploymentState((prev) => ({
          ...prev,
          operationId: data.data.operation_id,
        }));
        setActiveOperationType(operation);
        setActiveSectionId(sectionId);
        addLogToSection(sectionId, "🔗 Connected to deployment stream");
      } else {
        throw new Error(data.errors?.[0] || `Failed to start ${operation}`);
      }
    } catch (error) {
      setDeploymentState((prev) => ({
        ...prev,
        currentStep: "failed",
        error: String(error),
        isStreaming: false,
      }));
      updateSectionStatus(sectionId, "error");
      toast.error(`Failed to start ${operation}`);
    }
  };

  const handleOperationComplete = (status: 'completed' | 'failed', error?: string) => {
    const sectionId = activeSectionId;
    const operation = activeOperationType;
    
    if (!sectionId || !operation) return;
    
    const duration = operationStartTime.current
      ? `${Math.round((Date.now() - operationStartTime.current) / 1000)}s`
      : undefined;

    if (status === "completed") {
      updateSectionStatus(sectionId, "success", duration);

      setDeploymentState((prev) => {
        const updates: Partial<DeploymentState> = { isStreaming: false };

        if (operation === "build_image") {
          updates.currentStep = "built";
          updates.imagePushed = true;
        } else if (operation === "plan") {
          updates.currentStep = "planned";
          updates.planGenerated = true;
        } else if (operation === "apply") {
          updates.currentStep = "deployed";
          updates.deployed = true;

          // Refetch project to get terraform outputs
          console.log(
            "[Deploy] Deployment complete, fetching updated project data..."
          );
          setTimeout(async () => {
            try {
              if (project?.id) {
                console.log("[Deploy] Fetching project by ID:", project.id);
                const updatedProject = await projectsApi.getProjectById(
                  project.id
                );
                if (updatedProject) {
                  console.log(
                    "[Deploy] Updated project terraform_outputs:",
                    updatedProject.terraform_outputs
                  );
                  setProject(updatedProject);
                  console.log(
                    "[Deploy] Project state updated successfully"
                  );
                } else {
                  console.warn("[Deploy] No project returned from API");
                }
              }
            } catch (error) {
              console.error("Failed to refetch project:", error);
            }
          }, 3000);
        }

        return { ...prev, ...updates };
      });
    } else if (status === "failed") {
      updateSectionStatus(sectionId, "error", duration);
      setDeploymentState((prev) => ({
        ...prev,
        currentStep: "failed",
        error: error || "Operation failed",
        isStreaming: false,
      }));
    }
    
    setActiveOperationType(null);
    setActiveSectionId(null);
  };



  const handleDestroy = async () => {
    if (!project) return;

    setIsDestroying(true);
    setShowDestroyConfirm(false);

    setSections((prev) => [
      ...prev,
      {
        id: "destroy",
        title: "Destroy Logs",
        logs: [],
        status: "running",
        isExpanded: true,
      },
    ]);

    try {
      const token = await (
        window as unknown as ClerkWindow
      ).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/deployment/projects/${project.id}/destroy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success && data.data.operation_id) {
        setDeploymentState((prev) => ({
          ...prev,
          operationId: data.data.operation_id,
          isStreaming: true,
        }));
        setActiveOperationType("apply");
        setActiveSectionId("destroy");
        operationStartTime.current = Date.now();
        toast.success("Destruction started");
      } else {
        throw new Error(data.errors?.[0] || "Failed to start destruction");
      }
    } catch (error) {
      toast.error(`Failed to destroy: ${error}`);
      updateSectionStatus("destroy", "error");
    } finally {
      setIsDestroying(false);
    }
  };

  const handleAWSSetupComplete = async (roleArn: string) => {
    setShowAWSSetup(false);

    try {
      if (project?.id) {
        const response = await apiCall(`/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            deployment_status: "aws_verified",
            aws_role_arn: roleArn,
          }),
        });

        if (response.ok) {
          const updatedProject = await projectsApi.getProjectById(project.id);
          if (updatedProject) {
            setProject(updatedProject);
          }
          toast.success("AWS connected! You can now deploy.");
        }
      }
    } catch {
      toast.error("Failed to connect AWS");
    }
  };

  const getStatusBadge = (status: "idle" | "running" | "success" | "error") => {
    switch (status) {
      case "running":
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Running</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-green-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-green-300">Success</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-red-400">Failed</span>
          </div>
        );
      default:
        return <span className="text-xs text-gray-600">Idle</span>;
    }
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-800 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-200 mb-4">
            Project Not Found
          </h1>
          <button
            onClick={() => router.push(`/${userProjects}`)}
            className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isAWSVerified =
    project.deployment_status === "aws_verified" ||
    project.deployment_status === "deployed" ||
    project.deployment_status === "completed";

  const steps = [
    {
      id: "build",
      title: "Build",
      subtitle: "Container Image",
      icon: (
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
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
      status: deploymentState.imagePushed
        ? "completed"
        : deploymentState.currentStep === "building"
        ? "active"
        : "pending",
      action: () => startOperation("build_image"),
      disabled: deploymentState.isStreaming || deploymentState.imagePushed,
    },
    {
      id: "plan",
      title: "Plan",
      subtitle: "Infrastructure",
      icon: (
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      status: deploymentState.planGenerated
        ? "completed"
        : deploymentState.currentStep === "planning"
        ? "active"
        : !deploymentState.imagePushed
        ? "disabled"
        : "pending",
      action: () => startOperation("plan"),
      disabled:
        deploymentState.isStreaming ||
        !deploymentState.imagePushed ||
        deploymentState.planGenerated,
    },
    {
      id: "deploy",
      title: "Deploy",
      subtitle: "to Production",
      icon: (
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
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
      status: deploymentState.deployed
        ? "completed"
        : deploymentState.currentStep === "deploying"
        ? "active"
        : !deploymentState.planGenerated
        ? "disabled"
        : "pending",
      action: () => startOperation("apply"),
    },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {project.name}
                </h1>
                {deploymentState.deployed && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-300 rounded-full text-xs font-medium">
                    <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                    <span>Production</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{project.repository_name}</span>
              </div>
            </div>
            <button
              onClick={() => setShowDestroyConfirm(true)}
              disabled={isDestroying || !deploymentState.deployed}
              className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 border border-[#333333] hover:border-red-500/30 rounded-md transition-colors disabled:opacity-50"
            >
              {isDestroying ? "Destroying..." : "Destroy Infrastructure"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Template</div>
              <div className="text-sm font-medium text-gray-200">
                ECS Fargate
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Serverless containers
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Region</div>
              <div className="text-sm font-medium text-gray-200">us-west-2</div>
              <div className="text-xs text-gray-600 mt-1">US West (Oregon)</div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-sm font-medium text-gray-200">
                {deploymentState.deployed
                  ? "Deployed"
                  : deploymentState.planGenerated
                  ? "Ready to Deploy"
                  : deploymentState.imagePushed
                  ? "Image Built"
                  : isAWSVerified
                  ? "Ready"
                  : "AWS Setup Required"}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {deploymentState.deployed
                  ? "Infrastructure live"
                  : isAWSVerified
                  ? "Ready for deployment"
                  : "Connect AWS account"}
              </div>
            </div>
          </div>

          {(deploymentState.deployed || deploymentState.planGenerated) && (
            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 mb-8">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">
                Infrastructure Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-gray-500 mb-3">Compute</div>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">ECS Cluster</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {project.name}-cluster
                        </div>
                      </div>
                      {deploymentState.deployed && (
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">ECS Service</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {project.name}-service
                        </div>
                      </div>
                      {deploymentState.deployed && (
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">
                          Task Definition
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Fargate 0.5 vCPU / 1GB RAM
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-3">Network</div>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">
                          Application Load Balancer
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {project.name}-alb
                        </div>
                      </div>
                      {deploymentState.deployed && (
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">VPC</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          3 AZs with public subnets
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-300">
                          Security Group
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          HTTP/HTTPS ingress
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {deploymentState.deployed && (
                <div className="mt-6 pt-6 border-t border-[#333333]">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">
                        Application URL
                      </div>
                      {project.application_url ? (
                        <div className="text-sm text-gray-300 font-mono">
                          {project.application_url}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Deploy your infrastructure to get the application URL
                        </div>
                      )}
                    </div>
                    {project.application_url && (
                      <a
                        href={`http://${project.application_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-md hover:bg-gray-100 transition-colors text-xs font-medium"
                      >
                        <span>Visit</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!isAWSVerified && (
          <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-orange-300 mb-2">
                  AWS Account Setup Required
                </h3>
                <p className="text-sm text-gray-400 mb-1">
                  Connect your AWS account to enable deployment operations:
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 ml-4 mt-2">
                  <li>• Build and push Docker images to ECR</li>
                  <li>• Generate Terraform deployment plans</li>
                  <li>• Deploy infrastructure to your AWS account</li>
                </ul>
              </div>
              <button
                onClick={() => setShowAWSSetup(true)}
                className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                Connect AWS
              </button>
            </div>
          </div>
        )}

        {isAWSVerified && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute top-7 left-full w-3 h-px bg-[#1a1a1a] z-0">
                    {step.status === "completed" && (
                      <div className="h-full w-full bg-green-500" />
                    )}
                  </div>
                )}

                <button
                  onClick={step.action}
                  disabled={step.disabled}
                  className={`relative w-full text-left p-4 rounded-lg border transition-all ${
                    step.status === "completed"
                      ? "bg-green-500/15 border-green-400/40 hover:bg-green-500/20"
                      : step.status === "active"
                      ? "bg-[#0a0a0a] border-gray-500 shadow-lg"
                      : step.status === "disabled"
                      ? "bg-[#0d0d0d] border-[#3a3a3a] opacity-70"
                      : "bg-[#0a0a0a] border-[#3a3a3a] hover:border-gray-600"
                  }`}
                  style={{ zIndex: 1 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`p-2 rounded-md ${
                        step.status === "completed"
                          ? "bg-green-500/25 text-green-300"
                          : step.status === "active"
                          ? "bg-gray-900 text-gray-300"
                          : step.status === "disabled"
                          ? "bg-[#1a1a1a] text-gray-600"
                          : "bg-gray-950 text-gray-500"
                      }`}
                    >
                      {step.icon}
                    </div>
                    {step.status === "completed" && (
                      <svg
                        className="w-4 h-4 text-green-300"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {step.status === "active" && (
                      <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-0.5 text-gray-200">
                      {step.title}
                    </h3>
                    <p className="text-xs text-gray-600">{step.subtitle}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-px mb-6">
          {sections
            .filter((s) => s.logs.length > 0 || s.status !== "idle")
            .map((section) => (
              <div
                key={section.id}
                className="bg-[#0a0a0a] border border-[#333333] rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#121212] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDownIcon
                      className={`w-4 h-4 text-gray-600 transition-transform ${
                        section.isExpanded ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-300">
                      {section.title}
                    </span>
                    {section.logs.length > 0 && (
                      <span className="text-xs text-gray-700">
                        {section.logs.length} lines
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {section.duration && (
                      <span className="text-xs text-gray-500 font-mono">
                        {section.duration}
                      </span>
                    )}
                    {getStatusBadge(section.status)}
                  </div>
                </button>

                {section.isExpanded && section.logs.length > 0 && (
                  <div 
                    ref={(el) => { sectionLogRefs.current[section.id] = el; }}
                    className="border-t border-[#333333] p-4 max-h-96 overflow-y-auto bg-black"
                  >
                    <div className="font-mono text-[13px] text-[#fafafa] space-y-0.5 leading-relaxed">
                      {section.logs.map((log, index) => (
                        <div
                          key={index}
                          dangerouslySetInnerHTML={{ __html: ansiToHtml(log) }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>

        {deploymentState.currentStep === "failed" && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <XCircleIcon className="w-5 h-5 text-red-500" />
              <h3 className="text-base font-medium text-red-400">
                Operation Failed
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {deploymentState.error || "An error occurred during deployment"}
            </p>
            <button
              onClick={() =>
                setDeploymentState((prev) => ({
                  ...prev,
                  currentStep: prev.imagePushed ? "built" : "not_started",
                  error: null,
                }))
              }
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <SirpiAssistant projectId={project?.id} />

      <AWSSetupFlow
        isVisible={showAWSSetup}
        onComplete={handleAWSSetupComplete}
        onClose={() => setShowAWSSetup(false)}
        projectId={project?.id}
      />

      {showDestroyConfirm && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowDestroyConfirm(false)}
        >
          <div
            className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <svg
                    className="w-5 h-5 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-200">
                  Destroy Infrastructure
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                This will permanently delete all AWS resources. This cannot be
                undone.
              </p>
              <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3 mb-5">
                <p className="text-xs text-red-400">
                  <strong>Resources:</strong> VPC, Subnets, ECS, Load Balancer,
                  Security Groups
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDestroy}
                  disabled={isDestroying}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowDestroyConfirm(false)}
                  className="flex-1 px-4 py-2 border border-[#333333] text-gray-400 rounded-md hover:bg-[#0d0d0d] transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
