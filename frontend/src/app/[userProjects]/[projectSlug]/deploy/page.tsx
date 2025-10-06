"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshIcon,
  XCircleIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";

// AWS Service Icons (reused from main page)
const AWSIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="text-orange-500"
  >
    <path d="M18.77 14.85c-.37.15-.75.22-1.13.22-1.09 0-2.1-.56-2.67-1.49L12 8.85l-2.97 4.73c-.57.93-1.58 1.49-2.67 1.49-.38 0-.76-.07-1.13-.22L2 16.15v3.7c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3.7l-3.23-1.3z" />
    <path d="M4 4c-1.1 0-2 .9-2 2v6.85l3.23-1.3c.37-.15.75-.22 1.13-.22 1.09 0 2.1.56 2.67 1.49L12 17.55l2.97-4.73c.57-.93 1.58-1.49 2.67-1.49.38 0 .76.07 1.13.22L22 12.85V6c0-1.1-.9-2-2-2H4z" />
  </svg>
);

interface AWSCredentials {
  aws_access_key: string;
  aws_secret_key: string;
  aws_region: string;
}

interface DeploymentState {
  phase:
    | "credentials"
    | "planning"
    | "plan_ready"
    | "deploying"
    | "deployed"
    | "failed"
    | "destroying"
    | "destroyed"
    | "ready";
  message: string;
  progress: number;
  operation_id?: string;
  plan_output?: string;
  outputs?: Record<string, string>;
  error?: string;
}

interface StreamEvent {
  type: string;
  status?: string;
  message?: string;
  success?: boolean;
  result?: {
    plan_output?: string;
    outputs?: Record<string, string>;
    error?: string;
  };
  outputs?: Record<string, string>;
  error?: string;
}

// Add Eye icons locally since they're not in the icon library
const EyeIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeSlashIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m0 0l3.121-3.121m0 0L21 3m-6.879 6.879L15 12"
    />
  </svg>
);

export default function DeployPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;
  const projectSlug = params.projectSlug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Deployment state
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({
    phase: "credentials",
    message: "Enter your AWS credentials to begin deployment",
    progress: 0,
  });

  // AWS credentials
  const [credentials, setCredentials] = useState<AWSCredentials>({
    aws_access_key: "",
    aws_secret_key: "",
    aws_region: "us-west-1",
  });

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isValidatingCredentials, setIsValidatingCredentials] = useState(false);
  const [isCredentialsValid, setIsCredentialsValid] = useState(false);

  // Deployment logs and streaming
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [deploymentLogs]);

  // Validate user namespace and load project
  useEffect(() => {
    if (user) {
      const expectedNamespace = getUserProjectNamespace(user);
      if (userProjects !== expectedNamespace) {
        router.replace(`/${expectedNamespace}/${projectSlug}/deploy`);
        return;
      }
    }
  }, [user, userProjects, projectSlug, router]);

  // Load project details
  useEffect(() => {
    async function loadProject() {
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
            setProject(foundProject);

            // Check if project is ready to deploy
            if (foundProject.status !== "ready_to_deploy") {
              router.push(`/${userProjects}/${projectSlug}`);
              return;
            }

            // Check existing deployment status
            await checkExistingDeploymentStatus(String(foundProject.id));
          } else {
            router.push(`/${userProjects}`);
          }
        }
      } catch (error) {
        router.push(`/${userProjects}`);
      } finally {
        setIsLoading(false);
      }
    }

    if (user && projectSlug && userProjects) {
      loadProject();
    }
  }, [user, projectSlug, userProjects, router]);

  const checkExistingDeploymentStatus = async (projectId: string) => {
    try {
      const token = await (
        window as Window & {
          Clerk?: { session?: { getToken: () => Promise<string> } };
        }
      ).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/deployment/projects/${projectId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const status = data.data.status;
          if (status && status !== "not_started") {
            // Update state based on existing deployment
            if (status === "deployed") {
              setDeploymentState({
                phase: "deployed",
                message: "Infrastructure is deployed and running",
                progress: 100,
                outputs: data.data.endpoints,
              });
            } else if (status === "failed") {
              setDeploymentState({
                phase: "failed",
                message: "Previous deployment failed",
                progress: 0,
                error: "Previous deployment encountered an error",
              });
            } else {
              setDeploymentState({
                phase: "deploying",
                message: "Deployment in progress...",
                progress: 50,
              });
            }
          }
        }
      }
    } catch (error) {
      // Error handled by calling code
    }
  };

  const validateCredentials = async () => {
    if (!credentials.aws_access_key || !credentials.aws_secret_key) {
      return;
    }

    setIsValidatingCredentials(true);
    setIsCredentialsValid(false);

    try {
      const token = await (
        window as Window & {
          Clerk?: { session?: { getToken: () => Promise<string> } };
        }
      ).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/deployment/validate-credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(credentials),
        }
      );

      const data = await response.json();

      if (data.success) {
        setIsCredentialsValid(true);
        addLog("✅ AWS credentials validated successfully");
        setDeploymentState((prev) => ({
          ...prev,
          phase: "ready",
          message: "Credentials validated. Ready to plan deployment.",
          progress: 25,
        }));
      } else {
        addLog(
          `❌ Credential validation failed: ${
            data.errors?.[0] || "Unknown error"
          }`
        );
        setDeploymentState((prev) => ({
          ...prev,
          error: data.errors?.[0] || "Credential validation failed",
        }));
      }
    } catch (error) {
      addLog(`❌ Validation error: ${error}`);
      setDeploymentState((prev) => ({
        ...prev,
        error: String(error),
      }));
    } finally {
      setIsValidatingCredentials(false);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDeploymentLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const startOperation = async (operation: "plan" | "apply" | "destroy") => {
    if (!project || !isCredentialsValid) return;

    const operationLabels = {
      plan: "Planning",
      apply: "Deploying",
      destroy: "Destroying",
    };

    setDeploymentState((prev) => ({
      ...prev,
      phase:
        operation === "destroy"
          ? "destroying"
          : operation === "plan"
          ? "planning"
          : "deploying",
      message: `${operationLabels[operation]} infrastructure...`,
      progress: operation === "plan" ? 25 : 50,
    }));

    setIsStreaming(true);
    addLog(`🚀 Starting ${operation} operation...`);

    try {
      const token = await (
        window as Window & {
          Clerk?: { session?: { getToken: () => Promise<string> } };
        }
      ).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/deployment/projects/${project.id}/${operation}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ credentials }),
        }
      );

      const data = await response.json();

      if (data.success && data.data.operation_id) {
        setDeploymentState((prev) => ({
          ...prev,
          operation_id: data.data.operation_id,
        }));

        // Start streaming
        startEventStream(data.data.operation_id);
      } else {
        throw new Error(data.errors?.[0] || `Failed to start ${operation}`);
      }
    } catch (error) {
      addLog(`❌ Failed to start ${operation}: ${error}`);
      setDeploymentState((prev) => ({
        ...prev,
        phase: "failed",
        message: `Failed to start ${operation}`,
        error: String(error),
      }));
      setIsStreaming(false);
    }
  };

  const startEventStream = (operationId: string) => {
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/api/deployment/operations/${operationId}/stream`
    );

    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);

        switch (data.type) {
          case "connected":
            addLog("🔗 Connected to deployment stream");
            break;

          case "terraform_output":
            if (data.message) {
              addLog(data.message.trim());
            }
            break;

          case "terraform_status":
            if (data.status && data.message) {
              setDeploymentState((prev) => ({
                ...prev,
                message: data.message!,
                progress: getProgressForStatus(data.status!),
              }));
              addLog(`📊 Status: ${data.message}`);
            }
            break;

          case "plan_complete":
            if (data.success && data.result?.plan_output) {
              setDeploymentState((prev) => ({
                ...prev,
                phase: "plan_ready",
                message: "Plan completed successfully",
                progress: 50,
                plan_output: data.result!.plan_output,
              }));
              addLog("✅ Terraform plan completed successfully");
            } else {
              handleOperationError("Plan failed", data.result?.error);
            }
            stopStreaming();
            break;

          case "apply_complete":
            if (data.success && data.result?.outputs) {
              setDeploymentState((prev) => ({
                ...prev,
                phase: "deployed",
                message: "Infrastructure deployed successfully!",
                progress: 100,
                outputs: data.result!.outputs,
              }));
              addLog("🎉 Infrastructure deployed successfully!");
              if (data.result!.outputs) {
                addLog(
                  `📍 Outputs: ${JSON.stringify(data.result!.outputs, null, 2)}`
                );
              }
            } else {
              handleOperationError("Deployment failed", data.result?.error);
            }
            stopStreaming();
            break;

          case "destroy_complete":
            if (data.success) {
              setDeploymentState((prev) => ({
                ...prev,
                phase: "destroyed",
                message: "Infrastructure destroyed successfully",
                progress: 100,
                outputs: undefined,
              }));
              addLog("🗑️ Infrastructure destroyed successfully");
            } else {
              handleOperationError("Destroy failed", data.result?.error);
            }
            stopStreaming();
            break;

          case "plan_error":
          case "apply_error":
          case "destroy_error":
            handleOperationError("Operation failed", data.error);
            stopStreaming();
            break;

          case "keepalive":
            // Ignore keepalive messages
            break;

          default:
          // Unknown event - ignore
        }
      } catch (error) {
        // Error parsing stream event - connection may be lost
      }
    };

    eventSource.onerror = (error) => {
      addLog("❌ Lost connection to deployment stream");
      stopStreaming();
    };
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleOperationError = (message: string, error?: string) => {
    setDeploymentState((prev) => ({
      ...prev,
      phase: "failed",
      message,
      error: error || "Operation failed",
    }));
    addLog(`❌ ${message}: ${error || "Unknown error"}`);
  };

  const getProgressForStatus = (status: string): number => {
    switch (status) {
      case "planning":
        return 25;
      case "plan_ready":
        return 50;
      case "deploying":
        return 75;
      case "deployed":
        return 100;
      case "destroying":
        return 75;
      case "destroyed":
        return 100;
      default:
        return 0;
    }
  };

  const resetDeployment = () => {
    setDeploymentState({
      phase: "credentials",
      message: "Enter your AWS credentials to begin deployment",
      progress: 0,
    });
    setCredentials({
      aws_access_key: "",
      aws_secret_key: "",
      aws_region: "us-west-1",
    });
    setIsCredentialsValid(false);
    setDeploymentLogs([]);
    stopStreaming();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-gray-400">Loading deployment...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <button
            onClick={() => router.push(`/${userProjects}/${projectSlug}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Project
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">
              Project Not Found
            </h1>
            <p className="text-gray-400 mb-8">
              The requested project could not be found or is not ready for
              deployment.
            </p>
            <button
              onClick={() => router.push(`/${userProjects}`)}
              className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
            >
              Go Back to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/${userProjects}/${projectSlug}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Project
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <AWSIcon />
            <h1 className="text-3xl font-bold text-white">Deploy to AWS</h1>
          </div>
          <p className="text-gray-400">
            Deploy <strong>{project.name}</strong> infrastructure to Amazon Web
            Services
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {deploymentState.phase === "deployed" ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : deploymentState.phase === "failed" ? (
                  <XCircleIcon className="w-6 h-6 text-red-500" />
                ) : isStreaming ? (
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                ) : (
                  <ClockIcon className="w-6 h-6 text-gray-400" />
                )}
                <span className="text-lg font-medium text-white">
                  {deploymentState.message}
                </span>
              </div>
              <span className="text-sm text-gray-400">
                {deploymentState.progress}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  deploymentState.phase === "failed"
                    ? "bg-red-500"
                    : deploymentState.phase === "deployed"
                    ? "bg-green-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${deploymentState.progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: AWS Credentials */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCredentialsValid
                        ? "bg-green-500 text-white"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    1
                  </span>
                  <span>AWS Credentials</span>
                </h2>
                {isCredentialsValid && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                )}
              </div>

              {deploymentState.phase === "credentials" ||
              !isCredentialsValid ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Access Key ID
                    </label>
                    <input
                      type="text"
                      value={credentials.aws_access_key}
                      onChange={(e) =>
                        setCredentials((prev) => ({
                          ...prev,
                          aws_access_key: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="AKIA..."
                      disabled={isValidatingCredentials}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Secret Access Key
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? "text" : "password"}
                        value={credentials.aws_secret_key}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            aws_secret_key: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 pr-12"
                        placeholder="••••••••••••••••••••••••••••••••••••••••"
                        disabled={isValidatingCredentials}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showSecretKey ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Region
                    </label>
                    <select
                      value={credentials.aws_region}
                      onChange={(e) =>
                        setCredentials((prev) => ({
                          ...prev,
                          aws_region: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      disabled={isValidatingCredentials}
                    >
                      <option value="us-west-1">US West (N. California)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-east-2">US East (Ohio)</option>
                    </select>
                  </div>

                  <button
                    onClick={validateCredentials}
                    disabled={
                      !credentials.aws_access_key ||
                      !credentials.aws_secret_key ||
                      isValidatingCredentials
                    }
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isValidatingCredentials ? (
                      <>
                        <RefreshIcon className="w-5 h-5 animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <span>Validate Credentials</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div>
                    <p className="text-green-400 font-medium">
                      Credentials Validated
                    </p>
                    <p className="text-green-300 text-sm">
                      Ready to deploy to {credentials.aws_region}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsCredentialsValid(false);
                      setDeploymentState((prev) => ({
                        ...prev,
                        phase: "credentials",
                      }));
                    }}
                    className="text-green-400 hover:text-green-300 text-sm"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Plan Infrastructure */}
            {isCredentialsValid && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        ["plan_ready", "deployed", "deploying"].includes(
                          deploymentState.phase
                        )
                          ? "bg-green-500 text-white"
                          : deploymentState.phase === "planning"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      2
                    </span>
                    <span>Plan Infrastructure</span>
                  </h2>
                  {deploymentState.phase === "plan_ready" && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  )}
                </div>

                {deploymentState.phase === "credentials" && (
                  <p className="text-gray-400 text-sm">
                    Validate your AWS credentials first to continue.
                  </p>
                )}

                {deploymentState.phase !== "credentials" &&
                  deploymentState.phase !== "planning" &&
                  deploymentState.phase !== "plan_ready" && (
                    <button
                      onClick={() => startOperation("plan")}
                      disabled={!isCredentialsValid || isStreaming}
                      className="w-full px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <span>📋</span>
                      <span>Generate Deployment Plan</span>
                    </button>
                  )}

                {deploymentState.phase === "planning" && (
                  <div className="flex items-center justify-center p-8">
                    <div className="flex items-center space-x-3">
                      <RefreshIcon className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="text-white">
                        Generating deployment plan...
                      </span>
                    </div>
                  </div>
                )}

                {deploymentState.phase === "plan_ready" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 font-medium">
                        Plan Generated Successfully
                      </p>
                      <p className="text-green-300 text-sm">
                        Review the plan below and proceed with deployment.
                      </p>
                    </div>

                    {deploymentState.plan_output && (
                      <details className="bg-gray-900 rounded-lg border border-gray-700">
                        <summary className="p-4 cursor-pointer text-gray-300 hover:text-white">
                          View Terraform Plan
                        </summary>
                        <div className="p-4 pt-0">
                          <pre className="text-xs text-gray-300 bg-black p-4 rounded border border-gray-600 overflow-x-auto max-h-64">
                            {deploymentState.plan_output}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Deploy */}
            {deploymentState.phase === "plan_ready" && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        ["deployed", "deploying"].includes(
                          deploymentState.phase
                        )
                          ? "bg-green-500 text-white"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      3
                    </span>
                    <span>Deploy Infrastructure</span>
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-400 font-medium">
                      ⚠️ Ready to Deploy
                    </p>
                    <p className="text-orange-300 text-sm">
                      This will create resources in your AWS account. You will
                      be charged for any resources created.
                    </p>
                  </div>

                  <button
                    onClick={() => startOperation("apply")}
                    disabled={isStreaming}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <PlayIcon className="w-5 h-5" />
                    <span>Deploy to AWS</span>
                  </button>
                </div>
              </div>
            )}

            {/* Deployed Resources */}
            {deploymentState.phase === "deployed" &&
              deploymentState.outputs && (
                <div className="bg-black border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                    <span>Deployed Resources</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(deploymentState.outputs).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                        >
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-white font-mono break-all">
                            {value}
                          </p>
                          {value.startsWith("http") && (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm mt-2"
                            >
                              <span>Open</span>
                              <ExternalLinkIcon className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => startOperation("destroy")}
                    disabled={isStreaming}
                    className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <span>🗑️</span>
                    <span>Destroy Infrastructure</span>
                  </button>
                </div>
              )}

            {/* Error State */}
            {deploymentState.phase === "failed" && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <h3 className="text-red-400 font-medium text-lg mb-2">
                  Operation Failed
                </h3>
                <p className="text-red-300 text-sm mb-4">
                  {deploymentState.error ||
                    "An unknown error occurred during the operation."}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={resetDeployment}
                    className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">
                Project Info
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Name</p>
                  <p className="text-white">{project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Repository</p>
                  <p className="text-white text-sm">
                    {project.repository_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Language</p>
                  <p className="text-white">
                    {project.language || "Not detected"}
                  </p>
                </div>
              </div>
            </div>

            {/* Deployment Logs */}
            {deploymentLogs.length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-lg font-medium text-white">
                    Deployment Logs
                  </h3>
                </div>
                <div className="p-4 bg-gray-900 max-h-96 overflow-y-auto">
                  <div className="font-mono text-xs space-y-1">
                    {deploymentLogs.map((log, index) => (
                      <div key={index} className="text-gray-300">
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}

            {/* Cost Estimate */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">
                Cost Estimate
              </h3>
              <div className="space-y-3">
                <div className="text-center p-4 bg-gray-900 rounded-lg">
                  <p className="text-2xl font-bold text-white">$50-100</p>
                  <p className="text-sm text-gray-400">per month</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">ECS Fargate</span>
                    <span className="text-white">$30-60</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Load Balancer</span>
                    <span className="text-white">$15-20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Other Services</span>
                    <span className="text-white">$5-20</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  * Estimates based on typical usage. Actual costs may vary.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
