"use client";

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CheckIcon, CopyIcon, DownloadIcon } from "./ui/icons";

interface FilePreviewTabsProps {
  files: Array<{
    filename: string;
    content: string;
    type?: string;
  }>;
  onDownloadAll?: () => void;
}

export default function FilePreviewTabs({
  files,
  onDownloadAll,
}: FilePreviewTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = async (filename: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const getLanguage = (filename: string, type?: string) => {
    if (filename === "Dockerfile") return "docker";
    if (filename.endsWith(".tf")) return "hcl";
    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "yaml";
    if (filename.endsWith(".json")) return "json";
    if (filename.endsWith(".sh")) return "bash";
    if (type === "terraform") return "hcl";
    if (type === "docker") return "docker";
    return "text";
  };

  const getFileIcon = (filename: string) => {
    if (filename === "Dockerfile") return "🐳";
    if (filename.endsWith(".tf")) return "🏗️";
    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "📋";
    if (filename.endsWith(".json")) return "📄";
    return "📁";
  };

  if (!files || files.length === 0) return null;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
      <div className="border-b border-gray-800/50">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <span>Generated Files</span>
            <span className="text-gray-600">({files.length})</span>
          </h3>
          {onDownloadAll && (
            <button
              onClick={onDownloadAll}
              className="px-3 py-1.5 text-xs border border-gray-800 hover:border-gray-700 bg-black hover:bg-gray-900 text-gray-400 hover:text-gray-300 rounded-md transition-all flex items-center gap-2"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Download All</span>
            </button>
          )}
        </div>

        <div className="flex overflow-x-auto bg-black/30">
          {files.map((file, idx) => (
            <button
              key={file.filename}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2.5 font-mono text-xs whitespace-nowrap border-b transition-all flex items-center gap-2 ${
                activeTab === idx
                  ? "border-white text-white bg-black/40"
                  : "border-transparent text-gray-500 hover:text-gray-400 hover:bg-black/20"
              }`}
            >
              <span className="text-sm">{getFileIcon(file.filename)}</span>
              <span>{file.filename}</span>
            </button>
          ))}
        </div>
      </div>

      {files[activeTab] && (
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() =>
                handleCopy(files[activeTab].filename, files[activeTab].content)
              }
              className="px-3 py-1.5 text-xs border border-gray-800 hover:border-gray-700 bg-black/80 backdrop-blur-sm hover:bg-black text-gray-400 hover:text-gray-300 rounded-md transition-all flex items-center gap-1.5"
            >
              {copiedFile === files[activeTab].filename ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="max-h-[500px] overflow-auto">
            <SyntaxHighlighter
              language={getLanguage(
                files[activeTab].filename,
                files[activeTab].type
              )}
              style={vscDarkPlus}
              showLineNumbers
              wrapLines
              customStyle={{
                margin: 0,
                padding: "1.25rem",
                background: "transparent",
                fontSize: "0.8125rem",
              }}
              lineNumberStyle={{
                minWidth: "2.5em",
                paddingRight: "1em",
                color: "#4b5563",
                userSelect: "none",
              }}
            >
              {files[activeTab].content}
            </SyntaxHighlighter>
          </div>
        </div>
      )}
    </div>
  );
}
