"use client";

// AppBar.tsx — Root app bar
// Wireframe spec: h-16 sticky top-0 bg-white border-b z-50
// Left: "AI Sales Team" logo text
// Center: run_id + last_updated (from Zustand store)
// Right: Settings gear icon (stub, links to #settings)

import { Settings } from "lucide-react";
import { useReviewStore } from "@/lib/store";

export function AppBar() {
  const { run_id } = useReviewStore();

  const lastUpdated = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="h-16 sticky top-0 bg-white border-b z-50 flex items-center px-6">
      {/* Left: logo */}
      <div className="flex-1">
        <span className="font-semibold text-gray-900 text-sm">AI Sales Team</span>
      </div>

      {/* Center: run_id + last_updated */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>
          run_id:{" "}
          <span className="font-mono text-gray-700">{run_id ?? "—"}</span>
        </span>
        <span>last_updated: {lastUpdated}</span>
      </div>

      {/* Right: Settings gear — stub, links to #settings */}
      <div className="flex-1 flex justify-end">
        <a
          href="#settings"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded"
          aria-label="Settings (coming in V1)"
          title="Settings — placeholder for V1"
        >
          <Settings size={18} />
        </a>
      </div>
    </header>
  );
}
