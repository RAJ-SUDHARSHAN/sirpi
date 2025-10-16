import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function GET() {
  try {
    // Get the authenticated user
    const { userId, getToken } = await auth();

    if (!userId) {
      redirect("/sign-in");
    }

    // Get the JWT token
    const token = await getToken();

    if (!token) {
      redirect("/sign-in");
    }

    // Make authenticated request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${backendUrl}/api/github/auth`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      redirect: "manual", // Don't follow redirects automatically
    });

    if (response.status === 302 || response.status === 307) {
      // Get the redirect URL from the Location header
      const redirectUrl = response.headers.get("Location");
      if (redirectUrl) {
        redirect(redirectUrl);
      }
    }

    // Check for other successful responses
    if (response.ok) {
      await response.text();
    }

    // If we get here, something went wrong
    redirect("/projects?error=github_auth_failed");
  } catch (error) {
    // Check if this is a Next.js redirect error (which is normal)
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      // This is a normal redirect, let it propagate
      throw error;
    }

    redirect("/projects?error=github_auth_failed");
  }
}
