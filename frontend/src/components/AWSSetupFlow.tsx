"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircleIcon,
  ExternalLinkIcon,
  ExclamationCircleIcon,
} from "./ui/icons";
import { apiCall } from "@/lib/api-client";

interface AWSStep {
  number: number;
  title: string;
  description: string;
  status: "pending" | "current" | "completed";
}

interface AWSSetupFlowProps {
  isVisible: boolean;
  onComplete: (roleArn: string) => void;
  onClose: () => void;
  projectId?: string;
}

export default function AWSSetupFlow({
  isVisible,
  onComplete,
  onClose,
  projectId,
}: AWSSetupFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [roleArn, setRoleArn] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [cloudFormationUrl, setCloudFormationUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const steps: AWSStep[] = [
    {
      number: 1,
      title: "Connect Your AWS Account",
      description:
        "We'll guide you through setting up secure access for Sirpi to deploy infrastructure in your AWS account.",
      status: currentStep === 0 ? "current" : "pending",
    },
    {
      number: 2,
      title: "Create IAM Role",
      description:
        "Click the magic link below to open AWS Console with a pre-filled CloudFormation template.",
      status: currentStep === 1 ? "current" : "pending",
    },
    {
      number: 3,
      title: "Verify Connection",
      description:
        "After the CloudFormation stack creates, copy the Role ARN and paste it below.",
      status: currentStep === 2 ? "current" : "pending",
    },
  ];

  useEffect(() => {
    if (isVisible) {
      generateCloudFormationUrl();
    }
  }, [isVisible]);

  const generateCloudFormationUrl = async () => {
    setUrlError("");
    try {
      const response = await apiCall("/aws/generate-setup-url", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Generated CloudFormation URL:", data.cloudFormationUrl);
        setCloudFormationUrl(data.cloudFormationUrl);
      } else {
        console.error(
          "API response not ok:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Error response:", errorText);
        setUrlError(
          `Failed to generate CloudFormation URL: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Failed to generate CloudFormation URL:", error);
      setUrlError("Network error while generating CloudFormation URL");
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleVerifyConnection = async () => {
    if (!roleArn.trim()) return;

    setIsVerifying(true);
    try {
      const response = await apiCall("/aws/verify-connection", {
        method: "POST",
        body: JSON.stringify({
          roleArn,
          projectId: projectId || undefined,
        }),
      });

      if (response.ok) {
        onComplete(roleArn);
      } else {
        alert(
          "Failed to verify connection. Please check the Role ARN and try again."
        );
      }
    } catch (error) {
      console.error("Verification failed:", error);
      alert("Failed to verify connection. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[#333333] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Connect AWS Account
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="mb-8">
            {steps.map((step) => (
              <div key={step.number} className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 mt-1">
                  {step.status === "completed" ? (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                        step.status === "current"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {step.number}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="space-y-6">
            {currentStep === 0 && (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    One-Time AWS Setup
                  </h3>
                  <p className="text-gray-400">
                    Sirpi needs permission to deploy infrastructure in your AWS
                    account. This is a secure, one-time setup that takes about 2
                    minutes.
                  </p>
                </div>
                <button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Start Setup
                </button>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {urlError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <ExclamationCircleIcon className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-300 mb-1">
                          Failed to Generate CloudFormation URL
                        </h4>
                        <p className="text-sm text-red-200">{urlError}</p>
                        <button
                          onClick={generateCloudFormationUrl}
                          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ExclamationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-300 mb-1">
                        Important: AWS Console Login Required
                      </h4>
                      <p className="text-sm text-blue-200">
                        Make sure you&apos;re logged into the correct AWS
                        account before clicking the button below. You&apos;ll be
                        redirected to AWS Console.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111111] border border-[#333333] rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-200 mb-2">
                    What happens next:
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• AWS Console opens in a new tab</li>
                    <li>• CloudFormation template is pre-loaded</li>
                    <li>• All parameters are pre-filled</li>
                    <li>
                      • Just click &ldquo;Create Stack&rdquo; (one click!)
                    </li>
                    <li>• Stack creates in ~30 seconds</li>
                  </ul>
                </div>

                <button
                  onClick={() => window.open(cloudFormationUrl, "_blank")}
                  disabled={!cloudFormationUrl}
                  className="w-full bg-white text-black hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed py-4 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLinkIcon className="w-5 h-5" />
                  {!cloudFormationUrl
                    ? "Generating URL..."
                    : "Create IAM Role in AWS Console"}
                </button>

                {cloudFormationUrl && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                      View Generated URL (for debugging)
                    </summary>
                    <div className="mt-2 p-2 bg-black border border-[#333333] rounded text-xs font-mono break-all text-gray-400">
                      {cloudFormationUrl}
                    </div>
                  </details>
                )}

                {!cloudFormationUrl && !urlError && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      If the automatic URL generation fails, you can manually
                      create the CloudFormation stack:
                    </p>
                    <ol className="text-sm text-yellow-800 mt-2 space-y-1">
                      <li>
                        1. Open{" "}
                        <a
                          href="https://console.aws.amazon.com/cloudformation"
                          target="_blank"
                          className="underline"
                        >
                          AWS CloudFormation Console
                        </a>
                      </li>
                      <li>
                        2. Click &ldquo;Create Stack&rdquo; → &ldquo;With new
                        resources&rdquo;
                      </li>
                      <li>
                        3. Enter template URL:{" "}
                        <code className="bg-yellow-100 px-1 rounded">
                          https://sirpi-generated-files.s3.us-west-2.amazonaws.com/cloudformation/sirpi-setup.yaml
                        </code>
                      </li>
                      <li>
                        4. Stack name:{" "}
                        <code className="bg-yellow-100 px-1 rounded">
                          sirpi-deployment-role
                        </code>
                      </li>
                      <li>5. Fill parameters and create stack</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-300 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-green-300 mb-1">
                        CloudFormation Stack Created!
                      </h4>
                      <p className="text-sm text-green-200">
                        Now copy the Role ARN from the stack outputs and paste
                        it below.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-white">
                    Role ARN
                  </label>
                  <input
                    type="text"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789:role/SirpiDeploymentRole"
                    className="w-full px-3 py-2 bg-black border border-[#333333] rounded-md text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    You can find this in the CloudFormation stack Outputs tab
                  </p>
                </div>

                <button
                  onClick={handleVerifyConnection}
                  disabled={!roleArn.trim() || isVerifying}
                  className="w-full bg-white text-black hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  {isVerifying ? "Verifying..." : "Verify & Connect"}
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-[#333333]">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {currentStep < steps.length - 1 && (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm bg-white text-black hover:bg-gray-100 rounded transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
