"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Image from "next/image";

export function ConditionalHeader() {
  const pathname = usePathname();
  const [shouldHide, setShouldHide] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Hide header on projects pages or user project workspaces
    const isProjectsPage = pathname?.startsWith("/projects");
    const pathSegments = pathname?.split("/").filter(Boolean) || [];
    const firstSegment = pathSegments[0];

    // Check if this is a user project workspace (any segment that doesn't start with common prefixes)
    const isUserProjectWorkspace =
      Boolean(firstSegment) &&
      !firstSegment.startsWith("api") &&
      !firstSegment.startsWith("github") &&
      !firstSegment.startsWith("_") &&
      firstSegment !== "projects" &&
      firstSegment !== "sign-in" &&
      firstSegment !== "sign-up" &&
      firstSegment !== "error";

    setShouldHide(isProjectsPage || isUserProjectWorkspace);
  }, [pathname]);

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  if (shouldHide) {
    return null;
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          {/* Logo */}
          <Link href="/" className="flex items-center cursor-pointer">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {/* Sirpi */}
              <Image src="/sirpi-logo-horizontal.png" alt="Sirpi" height={24} width={100} />
            </div>
          </Link>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link
                href="/sign-in?redirect_url=/projects"
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up?redirect_url=/projects"
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Try for free
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                    userButtonPopoverCard: "bg-gray-900 border border-gray-800",
                    userButtonPopoverActionButton:
                      "text-gray-300 hover:text-white hover:bg-gray-800",
                  },
                }}
              />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
