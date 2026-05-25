"use client";

// DraftEditor.tsx — inline draft editing surface
// assistant-ui inline embed mode not confirmed (spec Open Question #6); using plain Textarea fallback.
// assistant-ui v0.14.5 requires AssistantRuntime context connected to an LLM backend (Anthropic API key),
// which is not available in the MVP stub. Thread cannot be embedded inline without a backend runtime.
// Fallback: plain controlled Textarea with "Save edits" button calling submitFeedback(draftId, "edit", content).
// Integration epic should revisit once backend is wired (SAD Section 4 FastAPI route table).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/api";
import { useReviewStore } from "@/lib/store";
import { toast } from "sonner";

interface DraftEditorProps {
  draftId: string;
  initialContent: string;
  onClose: () => void;
}

export function DraftEditor({ draftId, initialContent, onClose }: DraftEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const { updateDraftContent, resetScrollGate, closeEditor } = useReviewStore();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await submitFeedback(draftId, "edit", content);
      updateDraftContent(draftId, content);
      // Reset scroll gate — user must re-scroll edited draft before approving (spec Section 3.5)
      resetScrollGate(draftId);
      toast.success("Draft updated — please re-read before approving");
      closeEditor();
      onClose();
    } catch {
      toast.error("Failed to save edits. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    closeEditor();
    onClose();
  };

  return (
    <div className="mt-4 border-t pt-4">
      <p className="text-sm font-medium text-gray-700 mb-2">Edit proposal</p>
      <p className="text-xs text-gray-500 mb-3">
        AI assist pending — edit your proposal here. After saving, you must re-read the
        updated draft before the Approve button becomes active.
      </p>
      {/*
        Fallback: plain Textarea.
        assistant-ui inline embed mode not confirmed (spec Open Question #6); using plain Textarea fallback.
        @assistant-ui/react v0.14.5 requires AssistantRuntime + LLM backend;
        cannot embed Thread inline without backend API key.
        Revisit in Integration epic once FastAPI backend is wired.
      */}
      <textarea
        className="w-full min-h-[240px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="AI assist pending — edit your proposal here"
        aria-label="Edit draft proposal"
      />
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || content.trim() === ""}
        >
          {isSaving ? "Saving..." : "Save edits"}
        </Button>
      </div>
    </div>
  );
}
