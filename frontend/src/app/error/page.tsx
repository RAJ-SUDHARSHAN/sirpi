"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ExclamationCircleIcon } from "@/components/ui/icons";

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const message = searchParams.get("message") || "unknown_error";
  const detail = searchParams.get("detail") || "";

  const getErrorInfo = (errorMessage: string) => {
    switch (errorMessage) {
      case "oauth_auth_failed":
        return {
          title: "GitHub OAuth Authentication Failed",
          description:
            "There was an issue connecting to GitHub using OAuth. Please try again.",
          suggestion:
            "Try connecting using the GitHub App option instead, or contact support if the issue persists.",
        };
      case "oauth_callback_failed":
        return {
          title: "GitHub OAuth Callback Failed",
          description:
            "The OAuth authorization was not completed successfully.",
          suggestion: "Please try the authentication process again.",
        };
      case "oauth_auth_error":
        return {
          title: "OAuth Authentication Error",
          description:
            "An unexpected error occurred during GitHub OAuth authentication.",
          suggestion: "Please try again or use the GitHub App option.",
        };
      case "state_missing":
        return {
          title: "Authentication State Missing",
          description: "The authentication state was lost during the process.",
          suggestion: "Please start the authentication process again.",
        };
      case "user_not_found_in_db":
        return {
          title: "User Not Found",
          description: "Your user account was not found in our database.",
          suggestion:
            "Please sign out and sign in again to refresh your account.",
        };
      default:
        return {
          title: "Something Went Wrong",
          description: "An unexpected error occurred.",
          suggestion:
            "Please try again or contact support if the issue persists.",
        };
    }
  };

  const errorInfo = getErrorInfo(message);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
          <ExclamationCircleIcon className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          {errorInfo.title}
        </h1>

        <p className="text-gray-400 mb-6">{errorInfo.description}</p>

        <p className="text-sm text-gray-500 mb-8">{errorInfo.suggestion}</p>

        {detail && (
          <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-400 mb-2">Error Details:</p>
            <p className="text-xs text-gray-300 font-mono break-all">
              {detail}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => router.push("/projects/import")}
            className="w-full px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            Try Again
          </button>

          <button
            onClick={() => router.push("/projects")}
            className="w-full px-6 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors border border-gray-600"
          >
            Back to Projects
          </button>
        </div>
      </div>
    </div>
  );
}
