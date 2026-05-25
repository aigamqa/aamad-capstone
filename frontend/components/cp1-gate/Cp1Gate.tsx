"use client";

// Cp1Gate.tsx — CP1 conditional HITL gate
// MVP Decision: Implemented as a collapsible Alert at top of page, NOT a full Dialog.
// This resolves spec Open Question #3: collapsible Alert chosen over blocking Dialog for MVP.
// Rationale: Dialog provides stronger enforcement but Dialog component not available in shadcn base-nova theme.
// The Alert approach is less disruptive while still surfacing borderline jobs prominently.
// "Cannot navigate away" is enforced via soft beforeunload warning only (per spec Section 3.4).
// Traceability: frontend.md Section 6 (CP1 Gate Decision).

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface BorderlineJob {
  id: string;
  title: string;
  budget_min: number | null;
  budget_max: number | null;
  client_score: number;
  reasoning: string;
  red_flags: string[];
  green_flags: string[];
}

interface Cp1GateProps {
  borderlineJobs: BorderlineJob[];
  onResolved: (approvedJobIds: string[]) => void;
}

function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Budget not specified";
  if (min !== null && max !== null)
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min !== null) return `From $${min.toLocaleString()}`;
  return `Up to $${max!.toLocaleString()}`;
}

export function Cp1Gate({ borderlineJobs, onResolved }: Cp1GateProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, "include" | "skip" | null>>(
    () => Object.fromEntries(borderlineJobs.map((j) => [j.id, null]))
  );

  const allResolved = Object.values(decisions).every((d) => d !== null);

  // Soft beforeunload warning while CP1 is unresolved (spec Section 3.4)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!allResolved) {
        e.preventDefault();
        e.returnValue = "CP1 review is in progress — please action all borderline jobs before leaving.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [allResolved]);

  const handleDecide = (jobId: string, decision: "include" | "skip") => {
    setDecisions((prev) => ({ ...prev, [jobId]: decision }));
  };

  const handleDismiss = async () => {
    if (!allResolved) {
      toast.warning("Please action all borderline jobs before continuing");
      return;
    }

    const approvedJobIds = Object.entries(decisions)
      .filter(([, decision]) => decision === "include")
      .map(([id]) => id);

    // Post to HITL checkpoint stub — unblocks CrewAI Flow wait() state for CP1
    try {
      await fetch("/api/hitl/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint: "cp1",
          approved_job_ids: approvedJobIds,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Stub may not be wired yet — proceed anyway in MVP
    }

    onResolved(approvedJobIds);
  };

  if (borderlineJobs.length === 0) return null;

  const pendingCount = Object.values(decisions).filter((d) => d === null).length;

  return (
    <div className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              <AlertTitle className="text-amber-800 font-semibold">
                CP1: {borderlineJobs.length} borderline job
                {borderlineJobs.length !== 1 ? "s" : ""} require your review
              </AlertTitle>
              <AlertDescription className="text-amber-700 mt-0.5">
                These jobs scored between 0.4–0.6 (borderline). Include or skip each
                before proposals are drafted.
                {pendingCount > 0 && (
                  <span className="font-semibold ml-1">
                    {pendingCount} remaining.
                  </span>
                )}
              </AlertDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-2 shrink-0 text-amber-700">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-3 space-y-3">
            {borderlineJobs.map((job) => {
              const decision = decisions[job.id];
              return (
                <div
                  key={job.id}
                  className="rounded-md border border-amber-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatBudget(job.budget_min, job.budget_max)} · Client score:{" "}
                        {job.client_score}/10
                      </p>
                    </div>
                    <Badge
                      className="text-xs bg-amber-100 text-amber-800 border-amber-200 shrink-0"
                      variant="outline"
                    >
                      Review
                    </Badge>
                  </div>
                  {job.green_flags.length > 0 && (
                    <p className="text-xs text-green-700 mt-1">
                      Green: {job.green_flags.join(", ")}
                    </p>
                  )}
                  {job.red_flags.length > 0 && (
                    <p className="text-xs text-red-700 mt-0.5">
                      Red: {job.red_flags.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1 italic">{job.reasoning}</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={decision === "include" ? "default" : "outline"}
                      size="sm"
                      className={
                        decision === "include"
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : ""
                      }
                      onClick={() => handleDecide(job.id, "include")}
                    >
                      Include in drafts
                    </Button>
                    <Button
                      variant={decision === "skip" ? "default" : "ghost"}
                      size="sm"
                      className={decision === "skip" ? "bg-gray-600 text-white" : ""}
                      onClick={() => handleDecide(job.id, "skip")}
                    >
                      Skip this job
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-1">
              <Button
                variant="default"
                size="sm"
                onClick={handleDismiss}
                disabled={!allResolved}
                className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                {allResolved
                  ? "Continue to drafting"
                  : `Action ${pendingCount} remaining job${pendingCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </CollapsibleContent>
        </Alert>
      </Collapsible>
    </div>
  );
}
