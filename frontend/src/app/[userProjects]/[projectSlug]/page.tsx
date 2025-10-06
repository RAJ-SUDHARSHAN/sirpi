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
} from "@/components/ui/icons";
import {
  Project,
  getUserProjectNamespace,
  projectsApi,
} from "@/lib/api/projects";

interface UserOverview {
  projects: {
    count: number;
    items: Project[];
  };
  repositories?: {
    items: RepositoryItem[];
  };
}
import { workflowApi } from "@/lib/api/workflow";
import { getGitHubRepositoryUrl } from "@/lib/config/github";

// Define template interface
interface InfrastructureTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode | string;
  provider: string;
  features: string[];
  recommended: boolean;
}

// AWS Service Icons
const EC2Icon = () => (
  <svg
    width="40px"
    height="40px"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <rect width="80" height="80" fill="url(#ec2-gradient)" />
      <defs>
        <linearGradient id="ec2-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop stopColor="#C8511B" offset="0%"></stop>
          <stop stopColor="#FF9900" offset="100%"></stop>
        </linearGradient>
      </defs>
      <path
        d="M27,53 L52,53 L52,28 L27,28 L27,53 Z M54,28 L58,28 L58,30 L54,30 L54,34 L58,34 L58,36 L54,36 L54,39 L58,39 L58,41 L54,41 L54,45 L58,45 L58,47 L54,47 L54,51 L58,51 L58,53 L54,53 L54,53.136 C54,54.164 53.164,55 52.136,55 L52,55 L52,59 L50,59 L50,55 L46,55 L46,59 L44,59 L44,55 L41,55 L41,59 L39,59 L39,55 L35,55 L35,59 L33,59 L33,55 L29,55 L29,59 L27,59 L27,55 L26.864,55 C25.836,55 25,54.164 25,53.136 L25,53 L22,53 L22,51 L25,51 L25,47 L22,47 L22,45 L25,45 L25,41 L22,41 L22,39 L25,39 L25,36 L22,36 L22,34 L25,34 L25,30 L22,30 L22,28 L25,28 L25,27.864 C25,26.836 25.836,26 26.864,26 L27,26 L27,22 L29,22 L29,26 L33,26 L33,22 L35,22 L35,26 L39,26 L39,22 L41,22 L41,26 L44,26 L44,22 L46,22 L46,26 L50,26 L50,22 L52,22 L52,26 L52.136,26 C53.164,26 54,26.836 54,27.864 L54,28 Z M41,65.876 C41,65.944 40.944,66 40.876,66 L14.124,66 C14.056,66 14,65.944 14,65.876 L14,39.124 C14,39.056 14.056,39 14.124,39 L20,39 L20,37 L14.124,37 C12.953,37 12,37.953 12,39.124 L12,65.876 C12,67.047 12.953,68 14.124,68 L40.876,68 C42.047,68 43,67.047 43,65.876 L43,61 L41,61 L41,65.876 Z M68,14.124 L68,40.876 C68,42.047 67.047,43 65.876,43 L60,43 L60,41 L65.876,41 C65.944,41 66,40.944 66,40.876 L66,14.124 C66,14.056 65.944,14 65.876,14 L39.124,14 C39.056,14 39,14.056 39,14.124 L39,20 L37,20 L37,14.124 C37,12.953 37.953,12 39.124,12 L65.876,12 C67.047,12 68,12.953 68,14.124 L68,14.124 Z"
        fill="#FFFFFF"
      ></path>
    </g>
  </svg>
);

// AWS Service Icons
const FargateIcon = () => (
  <svg
    width="40px"
    height="40px"
    viewBox="0 0 80 80"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Icon-Architecture/64/Arch_AWS-Fargate_64</title>
    <desc>Created with Sketch.</desc>
    <defs>
      <linearGradient x1="0%" y1="100%" x2="100%" y2="0%" id="linearGradient-1">
        <stop stop-color="#C8511B" offset="0%"></stop>
        <stop stop-color="#FF9900" offset="100%"></stop>
      </linearGradient>
    </defs>
    <g
      id="Icon-Architecture/64/Arch_AWS-Fargate_64"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <g id="Icon-Architecture-BG/64/Compute" fill="url(#linearGradient-1)">
        <rect id="Rectangle" x="0" y="0" width="80" height="80"></rect>
      </g>
      <g
        id="Icon-Service/64/AWS-Fargate"
        transform="translate(8.000000, 8.000000)"
        fill="#FFFFFF"
      >
        <path
          d="M44,48.523 L44,43.677 L47,42.477 L47,47.323 L44,48.523 Z M39,42.477 L42,43.677 L42,48.523 L39,47.323 L39,42.477 Z M33,55.523 L33,50.677 L36,49.477 L36,54.323 L33,55.523 Z M28,49.477 L31,50.677 L31,55.523 L28,54.323 L28,49.477 Z M22,48.523 L22,43.677 L25,42.477 L25,47.323 L22,48.523 Z M17,42.477 L20,43.677 L20,48.523 L17,47.323 L17,42.477 Z M21,40.077 L23.308,41 L21,41.923 L18.692,41 L21,40.077 Z M32,47.077 L34.308,48 L32,48.923 L29.692,48 L32,47.077 Z M43,40.077 L45.308,41 L43,41.923 L40.692,41 L43,40.077 Z M48.371,40.071 L43.371,38.071 C43.133,37.977 42.867,37.977 42.629,38.071 L37.629,40.071 C37.249,40.224 37,40.591 37,41 L37,46.923 L32.371,45.071 C32.133,44.977 31.867,44.977 31.629,45.071 L27,46.923 L27,41 C27,40.591 26.751,40.224 26.371,40.071 L21.371,38.071 C21.133,37.977 20.867,37.977 20.629,38.071 L15.629,40.071 C15.249,40.224 15,40.591 15,41 L15,48 C15,48.409 15.249,48.776 15.629,48.929 L20.629,50.929 C20.748,50.976 20.874,51 21,51 C21.126,51 21.252,50.976 21.371,50.929 L26,49.077 L26,55 C26,55.409 26.249,55.776 26.629,55.929 L31.629,57.929 C31.748,57.976 31.874,58 32,58 C32.126,58 32.252,57.976 32.371,57.929 L37.371,55.929 C37.751,55.776 38,55.409 38,55 L38,49.077 L42.629,50.929 C42.748,50.976 42.874,51 43,51 C43.126,51 43.252,50.976 43.371,50.929 L48.371,48.929 C48.751,48.776 49,48.409 49,48 L49,41 C49,40.591 48.751,40.224 48.371,40.071 L48.371,40.071 Z M57,27.938 C57,33.783 44.119,36.938 32,36.938 C19.881,36.938 7,33.783 7,27.938 C7,25.147 10.095,22.69 15.715,21.019 L16.285,22.936 C11.791,24.272 9,26.189 9,27.938 C9,31.249 18.445,34.938 32,34.938 C45.555,34.938 55,31.249 55,27.938 C55,26.189 52.209,24.272 47.715,22.936 L48.285,21.019 C53.905,22.69 57,25.147 57,27.938 L57,27.938 Z M32,9.071 L42.214,13 L32,16.929 L21.786,13 L32,9.071 Z M42.58,28.842 C40.694,29.686 37.528,30.669 33,30.801 L33,18.687 L44,14.457 L44,26.648 C44,27.599 43.444,28.46 42.58,28.842 L42.58,28.842 Z M20,26.648 L20,14.457 L31,18.687 L31,30.801 C26.472,30.669 23.306,29.686 21.416,28.84 C20.556,28.46 20,27.599 20,26.648 L20,26.648 Z M20.604,30.667 C22.805,31.652 26.569,32.827 32,32.827 C37.431,32.827 41.195,31.652 43.393,30.669 C44.977,29.968 46,28.39 46,26.648 L46,13 C46,12.586 45.745,12.215 45.359,12.066 L32.359,7.066 C32.127,6.978 31.873,6.978 31.641,7.066 L18.641,12.066 C18.255,12.215 18,12.586 18,13 L18,26.648 C18,28.39 19.023,29.968 20.604,30.667 L20.604,30.667 Z"
          id="AWS-Fargate_Icon_64_Squid"
        ></path>
      </g>
    </g>
  </svg>
);

// AWS Service Icons
const LambdaIcon = () => (
  <svg
    width="40px"
    height="40px"
    viewBox="0 0 80 80"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Icon-Architecture/64/Arch_AWS-Lambda_64</title>
    <desc>Created with Sketch.</desc>
    <defs>
      <linearGradient x1="0%" y1="100%" x2="100%" y2="0%" id="linearGradient-1">
        <stop stop-color="#C8511B" offset="0%"></stop>
        <stop stop-color="#FF9900" offset="100%"></stop>
      </linearGradient>
    </defs>
    <g
      id="Icon-Architecture/64/Arch_AWS-Lambda_64"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <g id="Icon-Architecture-BG/64/Compute" fill="url(#linearGradient-1)">
        <rect id="Rectangle" x="0" y="0" width="80" height="80"></rect>
      </g>
      <path
        d="M28.0075352,66 L15.5907274,66 L29.3235885,37.296 L35.5460249,50.106 L28.0075352,66 Z M30.2196674,34.553 C30.0512768,34.208 29.7004629,33.989 29.3175745,33.989 L29.3145676,33.989 C28.9286723,33.99 28.5778583,34.211 28.4124746,34.558 L13.097944,66.569 C12.9495999,66.879 12.9706487,67.243 13.1550766,67.534 C13.3374998,67.824 13.6582439,68 14.0020416,68 L28.6420072,68 C29.0299071,68 29.3817234,67.777 29.5481094,67.428 L37.563706,50.528 C37.693006,50.254 37.6920037,49.937 37.5586944,49.665 L30.2196674,34.553 Z M64.9953491,66 L52.6587274,66 L32.866809,24.57 C32.7014253,24.222 32.3486067,24 31.9617091,24 L23.8899822,24 L23.8990031,14 L39.7197081,14 L59.4204149,55.429 C59.5857986,55.777 59.9386172,56 60.3255148,56 L64.9953491,56 L64.9953491,66 Z M65.9976745,54 L60.9599868,54 L41.25928,12.571 C41.0938963,12.223 40.7410777,12 40.3531778,12 L22.89768,12 C22.3453987,12 21.8963569,12.447 21.8953545,12.999 L21.884329,24.999 C21.884329,25.265 21.9885708,25.519 22.1780103,25.707 C22.3654452,25.895 22.6200358,26 22.8866544,26 L31.3292417,26 L51.1221625,67.43 C51.2885485,67.778 51.6393624,68 52.02626,68 L65.9976745,68 C66.5519605,68 67,67.552 67,67 L67,55 C67,54.448 66.5519605,54 65.9976745,54 L65.9976745,54 Z"
        id="AWS-Lambda_Icon_64_Squid"
        fill="#FFFFFF"
      ></path>
    </g>
  </svg>
);

// Template definitions
const INFRASTRUCTURE_TEMPLATES: InfrastructureTemplate[] = [
  {
    id: "ecs-fargate",
    name: "ECS Fargate",
    description:
      "Serverless container deployment with AWS ECS Fargate, ALB, and ECR",
    icon: <FargateIcon />,
    provider: "AWS",
    features: ["Auto-scaling", "Load Balancer", "Container Registry", "VPC"],
    recommended: true,
  },
  {
    id: "lambda-api",
    name: "Lambda API",
    description: "Serverless REST API with AWS Lambda and API Gateway",
    icon: <LambdaIcon />,
    provider: "AWS",
    features: ["Serverless", "API Gateway", "Auto-scaling", "Pay-per-use"],
    recommended: false,
  },
  {
    id: "ec2-autoscaling",
    name: "EC2 Auto Scaling",
    description: "Traditional auto-scaling web application on AWS EC2",
    icon: <EC2Icon />,
    provider: "AWS",
    features: ["EC2 Instances", "Auto Scaling", "Load Balancer", "EBS Storage"],
    recommended: false,
  },
];

// Workflow status types
type WorkflowStatus =
  | "not_started"
  | "mcp_connecting"
  | "repo_analyzing"
  | "generating"
  | "branch_creating"
  | "ready_to_deploy"
  | "failed";

interface StreamingEvent {
  type: string;
  message?: string;
  content?: string;
  timestamp: number;
  chunk_id?: number;
  data?: Record<string, unknown>;
}

interface WorkflowState {
  status: WorkflowStatus;
  message: string;
  progress: number;
  error?: string;
  branch_name?: string;
  commit_sha?: string;
  build_logs?: Array<{
    timestamp: number;
    level: string;
    message: string;
  }>;
  github_urls?:
    | Record<string, string>
    | {
        branch: string;
        commit: string;
        compare: string;
        pull_request?: string;
      };
  composio_auth_url?: string;
  needs_auth?: boolean;
}

interface RepositoryItem {
  name: string;
  full_name: string;
  html_url?: string;
}

// AWS Deployment Component - Simplified
interface AWSDeploymentSectionProps {
  project: Project;
  userProjects: string;
}

const AWSDeploymentSection: React.FC<AWSDeploymentSectionProps> = ({
  project,
  userProjects,
}) => {
  const router = useRouter();

  const handleNavigateToDeployment = () => {
    router.push(`/${userProjects}/${project.slug}/deploy`);
  };

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white"
            >
              <path d="M18.77 14.85c-.37.15-.75.22-1.13.22-1.09 0-2.1-.56-2.67-1.49L12 8.85l-2.97 4.73c-.57.93-1.58 1.49-2.67 1.49-.38 0-.76-.07-1.13-.22L2 16.15v3.7c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3.7l-3.23-1.3z" />
              <path d="M4 4c-1.1 0-2 .9-2 2v6.85l3.23-1.3c.37-.15.75-.22 1.13-.22 1.09 0 2.1.56 2.67 1.49L12 17.55l2.97-4.73c.57-.93 1.58-1.49 2.67-1.49.38 0 .76.07 1.13.22L22 12.85V6c0-1.1-.9-2-2-2H4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Deploy to AWS</h3>
            <p className="text-gray-400 text-sm">
              Deploy your infrastructure to Amazon Web Services
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start space-x-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            ✓
          </div>
          <div className="flex-1">
            <h4 className="text-white font-medium mb-1">
              Infrastructure Ready
            </h4>
            <p className="text-gray-400 text-sm">
              Your infrastructure files are generated and ready for deployment.
              The deployment wizard will guide you through setting up AWS
              credentials and deploying your application.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-sm font-medium text-white">Fast Setup</div>
            <div className="text-xs text-gray-400 mt-1">5-10 minutes</div>
          </div>
          <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="text-2xl mb-2">💰</div>
            <div className="text-sm font-medium text-white">Cost Efficient</div>
            <div className="text-xs text-gray-400 mt-1">$50-100/month</div>
          </div>
          <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="text-2xl mb-2">🔒</div>
            <div className="text-sm font-medium text-white">Secure</div>
            <div className="text-xs text-gray-400 mt-1">Industry standard</div>
          </div>
        </div>

        <button
          onClick={handleNavigateToDeployment}
          className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center space-x-2"
        >
          <span>🚀</span>
          <span>Deploy to AWS</span>
        </button>
      </div>
    </div>
  );
};

export default function ProjectPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const userProjects = params.userProjects as string;
  const projectSlug = params.projectSlug as string;

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [userOverview, setUserOverview] = useState<UserOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("ecs-fargate");
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    status: "not_started",
    message: "Ready to deploy infrastructure",
    progress: 0,
    build_logs: [],
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTemplateSelection, setShowTemplateSelection] = useState(true);

  // Enhanced SSE streaming state
  const [perplexityResponse, setPerplexityResponse] = useState("");
  const [streamingLogs, setStreamingLogs] = useState<StreamingEvent[]>([]);
  const [persistentLogs, setPersistentLogs] = useState<StreamingEvent[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>(
    {}
  );
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isPerplexityThinking, setIsPerplexityThinking] = useState(false);
  const [showGeneratedFiles, setShowGeneratedFiles] = useState(false);
  const [lastThinkingTimestamp, setLastThinkingTimestamp] = useState<
    number | null
  >(null);
  const [perplexityAnalysis, setPerplexityAnalysis] = useState<string>("");
  const [showPerplexityAnalysis, setShowPerplexityAnalysis] = useState(true);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingLogs, showLogs]);

  // Validate user namespace
  useEffect(() => {
    if (user) {
      const expectedNamespace = getUserProjectNamespace(
        user as unknown as Record<string, unknown>
      );
      if (userProjects !== expectedNamespace) {
        router.replace(`/${expectedNamespace}/${projectSlug}`);
        return;
      }
    }
  }, [user, userProjects, projectSlug, router]);

  // Load project details and user overview
  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);
        const overview = await projectsApi.getUserOverview();
        if (overview) {
          setUserOverview(overview as unknown as UserOverview);
          const foundProject = (
            overview as unknown as UserOverview
          ).projects.items.find(
            (p: Project) =>
              p.slug === projectSlug ||
              p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === projectSlug
          );

          if (foundProject) {
            setProject(foundProject);

            // Check if infrastructure is already deployed
            if (foundProject.status === "ready_to_deploy") {
              setShowTemplateSelection(false);
              setWorkflowState({
                status: "ready_to_deploy",
                message: "Infrastructure files generated successfully",
                progress: 100,
              });

              // Load workflow data for ready_to_deploy projects
              await loadWorkflowData(foundProject.slug);
            } else if (foundProject.status === "generating") {
              setShowTemplateSelection(false);
              setWorkflowState({
                status: "generating",
                message: "Generating infrastructure files...",
                progress: 60,
              });
            }
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

  // Function to load workflow data from API
  const loadWorkflowData = async (slug: string) => {
    try {
      const data = await workflowApi.getProjectWorkflowData(slug);

      if (data.success) {
        // Populate UI with workflow data
        if (data.events && data.events.length > 0) {
          setPersistentLogs(data.events);
        }

        if (data.perplexity_analysis) {
          setPerplexityAnalysis(data.perplexity_analysis);
        }

        if (data.generated_files) {
          setGeneratedFiles(data.generated_files);
        }

        if (data.github_urls) {
          setWorkflowState((prev) => ({
            ...prev,
            github_urls: data.github_urls,
          }));
        }
      }
    } catch (error) {
      // Error handled by calling code
    }
  };

  const handleStartDeployment = async () => {
    if (!project) return;

    setIsDeploying(true);
    setShowTemplateSelection(false);
    setShowLogs(true);
    setWorkflowState({
      status: "mcp_connecting",
      message: "Initializing deployment...",
      progress: 10,
    });

    // Start SSE streaming
    startSSEStreaming();
  };

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case "not_started":
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
      case "mcp_connecting":
      case "repo_analyzing":
      case "generating":
      case "branch_creating":
        return (
          <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        );
      case "ready_to_deploy":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const startSSEStreaming = () => {
    if (!project) return;

    setStreamingLogs([]);
    setPersistentLogs([]);
    setPerplexityResponse("");
    setGeneratedFiles({});
    setIsPerplexityThinking(false);
    setLastThinkingTimestamp(null);
    setPerplexityAnalysis("");

    const url = `${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    }/api/workflow/stream-infrastructure/${
      project.slug
    }?template_name=${selectedTemplate}`;
    const es = new EventSource(url);

    setEventSource(es);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventData: StreamingEvent = {
          ...data,
          timestamp: data.timestamp || Date.now(),
        };

        // Process heartbeat events differently
        if (data.type === "heartbeat") {
          // Only add a heartbeat event if it's been more than 3 seconds since the last one
          if (
            !lastThinkingTimestamp ||
            Date.now() - lastThinkingTimestamp > 3000
          ) {
            setLastThinkingTimestamp(Date.now());

            // Generate contextual thinking message based on current state
            let thinkingMessage = "🤔 AI is thinking...";
            if (isPerplexityThinking) {
              const thinkingMessages = [
                "🧠 Analyzing repository structure...",
                "🔍 Examining code patterns...",
                "⚙️ Designing infrastructure...",
                "📋 Planning deployment strategy...",
                "🎯 Optimizing configuration...",
              ];
              thinkingMessage =
                thinkingMessages[
                  Math.floor(Math.random() * thinkingMessages.length)
                ];
            } else {
              thinkingMessage = "Processing...";
            }

            const thinkingEvent = {
              ...eventData,
              type: "thinking",
              message: thinkingMessage,
            };
            setPersistentLogs((prev) => [...prev, thinkingEvent]);
          }
          return; // Don't add heartbeat to streaming logs
        } else {
          // Reset thinking timestamp when we get a non-heartbeat event
          setLastThinkingTimestamp(null);
        }

        // Add to both streaming and persistent logs
        setPersistentLogs((prev) => [...prev, eventData]);

        // Handle different event types
        switch (data.type) {
          case "status":
            setWorkflowState((prev) => ({
              ...prev,
              message: data.message || "Processing...",
              progress: getProgressForStatus(data.message || ""),
            }));
            break;

          case "perplexity_start":
            setIsPerplexityThinking(true);
            setWorkflowState((prev) => ({
              ...prev,
              status: "generating",
              message: "🧠 Perplexity AI is analyzing your repository...",
              progress: 30,
            }));
            break;

          case "perplexity_iteration_start":
            setWorkflowState((prev) => ({
              ...prev,
              message: data.message || "🧠 Perplexity AI is thinking...",
              progress: 40,
            }));
            break;

          case "perplexity_chunk":
            // Fix the undefined issue by properly accessing data.content
            if (data.content || data.message) {
              const newContent = data.content || data.message || "";
              setPerplexityResponse((prev) => prev + newContent);

              // Also append to the analysis that will be persisted
              setPerplexityAnalysis((prev) => prev + newContent);
            }
            setWorkflowState((prev) => ({
              ...prev,
              message: "🧠 Perplexity is generating response...",
              progress: 50,
            }));
            break;

          case "perplexity_complete":
            // Don't reset perplexityResponse here to keep the content
            setIsPerplexityThinking(false);
            setWorkflowState((prev) => ({
              ...prev,
              message: "✅ Analysis complete, generating files...",
              progress: 80,
            }));
            break;

          case "files_generated":
            setGeneratedFiles(data.data?.files || {});
            setWorkflowState((prev) => ({
              ...prev,
              message: `📁 Generated ${
                data.data?.count || 0
              } infrastructure files`,
              progress: 90,
            }));
            break;

          case "complete":
            setWorkflowState((prev) => {
              // Get github_urls from data or previous state
              const githubUrls = data.data?.github_urls || prev.github_urls;

              return {
                ...prev,
                status: "ready_to_deploy",
                message: "🎉 Infrastructure generation completed!",
                progress: 100,
                github_urls: githubUrls,
              };
            });
            setIsDeploying(false); // Reset loading state
            es.close();
            break;

          case "error":
            setWorkflowState((prev) => ({
              ...prev,
              status: "failed",
              message: "❌ Generation failed",
              error: data.message || "Unknown error occurred",
              progress: 0,
            }));
            setIsDeploying(false); // Reset loading state
            es.close();
            break;

          default:
            console.log("Unknown event type:", data.type, data);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error, event.data);
      }
    };

    es.onerror = (error) => {
      console.error("SSE error:", error);
      setWorkflowState((prev) => ({
        ...prev,
        status: "failed",
        message: "❌ Connection error during generation",
        error: "Lost connection to server",
        progress: 0,
      }));
      setIsPerplexityThinking(false);
      setIsDeploying(false); // Reset loading state
      es.close();
    };
  };

  const getProgressForStatus = (message: string): number => {
    if (message.includes("Initializing")) return 10;
    if (message.includes("Looking up")) return 15;
    if (message.includes("Found project")) return 20;
    if (message.includes("Checking GitHub")) return 25;
    if (message.includes("authentication required")) return 30;
    if (message.includes("successful")) return 35;
    if (message.includes("Analyzing")) return 40;
    if (message.includes("Perplexity")) return 50;
    if (message.includes("complete")) return 70;
    if (message.includes("Generating")) return 80;
    if (message.includes("Generated")) return 90;
    if (message.includes("completed")) return 100;
    return 50;
  };

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Get repository URL from user overview
  const getRepositoryUrl = (): string | undefined => {
    if (userOverview?.repositories?.items) {
      const repo = (userOverview.repositories.items as RepositoryItem[]).find(
        (r) =>
          r.name === project?.repository_name ||
          r.full_name === project?.repository_name
      );
      return (
        repo?.html_url ||
        (project?.repository_name
          ? getGitHubRepositoryUrl(project.repository_name)
          : undefined)
      );
    }
    return project?.repository_name
      ? getGitHubRepositoryUrl(project.repository_name)
      : undefined;
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <button
            onClick={() => router.push(`/${userProjects}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Projects
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">
              Project Not Found
            </h1>
            <p className="text-gray-400 mb-8">
              The requested project could not be found.
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
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/${userProjects}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Projects
          </button>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {project.name}
                </h1>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(workflowState.status)}
                  <span
                    className={`text-sm font-medium px-3 py-1 rounded-full ${
                      workflowState.status === "ready_to_deploy"
                        ? "bg-green-900/30 text-green-400"
                        : workflowState.status === "failed"
                        ? "bg-red-900/30 text-red-400"
                        : "bg-blue-900/30 text-blue-400"
                    }`}
                  >
                    {workflowState.status === "ready_to_deploy"
                      ? "ready to deploy"
                      : workflowState.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-6 text-gray-400 text-sm">
                <div className="flex items-center space-x-2">
                  <GitHubIcon className="w-4 h-4" />
                  <span>{project.repository_name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>{project.language || "Language not detected"}</span>
                </div>
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              {getRepositoryUrl() && (
                <a
                  href={getRepositoryUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <GitHubIcon className="w-4 h-4" />
                  <span>Repository</span>
                  <ExternalLinkIcon className="w-4 h-4" />
                </a>
              )}

              {workflowState.status === "ready_to_deploy" &&
                workflowState.github_urls && (
                  <a
                    href={workflowState.github_urls.branch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-gray-100 transition-colors flex items-center space-x-2 cursor-pointer"
                  >
                    <span>View Infrastructure</span>
                    <ExternalLinkIcon className="w-4 h-4" />
                  </a>
                )}
            </div>
          </div>
        </div>

        {/* Progress Status Bar */}
        {!showTemplateSelection && (
          <div className="mb-8">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(workflowState.status)}
                  <span className="text-base font-medium text-white">
                    {workflowState.message}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-400">
                    {workflowState.progress}%
                  </span>
                  {/* <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800 transition-colors flex items-center space-x-2 cursor-pointer"
                  >
                    <span>Logs</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 transform transition-transform ${
                        showLogs ? "rotate-180" : ""
                      }`}
                    />
                  </button> */}
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    workflowState.status === "failed"
                      ? "bg-red-500"
                      : workflowState.status === "ready_to_deploy"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${workflowState.progress}%` }}
                />
              </div>
            </div>

            {/* Error Message */}
            {workflowState.error && (
              <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400">{workflowState.error}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Template Selection */}
            {showTemplateSelection && (
              <div className="bg-black border border-gray-800 rounded-lg p-8">
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-3">
                    Choose Infrastructure Template
                  </h2>
                  <p className="text-gray-400">
                    Select the template that best fits your application.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {INFRASTRUCTURE_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      className={`p-6 rounded-lg cursor-pointer transition-all border ${
                        selectedTemplate === template.id
                          ? "bg-gray-900 border-blue-500"
                          : "bg-gray-900/50 border-gray-700 hover:border-gray-600 hover:bg-gray-900"
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl">
                            {typeof template.icon === "string"
                              ? template.icon
                              : template.icon}
                          </span>
                          <div>
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-medium text-white">
                                {template.name}
                              </h3>
                              {template.recommended && (
                                <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
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
                                  className="px-3 py-1 bg-gray-800 text-gray-300 text-sm rounded"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div
                            className={`w-5 h-5 rounded-full border-2 ${
                              selectedTemplate === template.id
                                ? "bg-blue-500 border-blue-500"
                                : "border-gray-600"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartDeployment}
                  disabled={isDeploying}
                  className="w-full px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 font-medium cursor-pointer"
                >
                  {isDeploying ? (
                    <>
                      <RefreshIcon className="w-5 h-5 animate-spin" />
                      <span>Starting Deployment...</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-5 h-5" />
                      <span>Deploy Infrastructure</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Success Actions */}
            {workflowState.status === "ready_to_deploy" &&
              workflowState.github_urls && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                  <p className="text-green-400 mb-4 font-medium">
                    🎉 Infrastructure files generated and committed
                    successfully!
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`${getRepositoryUrl()}/branches`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      <GitHubIcon className="w-4 h-4" />
                      <span>View Branches</span>
                      <ExternalLinkIcon className="w-4 h-4" />
                    </a>
                    <a
                      href={workflowState.github_urls.compare}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      <span>Compare Changes</span>
                      <ExternalLinkIcon className="w-4 h-4" />
                    </a>
                    {workflowState.github_urls.pull_request && (
                      <a
                        href={workflowState.github_urls.pull_request}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 cursor-pointer"
                      >
                        <GitHubIcon className="w-4 h-4" />
                        <span>View Pull Request</span>
                        <ExternalLinkIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

            {/* AWS Deployment Section */}
            {workflowState.status === "ready_to_deploy" && (
              <AWSDeploymentSection
                project={project}
                userProjects={userProjects}
              />
            )}

            {/* Retry Button for Failed State */}
            {workflowState.status === "failed" && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <p className="text-red-400 mb-4">
                  Deployment failed. Please try again.
                </p>
                <button
                  onClick={() => {
                    setShowTemplateSelection(true);
                    setShowLogs(false);
                    setWorkflowState({
                      status: "not_started",
                      message: "Ready to deploy infrastructure",
                      progress: 0,
                    });
                    setPersistentLogs([]);
                    setStreamingLogs([]);
                    setPerplexityResponse("");
                    setGeneratedFiles({});
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <RefreshIcon className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
              </div>
            )}

            {/* Perplexity AI Thinking */}
            {(isPerplexityThinking || perplexityAnalysis) && (
              <div className="bg-black border border-gray-800 rounded-lg">
                <button
                  onClick={() =>
                    setShowPerplexityAnalysis(!showPerplexityAnalysis)
                  }
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-900/30 transition-colors cursor-pointer"
                >
                  <h3 className="text-lg font-medium text-white flex items-center space-x-3">
                    <span className="text-xl">🧠</span>
                    <span>Perplexity AI Analysis</span>
                    {isPerplexityThinking && (
                      <div className="flex space-x-1 ml-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                      </div>
                    )}
                  </h3>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      showPerplexityAnalysis ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showPerplexityAnalysis && (
                  <div className="px-6 pb-6">
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="text-sm text-gray-400 mb-2">
                        🤔 Thinking Process:
                      </div>
                      <div className="text-green-400 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {isPerplexityThinking ? (
                          <>
                            {perplexityResponse
                              .split(/READY_TO_GENERATE|ANALYSIS_SUMMARY/)
                              .map((chunk, i) => (
                                <div key={i} className="mb-2">
                                  {chunk}
                                </div>
                              ))}
                            <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse"></span>
                          </>
                        ) : (
                          perplexityAnalysis
                            .split(/READY_TO_GENERATE|ANALYSIS_SUMMARY/)
                            .map((chunk, i) => (
                              <div key={i} className="mb-2">
                                {chunk}
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Generated Files */}
            {generatedFiles && Object.keys(generatedFiles).length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg">
                <button
                  onClick={() => setShowGeneratedFiles(!showGeneratedFiles)}
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-900/30 transition-colors cursor-pointer"
                >
                  <h3 className="text-lg font-medium text-white flex items-center space-x-3">
                    <span>📁</span>
                    <span>
                      Generated Files ({Object.keys(generatedFiles).length})
                    </span>
                  </h3>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      showGeneratedFiles ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showGeneratedFiles && (
                  <div className="px-6 pb-6 space-y-3">
                    {Object.entries(generatedFiles).map(
                      ([filename, content]) => (
                        <div
                          key={filename}
                          className="border border-gray-700 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                            <span className="text-blue-400 font-mono text-sm font-medium">
                              {filename}
                            </span>
                            <span className="text-xs text-gray-500">
                              {content.length} chars
                            </span>
                          </div>
                          <div className="bg-black p-4">
                            <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
                              {content.substring(0, 300)}
                              {content.length > 300 && "..."}
                            </pre>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Terminal Logs */}
            {persistentLogs.length > 0 && (
              <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-900/30 transition-colors cursor-pointer"
                >
                  <h3 className="text-lg font-medium text-white flex items-center space-x-3">
                    <span>📟</span>
                    <span>Deployment Logs ({persistentLogs.length})</span>
                  </h3>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      showLogs ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showLogs && (
                  <div className="px-4 py-4 bg-black max-h-96 overflow-y-auto font-mono text-sm">
                    {persistentLogs.map((log, index) => {
                      // Skip displaying consecutive thinking logs
                      if (
                        log.type === "thinking" &&
                        index > 0 &&
                        persistentLogs[index - 1].type === "thinking" &&
                        Date.now() - log.timestamp < 3000
                      ) {
                        return null;
                      }

                      return (
                        <div
                          key={index}
                          className="flex items-start space-x-3 mb-2 text-gray-300"
                        >
                          <span className="text-gray-500 text-xs min-w-[80px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`text-xs uppercase font-semibold min-w-[80px] ${
                              log.type === "error" ||
                              log.type === "deployment_failed" ||
                              log.type === "deployment_error"
                                ? "text-red-400"
                                : log.type === "complete" ||
                                  log.type === "deployment_complete"
                                ? "text-green-400"
                                : log.type === "status" ||
                                  log.type === "deployment_progress"
                                ? "text-blue-400"
                                : log.type === "perplexity_chunk"
                                ? "text-green-400"
                                : log.type === "thinking"
                                ? "text-yellow-400"
                                : log.type === "deployment_start" ||
                                  log.type === "deployment_timeout"
                                ? "text-orange-400"
                                : log.type === "deployment_endpoints"
                                ? "text-purple-400"
                                : "text-yellow-400"
                            }`}
                          >
                            {log.type === "perplexity_chunk"
                              ? "perplexity"
                              : log.type.replace("_", " ")}
                          </span>
                          <span className="text-gray-300 flex-1 whitespace-pre-wrap">
                            {log.message || log.content || ""}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Next Steps */}
            {workflowState.status === "ready_to_deploy" && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium text-white mb-4">
                  Next Steps
                </h2>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "Review Generated Files",
                      description:
                        "Check infrastructure/ directory in your repository",
                    },
                    {
                      step: "2",
                      title: "Deploy to AWS",
                      description:
                        "Use the Deploy to AWS section above to launch your infrastructure",
                    },
                    {
                      step: "3",
                      title: "Monitor & Scale",
                      description:
                        "View deployed resources and monitor costs in AWS console",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start space-x-4">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {item.step}
                      </span>
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="text-gray-400 text-sm">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Details */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">
                Project Details
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className="text-white capitalize">{project.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Language</p>
                  <p className="text-white">
                    {project.language || "Not detected"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Template</p>
                  <p className="text-white">
                    {INFRASTRUCTURE_TEMPLATES.find(
                      (t) => t.id === selectedTemplate
                    )?.name || "ECS Fargate"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Repository</p>
                  <p className="text-white text-sm break-all">
                    {project.repository_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Created</p>
                  <p className="text-white">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Template Info */}
            {selectedTemplate && (
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Template Info
                </h3>
                {(() => {
                  const template = INFRASTRUCTURE_TEMPLATES.find(
                    (t) => t.id === selectedTemplate
                  );
                  return template ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {typeof template.icon === "string"
                            ? template.icon
                            : template.icon}
                        </span>
                        <span className="text-white font-medium">
                          {template.name}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        {template.description}
                      </p>
                      <div>
                        <p className="text-sm text-gray-400 mb-3">Features:</p>
                        <div className="space-y-2">
                          {template.features.map((feature) => (
                            <div
                              key={feature}
                              className="flex items-center space-x-2"
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
    </div>
  );
}
