import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  // Redirect /dashboard to /projects
  if (
    req.nextUrl.pathname === "/dashboard" ||
    req.nextUrl.pathname.startsWith("/dashboard/")
  ) {
    const newPath = req.nextUrl.pathname.replace("/dashboard", "/projects");
    const url = req.nextUrl.clone();
    url.pathname = newPath;
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
