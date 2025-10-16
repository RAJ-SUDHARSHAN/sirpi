"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { ansiToHtml } from "@/lib/utils/ansi-to-html";
import {
  ChevronLeftIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";
import toast from "react-hot-toast";

// AWS Service Icon
const AWSIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-orange-500">
    <path d="M18.77 14.85c-.37.15-.75.22-1.13.22-1.09 0-2.1-.56-2.67-1.49L12 8.85l-2.97 4.73c-.57.93-1.58 1.49-2.67 1.49-.38 0-.76-.07-1.13-.22L2 16.15v3.7c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3.7l-3.23-1.3z" />
    <path d="M4 4c-1.1 0-2 .9-2 2v6.85l3.23-1.3c.37-.15.75-.22 1.13-.22 1.09 0 2.1.56 2.67 1.49L12 17.55l2.97-4.73c.57-.93 1.58-1.49 2.67-1.49.38 0 .76.07 1.13.22L22 12.85V6c0-1.1-.9-2-2-2H4z" />
  </svg>
);

type DeploymentStep = "not_started" | "building" | "built" | "planning" | "planned" | "deploying" | "deployed" | "failed";

interface DeploymentState {
  currentStep: DeploymentStep;
  imagePushed: boolean;
  planGenerated: boolean;
  deployed: boolean;
  logs: string[];
  operationId: string | null;
  isStreaming: boolean;
  error: string | null;
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
    logs: [],
    operationId: null,
    isStreaming: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [deploymentState.logs]);

  useEffect(() => {
    if (user) {
      const expectedNamespace = getUserProjectNamespace(user as any);
      if (userProjects !== expectedNamespace) {
        router.replace(`/${expectedNamespace}/${projectSlug}/deploy`);
        return;
      }
    }
  }, [user, userProjects, projectSlug, router]);

  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);
        const overview = await projectsApi.getUserOverview();
        if (overview) {
          const userOverview = overview as { projects: { items: Project[] } };
          const foundProject = userOverview.projects.items.find(
            (p) => p.slug === projectSlug || p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === projectSlug
          );

          if (foundProject) {
            setProject(foundProject);
            
            const canDeploy = 
              foundProject.deployment_status === "aws_verified" ||
              foundProject.status === "ready_to_deploy" ||
              foundProject.status === "pr_merged" ||
              foundProject.status === "completed";
            
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
    }

    if (user && projectSlug && userProjects) {
      loadProject();
    }
  }, [user, projectSlug, userProjects, router]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startOperation = async (operation: "build_image" | "plan" | "apply") => {
    if (!project) return;

    const stepMap = {
      build_image: "building",
      plan: "planning",
      apply: "deploying",
    } as const;

    setDeploymentState(prev => ({
      ...prev,
      currentStep: stepMap[operation],
      logs: [],
      isStreaming: true,
      error: null,
    }));

    try {
      const token = await (window as any).Clerk?.session?.getToken();
      
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
        setDeploymentState(prev => ({ ...prev, operationId: data.data.operation_id }));
        startEventStream(data.data.operation_id, operation);
      } else {
        throw new Error(data.errors?.[0] || `Failed to start ${operation}`);
      }
    } catch (error) {
      setDeploymentState(prev => ({
        ...prev,
        currentStep: "failed",
        error: String(error),
        isStreaming: false,
      }));
      toast.error(`Failed to start ${operation}`);
    }
  };

  const startEventStream = (operationId: string, operation: "build_image" | "plan" | "apply") => {
    const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/deployment/operations/${operationId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(data.message || "🔗 Connected");
      } catch (err) {
        console.error('Parse error:', err);
      }
    });

    eventSource.addEventListener('log', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          addLog(data.message.trim());
        }
      } catch (err) {
        console.error('Parse error:', err);
      }
    });

    eventSource.addEventListener('complete', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "completed") {
          setDeploymentState(prev => {
            const updates: Partial<DeploymentState> = { isStreaming: false };
            
            if (operation === "build_image") {
              updates.currentStep = "built";
              updates.imagePushed = true;
              addLog("✅ Docker image ready! You can now generate the deployment plan.");
            } else if (operation === "plan") {
              updates.currentStep = "planned";
              updates.planGenerated = true;
              addLog("✅ Plan generated! Review the changes above, then deploy.");
            } else if (operation === "apply") {
              updates.currentStep = "deployed";
              updates.deployed = true;
              addLog("🎉 Deployment complete! Your infrastructure is live.");
            }
            
            return { ...prev, ...updates };
          });
        } else if (data.status === "failed") {
          setDeploymentState(prev => ({
            ...prev,
            currentStep: "failed",
            error: data.error || "Operation failed",
            isStreaming: false,
          }));
        }
        stopStreaming();
      } catch (err) {
        console.error('Parse error:', err);
      }
    });

    eventSource.onerror = () => {
      addLog("❌ Lost connection to stream");
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        addLog(`🔄 Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
        stopStreaming();
        setTimeout(() => {
          startEventStream(operationId, operation);
        }, 2000); // Wait 2 seconds before reconnecting
      } else {
        addLog("⚠️ Max reconnection attempts reached. Operation may still be running in background.");
        addLog("Check operation status or refresh the page.");
        stopStreaming();
      }
    };
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts
  };

  const checkOperationStatus = async () => {
    if (!deploymentState.operationId) return;

    try {
      const token = await (window as any).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/deployment/operations/${deploymentState.operationId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      
      if (data.success) {
        const status = data.data.status;
        addLog(`🔍 Status check: ${status}`);
        
        if (status === "completed") {
          setDeploymentState(prev => ({
            ...prev,
            currentStep: prev.currentStep === "building" ? "built" : 
                        prev.currentStep === "planning" ? "planned" : 
                        prev.currentStep === "deploying" ? "deployed" : prev.currentStep,
            imagePushed: prev.currentStep === "building" || prev.imagePushed,
            planGenerated: prev.currentStep === "planning" || prev.planGenerated,
            deployed: prev.currentStep === "deploying" || prev.deployed,
            isStreaming: false,
          }));
        } else if (status === "failed") {
          setDeploymentState(prev => ({
            ...prev,
            currentStep: "failed",
            error: data.data.error || "Operation failed",
            isStreaming: false,
          }));
        } else if (status === "running") {
          addLog(`⏳ Operation still running (${data.data.log_count} logs captured)`);
          addLog("🔄 Reconnecting to stream...");
          
          // Determine operation type from current step
          setDeploymentState(prev => {
            const operation = prev.currentStep === "building" ? "build_image" :
                            prev.currentStep === "planning" ? "plan" :
                            prev.currentStep === "deploying" ? "apply" : null;
            
            if (operation) {
              reconnectAttemptsRef.current = 0;
              setTimeout(() => {
                startEventStream(deploymentState.operationId!, operation as "build_image" | "plan" | "apply");
              }, 100);
            }
            return prev;
          });
        }
      }
    } catch (error) {
      addLog(`❌ Failed to check status: ${error}`);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDeploymentState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${timestamp}] ${message}`],
    }));
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-gray-400">Loading...</p>
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
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    {
      id: "build",
      title: "1. Build & Push Docker Image",
      description: "Build your application into a Docker container and push to ECR",
      status: deploymentState.imagePushed ? "completed" : deploymentState.currentStep === "building" ? "active" : "pending",
      action: () => startOperation("build_image"),
      actionText: "Build & Push Image",
      disabled: deploymentState.isStreaming || deploymentState.imagePushed,
    },
    {
      id: "plan",
      title: "2. Generate Deployment Plan",
      description: "Preview infrastructure changes before deploying",
      status: deploymentState.planGenerated ? "completed" : deploymentState.currentStep === "planning" ? "active" : !deploymentState.imagePushed ? "disabled" : "pending",
      action: () => startOperation("plan"),
      actionText: "Generate Plan",
      disabled: deploymentState.isStreaming || !deploymentState.imagePushed || deploymentState.planGenerated,
    },
    {
      id: "deploy",
      title: "3. Deploy to AWS",
      description: "Create your infrastructure on AWS",
      status: deploymentState.deployed ? "completed" : deploymentState.currentStep === "deploying" ? "active" : !deploymentState.planGenerated ? "disabled" : "pending",
      action: () => startOperation("apply"),
      actionText: "Deploy Infrastructure",
      disabled: deploymentState.isStreaming || !deploymentState.planGenerated || deploymentState.deployed,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <button onClick={() => router.push(`/${userProjects}/${projectSlug}`)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Project
        </button>

        <div className="flex items-center space-x-3 mb-2">
          <AWSIcon />
          <h1 className="text-3xl font-bold text-white">Deploy to AWS</h1>
        </div>
        <p className="text-gray-400 mb-8">
          Deploy <strong>{project.name}</strong> step-by-step with guided workflow
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-6 rounded-lg border-2 transition-all ${
                step.status === "completed"
                  ? "bg-green-900/20 border-green-500"
                  : step.status === "active"
                  ? "bg-blue-900/20 border-blue-500 animate-pulse"
                  : step.status === "disabled"
                  ? "bg-gray-900/50 border-gray-700 opacity-50"
                  : "bg-gray-900/50 border-gray-600 hover:border-gray-500"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                {step.status === "completed" && (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                )}
                {step.status === "active" && (
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                )}
                {step.status === "pending" && (
                  <ClockIcon className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-400 mb-4">{step.description}</p>
              <button
                onClick={step.action}
                disabled={step.disabled}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  step.disabled
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-gray-100"
                }`}
              >
                {step.actionText}
              </button>
            </div>
          ))}
        </div>

        {/* Deployment Logs */}
        {deploymentState.logs.length > 0 && (
          <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-white">Deployment Logs</h3>
                {deploymentState.isStreaming && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-gray-400">Live</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {deploymentState.operationId && !deploymentState.isStreaming && (
                  <button 
                    onClick={checkOperationStatus}
                    className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded hover:bg-blue-400/10 transition-colors"
                  >
                    Check Status
                  </button>
                )}
                <button onClick={() => setDeploymentState(prev => ({ ...prev, logs: [] }))} className="text-sm text-gray-400 hover:text-white transition-colors">
                  Clear
                </button>
              </div>
            </div>
            <div className="p-6 bg-gray-950 overflow-y-auto" style={{ maxHeight: '500px' }}>
              <div className="font-mono text-sm text-gray-500 leading-relaxed">
                {deploymentState.logs.map((log, index) => (
                  <div 
                    key={index} 
                    className="whitespace-pre-wrap break-words mb-0.5"
                    dangerouslySetInnerHTML={{ __html: ansiToHtml(log) }}
                  />
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {deploymentState.currentStep === "failed" && (
          <div className="mt-8 bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircleIcon className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-medium text-red-400">Operation Failed</h3>
            </div>
            <p className="text-red-300 text-sm mb-4">{deploymentState.error || "An error occurred during deployment"}</p>
            <button
              onClick={() => setDeploymentState(prev => ({ ...prev, currentStep: prev.imagePushed ? "built" : "not_started", error: null }))}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reset & Try Again
            </button>
          </div>
        )}

        {/* Success State */}
        {deploymentState.deployed && (
          <div className="mt-8 bg-green-900/20 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-medium text-green-400">Deployment Successful!</h3>
            </div>
            <p className="text-green-300 text-sm mb-4">Your infrastructure is now live on AWS. Check the CloudFormation console for outputs like ALB DNS name.</p>
            <a
              href={`https://console.aws.amazon.com/cloudformation`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <span>View in AWS Console</span>
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
