import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GitHubIcon } from "@/components/ui/icons";

export default async function GitHubSetupPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const success = searchParams.success === "true";
  const installationId = searchParams.installation_id as string;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg p-8 text-center">
        <GitHubIcon className="w-16 h-16 mx-auto text-light-text-secondary dark:text-dark-text-secondary mb-6" />

        {success ? (
          <>
            <h1 className="text-2xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
              GitHub Connection Successful!
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
              Your GitHub account has been connected successfully. You can now
              import your repositories.
            </p>
          </>
        ) : installationId ? (
          <>
            <h1 className="text-2xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
              Processing GitHub Installation
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
              Your GitHub App installation is being processed. Please wait a
              moment.
            </p>
            <div className="w-full h-2 bg-light-border dark:bg-dark-border rounded-full overflow-hidden mb-8">
              <div className="h-full bg-primary rounded-full animate-pulse w-1/2"></div>
            </div>
            <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
              Installation ID: {installationId}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
              GitHub Connection Required
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
              You need to connect your GitHub account to import repositories.
            </p>
          </>
        )}

        <div className="mt-8">
          <Link
            href="/projects"
            className="inline-block px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
