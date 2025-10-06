import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get the user's authentication token
    const { getToken } = await auth();
    const token = await getToken();

    if (!token) {
      return NextResponse.redirect(
        new URL("/sign-in?redirect_url=/projects/import", request.url)
      );
    }

    // Make authenticated request to backend OAuth endpoint
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/github/oauth/auth`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      redirect: "manual", // Don't follow redirects automatically
    });

    // If backend returns a redirect, follow it
    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get("location");
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // If there's an error, redirect to error page
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.redirect(
        new URL(
          `/error?message=oauth_auth_failed&detail=${encodeURIComponent(
            errorText
          )}`,
          request.url
        )
      );
    }

    // This shouldn't happen, but just in case
    return NextResponse.redirect(new URL("/projects/import", request.url));
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/error?message=oauth_auth_error&detail=${encodeURIComponent(
          String(error)
        )}`,
        request.url
      )
    );
  }
}
