"use client";

import React, { useState } from "react";
import { XCircleIcon } from "./ui/icons";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
  hasAgentCoreContext?: boolean;
}

interface SirpiAssistantProps {
  projectId: string;
  allLogs?: string[];
}

// Simple markdown renderer for assistant responses
function renderMarkdown(text: string): string {
  let html = text;

  // Convert **bold** to <strong>
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-white">$1</strong>'
  );

  // Convert ### headers to styled divs
  html = html.replace(
    /^### (.+)$/gm,
    '<div class="text-sm font-semibold text-purple-300 mt-3 mb-1">$1</div>'
  );

  // Convert ## headers
  html = html.replace(
    /^## (.+)$/gm,
    '<div class="text-base font-bold text-white mt-4 mb-2">$1</div>'
  );

  // Convert # headers
  html = html.replace(
    /^# (.+)$/gm,
    '<div class="text-lg font-bold text-white mt-4 mb-2">$1</div>'
  );

  // Convert bullet points (- or •)
  html = html.replace(
    /^[•-] (.+)$/gm,
    '<div class="flex gap-2 ml-2 my-1"><span class="text-purple-400 flex-shrink-0">•</span><span>$1</span></div>'
  );

  // Convert numbered lists
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div class="flex gap-2 ml-2 my-1"><span class="text-purple-400 flex-shrink-0">$1.</span><span>$2</span></div>'
  );

  // Convert line breaks to paragraphs
  html = html
    .split("\n\n")
    .map((para) => (para.trim() ? `<p class="my-2">${para}</p>` : ""))
    .join("");

  return html;
}

export default function SirpiAssistant({
  projectId,
  allLogs = [],
}: SirpiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleAsk = async (question: string) => {
    if (!question.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsAsking(true);

    try {
      const token = await (window as any).Clerk?.session?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/assistant/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            question: question,
            include_logs: true,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.data.answer,
            hasAgentCoreContext: data.data.has_agentcore_context,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to connect. Please try again.",
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isAsking) {
      handleAsk(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all hover:scale-110 p-0.5"
        >
          <Image
            src="/sirpi-logo-circle.png"
            alt="Sirpi AI"
            className="w-full h-full object-contain"
            height={56}
            width={56}
          />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-[#0a0a0a] border border-[#333333] rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333333]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center p-0.5">
                <Image
                  src="/sirpi-logo-circle.png"
                  alt="Sirpi"
                  className="w-full h-full object-contain"
                  height={40}
                  width={40}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Sirpi AI Assistant
                </h3>
                <p className="text-xs text-gray-500">
                  Powered by Amazon Nova Pro
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Disclaimer */}
          <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-400/30">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
              <p className="text-xs text-blue-200">
                AI-powered assistant using AgentCore context. Review suggestions
                before applying.
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="py-8 px-4">
                <p className="text-base font-medium text-white mb-4">
                  👋 Hi! I'm your Sirpi AI Assistant
                </p>
                <div className="text-sm text-gray-400 space-y-3">
                  <p>I can help you with:</p>
                  <div className="text-sm space-y-1.5 pl-1">
                    <p>• Understanding your deployment</p>
                    <p>• Explaining infrastructure resources</p>
                    <p>• Analyzing errors and failures</p>
                    <p>• Answering questions about your project</p>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-blue-500/20 border border-blue-400/30 text-blue-100"
                      : "bg-[#111111] border border-[#333333] text-gray-200"
                  }`}
                >
                  {msg.role === "assistant" && msg.hasAgentCoreContext && (
                    <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-purple-500/30">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      <span className="text-xs text-purple-300">
                        Using AgentCore Context
                      </span>
                    </div>
                  )}
                  <div
                    className="text-sm leading-relaxed break-words"
                    dangerouslySetInnerHTML={{
                      __html:
                        msg.role === "assistant"
                          ? renderMarkdown(msg.content)
                          : msg.content,
                    }}
                  />
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex justify-start">
                <div className="bg-[#111111] border border-[#333333] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-[#333333]"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your infrastructure.."
                disabled={isAsking}
                className="flex-1 px-3 py-2 bg-black border border-[#333333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isAsking}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>

            {/* Quick Questions */}
            {messages.length === 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAsk("What resources were created?")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-gray-600 hover:text-white transition-colors"
                >
                  What resources were created?
                </button>
                <button
                  type="button"
                  onClick={() => handleAsk("Why did my deployment fail?")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-gray-600 hover:text-white transition-colors"
                >
                  Why did it fail?
                </button>
                <button
                  type="button"
                  onClick={() => handleAsk("Explain the infrastructure")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-gray-600 hover:text-white transition-colors"
                >
                  Explain infrastructure
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
