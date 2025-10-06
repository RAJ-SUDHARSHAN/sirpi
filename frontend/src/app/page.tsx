import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="text-center">
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
              Automate Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                DevOps Infrastructure
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Connect your GitHub repositories, select deployment templates, and
              let AI generate production-ready infrastructure code in seconds.
            </p>

            {/* CTA Buttons */}
            <SignedOut>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link
                  href="/sign-up?redirect_url=/projects"
                  className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer"
                >
                  <span className="relative z-10">Get Started Free</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg blur opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </Link>
                <Link
                  href="/sign-in?redirect_url=/projects"
                  className="px-8 py-4 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white rounded-lg font-semibold transition-all duration-300 hover:bg-gray-800/50 cursor-pointer"
                >
                  View Demo
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Multi-cloud support</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Auto-scaling infrastructure</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Production-ready templates</span>
                </div>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="mb-16">
                <Link
                  href="/projects"
                  className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer inline-block"
                >
                  <span className="relative z-10">Go to Projects</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg blur opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </Link>
              </div>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Three simple steps to transform your repository into
            production-ready infrastructure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            step="01"
            title="Connect GitHub"
            description="Securely link your repositories with our GitHub App integration"
            icon="🔗"
            gradient="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            step="02"
            title="Select Templates"
            description="Choose from Docker, ECS, Kubernetes, or custom deployment templates"
            icon="📋"
            gradient="from-purple-500 to-pink-500"
          />
          <FeatureCard
            step="03"
            title="AI Generation"
            description="Our AI analyzes your code and generates optimized infrastructure"
            icon="✨"
            gradient="from-orange-500 to-red-500"
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <StatCard number="10x" label="Faster Deployment" />
          <StatCard number="99.9%" label="Uptime Guarantee" />
          <StatCard number="24/7" label="AI Monitoring" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  step,
  title,
  description,
  icon,
  gradient,
}: {
  step: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
}) {
  return (
    <div className="group relative">
      <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl blur-xl"></div>
      <div className="relative p-8 bg-gray-900/50 backdrop-blur-sm border border-gray-800 hover:border-gray-700 rounded-2xl transition-all duration-300 hover:transform hover:scale-105">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} mb-6`}
        >
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-sm font-mono text-gray-500 mb-2">{step}</div>
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="p-6">
      <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
        {number}
      </div>
      <div className="text-gray-400 font-medium">{label}</div>
    </div>
  );
}
