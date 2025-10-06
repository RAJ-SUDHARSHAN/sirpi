/**
 * Updated Project Detail Page
 * Connects to Bedrock AgentCore backend for infrastructure generation
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
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
  DownloadIcon,
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";
import { workflowApi } from "@/lib/api/workflow";
import { githubApi } from "@/lib/api/github";
import { downloadFilesAsZip } from "@/lib/utils/download";
import { getGitHubRepositoryUrl } from "@/lib/config/github";

const INFRASTRUCTURE_TEMPLATES = [
  {
    id: "ecs-fargate",
    name: "ECS Fargate",
    description: "Serverless container deployment with auto-scaling and load balancer",
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

type WorkflowStatus = "not_started" | "started" | "analyzing" | "generating" | "completed" | "failed";

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
  const [showFiles, setShowFiles] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [workflowState.logs, showLogs]);

  useEffect(() => {
    if (user) {
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
          githubApi.getInstallation()
        ]);
        
        if (installation) {
          setInstallationId(installation.installation_id);
        }
        
        if (overview) {
          const foundProject = (overview as any).projects.items.find(
            (p: Project) => p.slug === projectSlug
          );

          if (foundProject) {
            setProject(foundProject);
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

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleStartGeneration = async () => {
    if (!project || !installationId) {
      setWorkflowState(prev => ({
        ...prev,
        status: 'failed',
        message: 'Missing GitHub installation',
        error: 'Please reconnect your GitHub account'
      }));
      return;
    }

    console.log('Project data:', project);
    console.log('Sending workflow request:', {
      repository_url: project.repository_url,
      installation_id: installationId,
      template_type: selectedTemplate
    });

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
        template_type: selectedTemplate as any,
      });
      
      console.log('Workflow started:', response);

      const es = workflowApi.openWorkflowStream(response.session_id);
      setEventSource(es);

      es.addEventListener('status', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowState(prev => ({
          ...prev,
          status: data.status,
          message: data.message
        }));
      });

      es.addEventListener('log', (event) => {
        const log = JSON.parse(event.data);
        setWorkflowState((prev) => ({
          ...prev,
          logs: [...prev.logs, log],
          progress: getProgressForAgent(log.agent),
        }));
      });

      es.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        setWorkflowState((prev) => ({
          ...prev,
          status: data.status === 'completed' ? 'completed' : 'failed',
          message: data.status === 'completed' 
            ? 'Infrastructure generated successfully!' 
            : 'Generation failed',
          progress: 100,
          files: data.files || [],
          error: data.error,
        }));
        setIsGenerating(false);
        setShowFiles(true);
        es.close();
      });

      es.onerror = () => {
        setWorkflowState((prev) => ({
          ...prev,
          status: 'failed',
          message: 'Connection error',
          error: 'Lost connection to server',
        }));
        setIsGenerating(false);
        es.close();
      };

    } catch (error) {
      setWorkflowState({
        status: 'failed',
        message: 'Failed to start generation',
        progress: 0,
        logs: [],
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsGenerating(false);
    }
  };

  const getProgressForAgent = (agent: string): number => {
    const progressMap: Record<string, number> = {
      'orchestrator': 10,
      'github_analyzer': 25,
      'context_analyzer': 50,
      'dockerfile_generator': 75,
      'terraform_generator': 90,
    };
    return progressMap[agent] || 50;
  };

  const handleDownloadZip = async () => {
    if (workflowState.files.length === 0) return;

    await downloadFilesAsZip(
      workflowState.files,
      `${project?.name || 'infrastructure'}-files.zip`
    );
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

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
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

        {workflowState.status !== 'not_started' && (
          <div className="mb-8 bg-black border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(workflowState.status)}
                <span className="font-medium">{workflowState.message}</span>
              </div>
              <span className="text-sm text-gray-400">{workflowState.progress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  workflowState.status === 'failed'
                    ? 'bg-red-500'
                    : workflowState.status === 'completed'
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${workflowState.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {workflowState.status === 'not_started' && (
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
                          ? 'bg-gray-900 border-blue-500'
                          : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium">{template.name}</h3>
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
                            {template.features.map((feature) => (
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
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-600'
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

            {workflowState.status === 'failed' && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <p className="text-red-400 mb-4">
                  {workflowState.error || 'Generation failed. Please try again.'}
                </p>
                <button
                  onClick={() => {
                    setWorkflowState({
                      status: 'not_started',
                      message: 'Ready to generate infrastructure',
                      progress: 0,
                      logs: [],
                      files: [],
                    });
                    setShowLogs(false);
                    setShowFiles(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <RefreshIcon className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
              </div>
            )}

            {workflowState.logs.length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-900/30 transition-colors"
                >
                  <h3 className="text-lg font-medium flex items-center gap-3">
                    <span>🤖</span>
                    <span>AI Agent Logs ({workflowState.logs.length})</span>
                  </h3>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      showLogs ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showLogs && (
                  <div className="px-4 py-4 bg-black max-h-96 overflow-y-auto font-mono text-sm">
                    {workflowState.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3 mb-2 text-gray-300">
                        <span className="text-gray-500 text-xs min-w-[80px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`text-xs uppercase font-semibold min-w-[100px] ${
                            log.level === 'ERROR'
                              ? 'text-red-400'
                              : log.agent === 'orchestrator'
                              ? 'text-blue-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          [{log.agent}]
                        </span>
                        <span className="text-gray-300 flex-1">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {workflowState.files.length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg">
                <div className="p-6 flex items-center justify-between border-b border-gray-800">
                  <h3 className="text-lg font-medium flex items-center gap-3">
                    <span>📁</span>
                    <span>Generated Files ({workflowState.files.length})</span>
                  </h3>
                  <button
                    onClick={handleDownloadZip}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Download ZIP</span>
                  </button>
                </div>

                <div className="p-6 space-y-3">
                  {workflowState.files.map((file) => (
                    <div
                      key={file.filename}
                      className="border border-gray-700 rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                        <span className="text-blue-400 font-mono text-sm font-medium">
                          {file.filename}
                        </span>
                        <span className="text-xs text-gray-500">
                          {file.content.length} chars
                        </span>
                      </div>
                      <div className="bg-black p-4">
                        <pre className="text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                          {file.content}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workflowState.status === 'completed' && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Next Steps</h2>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "Download Infrastructure Files",
                      description: "Get your Dockerfile and Terraform configuration",
                    },
                    {
                      step: "2",
                      title: "Review Generated Code",
                      description: "Examine the infrastructure files and make any adjustments",
                    },
                    {
                      step: "3",
                      title: "Deploy to AWS",
                      description: "Use the Deploy section below to launch your infrastructure",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {item.step}
                      </span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-gray-400 text-sm">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Project Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className="capitalize">{workflowState.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Language</p>
                  <p>{project.language || "Not detected"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Template</p>
                  <p>
                    {INFRASTRUCTURE_TEMPLATES.find((t) => t.id === selectedTemplate)
                      ?.name || "ECS Fargate"}
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
                      <p className="text-gray-400 text-sm">{template.description}</p>
                      <div>
                        <p className="text-sm text-gray-400 mb-3">Features:</p>
                        <div className="space-y-2">
                          {template.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-gray-300">{feature}</span>
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
    </div>
  );
}
