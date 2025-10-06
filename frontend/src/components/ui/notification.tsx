"use client";

import React, { useEffect, useState } from "react";
import { CheckCircleIcon, XCircleIcon } from "@/components/ui/icons";

interface NotificationProps {
  type: "success" | "error";
  title: string;
  message: string;
  show: boolean;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function Notification({
  type,
  title,
  message,
  show,
  onClose,
  autoClose = true,
  duration = 5000,
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      if (autoClose) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 300); // Wait for animation to complete
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [show, autoClose, duration, onClose]);

  if (!show) return null;

  const bgColor = type === "success" ? "bg-green-900/90" : "bg-red-900/90";
  const borderColor =
    type === "success" ? "border-green-800" : "border-red-800";
  const iconColor = type === "success" ? "text-green-400" : "text-red-400";
  const textColor = type === "success" ? "text-green-200" : "text-red-200";
  const messageColor = type === "success" ? "text-green-300" : "text-red-300";

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`${bgColor} ${borderColor} border rounded-lg p-4 shadow-lg backdrop-blur-sm max-w-sm transform transition-all duration-300 ${
          isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
      >
        <div className="flex items-start gap-3">
          {type === "success" ? (
            <CheckCircleIcon
              className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`}
            />
          ) : (
            <XCircleIcon
              className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium ${textColor}`}>{title}</h3>
            <p className={`text-sm ${messageColor} mt-1`}>{message}</p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className={`${iconColor} hover:opacity-70 transition-opacity flex-shrink-0`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
