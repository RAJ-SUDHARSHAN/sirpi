"use client";

import React, { useState } from "react";
import { XCircleIcon } from "./ui/icons";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  hasAgentCoreContext?: boolean;
}

interface SirpiAssistantProps {
  projectId: string;
}

export default function SirpiAssistant({ projectId }: SirpiAssistantProps) {
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
      const token = await (
        window as { Clerk?: { session?: { getToken: () => Promise<string> } } }
      ).Clerk?.session?.getToken();
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
            hasAgentCoreContext: data.data.agentcore_memory_used,
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
    } catch {
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
        <div className="fixed bottom-6 right-6 w-[420px] h-[650px] bg-[#0a0a0a] border border-[#333333] rounded-lg shadow-2xl z-50 flex flex-col">
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

          {/* AgentCore Badge */}
          <div className="px-4 py-2.5 bg-purple-500/10 border-b border-purple-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-xs text-purple-300 font-medium">
                Connected to AWS AgentCore Memory
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="py-8 px-4">
                <p className="text-base font-medium text-white mb-4">
                  👋 Hi! I&apos;m your Sirpi AI Assistant
                </p>
                <div className="text-sm text-gray-400 space-y-3">
                  <p>I can help you with:</p>
                  <div className="text-sm space-y-1.5 pl-1">
                    <p>• Getting your application URL</p>
                    <p>• Understanding deployed resources</p>
                    <p>• Explaining infrastructure details</p>
                    <p>• Analyzing deployment errors</p>
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
                  className={`max-w-[90%] rounded-lg p-3.5 ${
                    msg.role === "user"
                      ? "bg-blue-500/20 border border-blue-400/30 text-blue-100"
                      : "bg-[#111111] border border-[#333333] text-gray-200"
                  }`}
                >
                  {msg.role === "assistant" && msg.hasAgentCoreContext && (
                    <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-purple-500/30">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      <span className="text-xs text-purple-300 font-medium">
                        Using AgentCore Context
                      </span>
                    </div>
                  )}

                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Style headers
                          h1: ({ children }) => (
                            <h1 className="text-lg font-bold text-white mt-4 mb-2">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold text-white mt-3 mb-1.5">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold text-purple-300 mt-2 mb-1">
                              {children}
                            </h3>
                          ),
                          // Style paragraphs
                          p: ({ children }) => (
                            <p className="text-sm text-gray-300 my-2 leading-relaxed">
                              {children}
                            </p>
                          ),
                          // Style lists
                          ul: ({ children }) => (
                            <ul className="text-sm text-gray-300 my-2 space-y-1 list-none pl-0">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="text-sm text-gray-300 my-2 space-y-1 pl-5">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="flex gap-2 items-start">
                              <span className="text-purple-400 flex-shrink-0 mt-0.5">
                                •
                              </span>
                              <span>{children}</span>
                            </li>
                          ),
                          // Style code
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code
                                className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <code
                                className="block bg-black/50 text-purple-300 p-2 rounded text-xs font-mono overflow-x-auto"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          // Style links
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              {children}
                            </a>
                          ),
                          // Style strong/bold
                          strong: ({ children }) => (
                            <strong className="font-semibold text-white">
                              {children}
                            </strong>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex justify-start">
                <div className="bg-[#111111] border border-[#333333] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">
                      Analyzing with AgentCore...
                    </span>
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
                placeholder="Ask me anything..."
                disabled={isAsking}
                className="flex-1 px-3 py-2.5 bg-black border border-[#333333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim() || isAsking}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>

            {/* Quick Questions */}
            {messages.length === 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAsk("What's my application URL?")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-purple-500 hover:text-purple-300 transition-colors"
                  disabled={isAsking}
                >
                  Get app URL
                </button>
                <button
                  type="button"
                  onClick={() => handleAsk("What resources were created?")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-purple-500 hover:text-purple-300 transition-colors"
                  disabled={isAsking}
                >
                  List resources
                </button>
                <button
                  type="button"
                  onClick={() => handleAsk("Explain my infrastructure")}
                  className="text-xs px-3 py-1.5 bg-[#111111] text-gray-400 rounded-md border border-[#333333] hover:border-purple-500 hover:text-purple-300 transition-colors"
                  disabled={isAsking}
                >
                  Explain setup
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
