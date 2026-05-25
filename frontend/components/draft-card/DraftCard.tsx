"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DraftEditor } from "./DraftEditor";
import { useReviewStore } from "@/lib/store";
import { submitFeedback } from "@/lib/api";
import { toast } from "sonner";
import type { Draft } from "@/lib/types";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface DraftCardProps {
  draft: Draft;
}

function getVoiceBadgeStyle(score: number): {
  className: string;
  label: string;
} {
  if (score >= 0.8) {
    return {
      className: "bg-green-100 text-green-800 border-green-200",
      label: "Voice match: strong",
    };
  }
  if (score >= 0.6) {
    return {
      className: "bg-amber-100 text-amber-800 border-amber-200",
      label: "Voice match: moderate",
    };
  }
  return {
    className: "bg-red-100 text-red-800 border-red-200",
    label: "Voice match: weak",
  };
}

function getRecommendationStyle(rec: "Pursue" | "Skip" | "Review"): string {
  if (rec === "Pursue") return "bg-green-100 text-green-800 border-green-200";
  if (rec === "Skip") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Budget not specified";
  if (min !== null && max !== null)
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min !== null) return `From $${min.toLocaleString()}`;
  return `Up to $${max!.toLocaleString()}`;
}

export function DraftCard({ draft }: DraftCardProps) {
  const {
    scroll_gate_satisfied,
    reviewed_ids,
    setScrollGateSatisfied,
    markReviewed,
    openEditor,
    active_editor_draft_id,
  } = useReviewStore();

  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isScrollSatisfied = scroll_gate_satisfied[draft.id] ?? false;
  const isReviewed = reviewed_ids.includes(draft.id);
  const isEditorActive = active_editor_draft_id === draft.id && isEditorOpen;

  // IntersectionObserver on sentinel div at bottom of draft content
  // When sentinel is visible, sets scroll_gate_satisfied[draft.id] = true in Zustand
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isScrollSatisfied) {
            setScrollGateSatisfied(draft.id);
          }
        });
      },
      {
        // Use the scroll container as root so intersection is relative to it
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [draft.id, isScrollSatisfied, setScrollGateSatisfied]);

  const handleApprove = async () => {
    if (!isScrollSatisfied || isActioning) return;
    setIsActioning(true);
    try {
      const result = await submitFeedback(draft.id, "approve");
      if (result.clipboard_text) {
        await navigator.clipboard.writeText(result.clipboard_text);
      }
      // Open Upwork job URL in new tab — HITL: user submits manually on Upwork
      window.open(draft.job.url, "_blank", "noopener,noreferrer");

      // Post to HITL checkpoint stub
      await fetch("/api/hitl/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint: "cp2",
          run_id: draft.run_id,
          draft_id: draft.id,
          action: "approve",
          timestamp: new Date().toISOString(),
        }),
      });

      markReviewed(draft.id, "approve");
      toast.success("Copied to clipboard — Upwork tab opened");
    } catch {
      toast.error("Approve failed. Please try again.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleSkip = async () => {
    if (isActioning) return;
    setIsActioning(true);
    try {
      await submitFeedback(draft.id, "skip");

      // Post to HITL checkpoint stub
      await fetch("/api/hitl/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint: "cp2",
          run_id: draft.run_id,
          draft_id: draft.id,
          action: "skip",
          timestamp: new Date().toISOString(),
        }),
      });

      markReviewed(draft.id, "skip");
      toast.info("Draft skipped");
    } catch {
      toast.error("Skip failed. Please try again.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleEdit = () => {
    openEditor(draft.id);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
  };

  const voiceBadge = getVoiceBadgeStyle(draft.voice_confidence_score);
  const recStyle = getRecommendationStyle(draft.job.recommendation);

  if (isReviewed) {
    const statusLabel = draft.status === "Submitted" ? "Approved" : "Skipped";
    const statusColor =
      draft.status === "Submitted"
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-gray-50 border-gray-200 text-gray-500";

    return (
      <Card className={`border opacity-60 ${statusColor}`}>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{draft.job.title}</p>
            <span className="text-xs font-semibold shrink-0">{statusLabel}</span>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      {/* Card Header — job metadata */}
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base leading-tight">
              {draft.job.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-sm text-gray-500">
                {formatBudget(draft.job.budget_min, draft.job.budget_max)}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500">
                Client score: {draft.job.client_score}/10
              </span>
              <span className="text-gray-300">·</span>
              <Badge className={`text-xs border ${recStyle}`} variant="outline">
                {draft.job.recommendation}
              </Badge>
            </div>
          </div>
          <a
            href={draft.job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5"
            aria-label="Open job on Upwork"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-3">
        {/* Scroll-gated draft content */}
        <div
          ref={scrollContainerRef}
          className="relative h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3"
        >
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {draft.content}
          </p>
          {/* Sentinel div at bottom — IntersectionObserver triggers scroll gate */}
          <div ref={sentinelRef} className="h-px w-full mt-2" aria-hidden="true" />
        </div>

        {!isScrollSatisfied && (
          <p className="text-xs text-gray-400 mt-1 text-center">
            Scroll to the end to enable Approve
          </p>
        )}

        {/* Voice confidence badge + portfolio items */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge className={`text-xs border ${voiceBadge.className}`} variant="outline">
            {voiceBadge.label}
          </Badge>
          <span className="text-xs text-gray-400">Cases used:</span>
          {draft.portfolio_items_used.map((item) => (
            <Badge key={item} variant="outline" className="text-xs text-gray-600 border-gray-300">
              {item}
            </Badge>
          ))}
        </div>

        {/* Edit suggestions Alert — only when voice_confidence_score < 0.60 */}
        {draft.voice_confidence_score < 0.6 &&
          draft.edit_suggestions &&
          draft.edit_suggestions.length > 0 && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm font-semibold">
                Suggestions for improvement
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {draft.edit_suggestions.map((suggestion, i) => (
                    <li key={i} className="text-xs">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

        {/* Inline DraftEditor — opens when Edit is clicked */}
        {isEditorActive && (
          <DraftEditor
            draftId={draft.id}
            initialContent={draft.content}
            onClose={handleEditorClose}
          />
        )}

        {/* "Why this draft?" collapsible — collapsed by default */}
        <Collapsible open={isWhyOpen} onOpenChange={setIsWhyOpen} className="mt-3">
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {isWhyOpen ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            Why this draft?
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
              <div>
                <span className="font-semibold">Qualification:</span> score{" "}
                {draft.job.client_score}/10 — {draft.job.recommendation}
              </div>
              <div>
                <span className="font-semibold">Voice confidence:</span>{" "}
                {draft.voice_confidence_score.toFixed(2)} (
                {draft.voice_confidence_score >= 0.8
                  ? "strong"
                  : draft.voice_confidence_score >= 0.6
                    ? "moderate"
                    : "weak"}
                )
              </div>
              <div>
                <span className="font-semibold">Portfolio match:</span>{" "}
                {draft.portfolio_items_used.join(", ")}
              </div>
              <div>
                <span className="font-semibold">Generated by:</span> Proposal Writer
                (Opus 4.6) ·{" "}
                {new Date(draft.created_at).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Action buttons — right-aligned: Skip · Edit · Approve & Copy */}
      <CardFooter className="px-5 pb-5 pt-0 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={isActioning}
          aria-label="Skip this draft"
        >
          Skip
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEdit}
          disabled={isActioning}
          aria-label="Edit this draft"
        >
          Edit
        </Button>
        <Button
          variant="default"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
          onClick={handleApprove}
          disabled={!isScrollSatisfied || isActioning}
          aria-label={
            isScrollSatisfied
              ? "Approve and copy to clipboard"
              : "Scroll to end of draft to enable approve"
          }
          title={
            !isScrollSatisfied ? "Scroll to the end of the draft to enable" : undefined
          }
        >
          Approve & Copy
        </Button>
      </CardFooter>
    </Card>
  );
}
