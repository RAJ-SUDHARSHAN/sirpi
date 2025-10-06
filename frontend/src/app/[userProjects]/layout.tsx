"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";

export default function UserProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const { user, isLoaded } = useUser();
  const userProjects = params.userProjects as string;
  const [isClient, setIsClient] = useState(false);

  // Create tabs based on user namespace
  const tabs = [
    { name: "Overview", href: `/${userProjects}`, exact: true },
    { name: "Settings", href: `/${userProjects}/settings`, exact: false },
  ];

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Redirect to sign-in if not authenticated
  React.useEffect(() => {
    if (isLoaded && !user && isClient) {
      window.location.href = "/sign-in";
    }
  }, [isLoaded, user, isClient]);

  // Show loading state while checking authentication or during SSR
  if (!isLoaded || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black" lang="en">
      {/* Full-width header */}
      <header className="border-b border-gray-800">
        <div className="px-6 pt-4 pb-2">
          <div className="flex justify-between items-center">
            {/* Left side - Logo / User / Projects */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center cursor-pointer">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  Sirpi
                </div>
              </Link>

              {/* Chevron */}
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>

              <span className="text-gray-300">
                {user.firstName ||
                  user.emailAddresses[0].emailAddress.split("@")[0]}{" "}
                projects
              </span>
            </div>

            {/* Right side - User profile */}
            <div className="flex items-center">
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
            </div>
          </div>
        </div>

        {/* Tabs - also full width */}
        <div className="px-6 pt-1">
          <div className="flex">
            {tabs.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`py-3 px-2 border-b-1 font-medium text-sm transition-colors cursor-pointer ${
                    isActive
                      ? "border-white text-white"
                      : "border-transparent hover:bg-[#1F1F1F] hover:border-none"
                  }`}
                  style={{
                    color: isActive ? "#FFFFFF" : "#A1A1A1",
                  }}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content - full width */}
      <div className="px-6 py-8" lang="en">
        {children}
      </div>
    </div>
  );
}
