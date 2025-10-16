"use client";

import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";

interface SuccessCelebrationProps {
  show: boolean;
  title?: string;
  message?: string;
  stats?: {
    label: string;
    value: string;
  }[];
  onClose?: () => void;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }[];
}

export function SuccessCelebration({
  show,
  title = "🎉 Infrastructure Generated!",
  message = "Your production-ready infrastructure is ready to deploy",
  stats,
  onClose,
  actions = [],
}: SuccessCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });

      // Stop confetti after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show) return null;

  return (
    <>
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={dimensions.width}
          height={dimensions.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="relative max-w-2xl w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-green-500/30 rounded-2xl shadow-2xl animate-in zoom-in duration-500">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-xl" />

          {/* Content */}
          <div className="relative p-8">
            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg
                    className="w-12 h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Title & Message */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
              <p className="text-lg text-gray-300">{message}</p>
            </div>

            {/* Stats Grid */}
            {stats && stats.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-center"
                  >
                    <div className="text-2xl font-bold text-white mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div className="flex gap-3 justify-center">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 ${
                      action.variant === "secondary"
                        ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                        : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Note: Install react-confetti
// npm install react-confetti react-use
