"use client";

// dashboard/page.tsx — Main dashboard with FSM state machine
// FSM states: idle | running_scan | running_qualify | cp1_pending | running_write | cp2_ready | done | error
// Uses SWR to poll getRunStatus (3000ms during running states, stopped in cp2_ready/done/error)
// Zustand ReviewSessionState drives all per-draft state

import { useEffect, useReducer, useCallback } from "react";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DraftCard } from "@/components/draft-card/DraftCard";
import { Cp1Gate } from "@/components/cp1-gate/Cp1Gate";
import { useReviewStore } from "@/lib/store";
import { startScan, getRunStatus, getDrafts } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { RunStatus } from "@/lib/types";

// FSM state type
type FsmState =
  | "idle"
  | "running_scan"
  | "running_qualify"
  | "cp1_pending"
  | "running_write"
  | "cp2_ready"
  | "done"
  | "error";

type FsmAction =
  | { type: "SCAN_TRIGGERED" }
  | { type: "RUN_STARTED"; status: RunStatus["status"] }
  | { type: "CP1_FIRED" }
  | { type: "CP2_READY" }
  | { type: "ALL_REVIEWED" }
  | { type: "RUN_ERROR" }
  | { type: "RUN_RESET" };

function fsmReducer(state: FsmState, action: FsmAction): FsmState {
  switch (action.type) {
    case "SCAN_TRIGGERED":
      return "running_scan";
    case "RUN_STARTED":
      if (action.status === "scanning") return "running_scan";
      if (action.status === "qualifying") return "running_qualify";
      if (action.status === "writing") return "running_write";
      if (action.status === "awaiting_cp2") return "cp2_ready";
      if (action.status === "done") return "done";
      if (action.status === "error") return "error";
      return state;
    case "CP1_FIRED":
      return "cp1_pending";
    case "CP2_READY":
      return "cp2_ready";
    case "ALL_REVIEWED":
      return "done";
    case "RUN_ERROR":
      return "error";
    case "RUN_RESET":
      return "idle";
    default:
      return state;
  }
}

function getStepLabel(status: RunStatus["status"]): string {
  switch (status) {
    case "scanning":
      return "Step 1/3: Scanning for jobs...";
    case "qualifying":
      return "Step 2/3: Qualifying clients...";
    case "writing":
      return "Step 3/3: Writing proposals...";
    case "awaiting_cp2":
      return "Drafts ready for review";
    case "done":
      return "Pipeline complete";
    case "error":
      return "Pipeline error";
    default:
      return status;
  }
}

function isRunningState(fsm: FsmState): boolean {
  return ["running_scan", "running_qualify", "running_write"].includes(fsm);
}

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-32 bg-gray-100 rounded" />
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 rounded w-24" />
        <div className="h-6 bg-gray-200 rounded w-20" />
      </div>
      <div className="flex justify-end gap-2">
        <div className="h-8 bg-gray-200 rounded w-16" />
        <div className="h-8 bg-gray-200 rounded w-16" />
        <div className="h-8 bg-gray-300 rounded w-28" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [fsmState, dispatch] = useReducer(fsmReducer, "idle");
  const {
    run_id,
    drafts,
    reviewed_ids,
    approved_count,
    skipped_count,
    setRunId,
    setDrafts,
    reset,
  } = useReviewStore();

  // SWR polling — active only during running states
  const shouldPoll = isRunningState(fsmState) || fsmState === "idle";
  const swrKey = run_id && shouldPoll ? `/api/status/${run_id}` : null;

  const { data: runStatus, error: swrError } = useSWR<RunStatus>(
    swrKey,
    () => getRunStatus(run_id ?? "run_mock_001"),
    {
      refreshInterval: shouldPoll ? 3000 : 0,
      revalidateOnFocus: shouldPoll,
    }
  );

  // On mount: fetch current run status to initialize FSM (default to cp2_ready via mock)
  useEffect(() => {
    async function initDashboard() {
      try {
        const status = await getRunStatus("run_mock_001");
        setRunId(status.run_id);

        if (status.status === "awaiting_cp2") {
          const fetchedDrafts = await getDrafts(status.run_id);
          setDrafts(fetchedDrafts);
          dispatch({ type: "CP2_READY" });
        } else if (status.status === "error") {
          dispatch({ type: "RUN_ERROR" });
        } else if (status.status !== "done") {
          dispatch({ type: "RUN_STARTED", status: status.status });
        }
      } catch {
        // No active run — stay in idle state
      }
    }
    initDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to SWR polling updates
  useEffect(() => {
    if (!runStatus || !shouldPoll) return;

    if (runStatus.status === "awaiting_cp2" && fsmState !== "cp2_ready") {
      getDrafts(runStatus.run_id).then((fetchedDrafts) => {
        setDrafts(fetchedDrafts);
        dispatch({ type: "CP2_READY" });
      });
    } else if (runStatus.status === "error") {
      dispatch({ type: "RUN_ERROR" });
    } else if (
      runStatus.status === "scanning" ||
      runStatus.status === "qualifying" ||
      runStatus.status === "writing"
    ) {
      dispatch({ type: "RUN_STARTED", status: runStatus.status });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, shouldPoll]);

  // SWR error handling
  useEffect(() => {
    if (swrError) {
      dispatch({ type: "RUN_ERROR" });
    }
  }, [swrError]);

  // Check ALL_REVIEWED trigger
  useEffect(() => {
    if (
      fsmState === "cp2_ready" &&
      drafts.length > 0 &&
      reviewed_ids.length === drafts.length
    ) {
      dispatch({ type: "ALL_REVIEWED" });
    }
  }, [reviewed_ids.length, drafts.length, fsmState]);

  const handleScanNow = useCallback(async () => {
    try {
      dispatch({ type: "SCAN_TRIGGERED" });
      const result = await startScan();
      setRunId(result.run_id);
      toast.info("Scan started — pipeline is running");
    } catch {
      dispatch({ type: "RUN_ERROR" });
      toast.error("Failed to start scan");
    }
  }, [setRunId]);

  const handleMarkComplete = async () => {
    try {
      await fetch("/api/hitl/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint: "cp2_final",
          run_id,
          action: "complete",
          timestamp: new Date().toISOString(),
        }),
      });
      reset();
      dispatch({ type: "RUN_RESET" });
      toast.success("Pipeline marked complete");
    } catch {
      toast.error("Failed to mark pipeline complete");
    }
  };

  const handleCp1Resolved = (approvedJobIds: string[]) => {
    toast.info(
      `CP1 resolved — ${approvedJobIds.length} job${approvedJobIds.length !== 1 ? "s" : ""} approved for drafting`
    );
    dispatch({ type: "RUN_STARTED", status: "writing" });
  };

  // Progress values
  const totalDrafts = drafts.length;
  const reviewedCount = reviewed_ids.length;
  const progressPct = totalDrafts > 0 ? Math.round((reviewedCount / totalDrafts) * 100) : 0;

  // Status banner content by FSM state
  const renderStatusBanner = () => {
    if (fsmState === "idle") {
      return (
        <Alert className="border-gray-200 bg-gray-50 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            <AlertTitle className="text-gray-600 font-medium m-0">Crew: idle</AlertTitle>
          </div>
        </Alert>
      );
    }

    if (isRunningState(fsmState)) {
      const label = runStatus ? getStepLabel(runStatus.status) : "Running...";
      const pct = runStatus?.progress_pct ?? 30;
      return (
        <Alert className="border-blue-200 bg-blue-50 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />
              <AlertTitle className="text-blue-800 font-medium m-0 truncate">
                Crew: running · {label}
              </AlertTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Progress value={pct} className="w-24 h-2" />
              <span className="text-xs text-blue-600 font-medium">{pct}%</span>
            </div>
          </div>
        </Alert>
      );
    }

    if (fsmState === "cp1_pending") {
      return null; // CP1 banner is rendered by Cp1Gate component
    }

    if (fsmState === "cp2_ready") {
      return (
        <Alert className="border-green-200 bg-green-50 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
              <AlertTitle className="text-green-800 font-medium m-0">
                Crew: done · {totalDrafts} draft{totalDrafts !== 1 ? "s" : ""} ready for review
              </AlertTitle>
            </div>
            <span className="text-sm text-green-700 shrink-0">
              Progress: {reviewedCount} / {totalDrafts} reviewed
            </span>
          </div>
        </Alert>
      );
    }

    if (fsmState === "done") {
      return (
        <Alert className="border-green-200 bg-green-50 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
              <AlertTitle className="text-green-800 font-medium m-0">Crew: done</AlertTitle>
            </div>
            <span className="text-sm text-green-700 shrink-0">
              Progress: {reviewedCount} / {totalDrafts} reviewed
            </span>
          </div>
        </Alert>
      );
    }

    if (fsmState === "error") {
      return (
        <Alert className="border-red-200 bg-red-50 mb-4" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pipeline error</AlertTitle>
          <AlertDescription>
            {runStatus?.error_message ?? "An error occurred. Please retry."}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Status banner — sticky context */}
      {renderStatusBanner()}

      {/* CP1 Gate — collapsible Alert (not Dialog — MVP decision resolving spec Open Question #3) */}
      {fsmState === "cp1_pending" && (
        <Cp1Gate
          borderlineJobs={[]} // stub — real borderline jobs come from getRunStatus CP1 payload
          onResolved={handleCp1Resolved}
        />
      )}

      {/* Progress indicator — shown during cp2_ready */}
      {fsmState === "cp2_ready" && totalDrafts > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700">Review progress</span>
            <span className="text-xs text-gray-500">
              {approved_count} approved · {skipped_count} skipped
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-gray-500 mt-1">
            {reviewedCount} reviewed / {totalDrafts} total
          </p>
        </div>
      )}

      {/* Main content by FSM state */}

      {/* idle state — empty state with Scan Now */}
      {fsmState === "idle" && (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-sm w-full border border-gray-200">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-gray-700 font-medium mb-1">No active run</p>
              <p className="text-sm text-gray-500 mb-6">
                Click &quot;Scan Now&quot; to discover new jobs.
              </p>
              <Button
                onClick={handleScanNow}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Scan Now
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* running states — skeleton cards */}
      {isRunningState(fsmState) && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-500">
            Today&apos;s Drafts — preparing...
          </h2>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* cp2_ready state — draft cards */}
      {fsmState === "cp2_ready" && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Today&apos;s Drafts ({totalDrafts})
          </h2>
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}

      {/* done state — summary panel */}
      {fsmState === "done" && (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-lg w-full border border-gray-200">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle2 size={24} className="text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">Review complete</h2>
              </div>
              <p className="text-lg font-medium text-gray-700 mb-2">
                {approved_count} approved · {skipped_count} skipped
              </p>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                Approved drafts copied to clipboard, Upwork tabs opened. Submit on
                Upwork, then return to mark pipeline complete.
              </p>
              <Button
                onClick={handleMarkComplete}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Mark pipeline complete
              </Button>
              <p className="text-xs text-gray-400 mt-4">
                run_id: {run_id ?? "—"} · Started: {runStatus?.current_step ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* error state — error banner + retry */}
      {fsmState === "error" && (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-sm w-full border border-red-200">
            <CardContent className="pt-8 pb-8 text-center">
              <AlertTriangle size={24} className="text-red-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Pipeline error</p>
              <p className="text-sm text-gray-500 mb-6">
                {runStatus?.error_message ?? "An unexpected error occurred."}
              </p>
              <Button
                onClick={handleScanNow}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw size={14} />
                Retry scan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
