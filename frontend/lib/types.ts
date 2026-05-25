// lib/types.ts — authoritative interface definitions
// Exact shapes from frontend-functional-spec.md Section 2.4 / 7.1
// DO NOT alter field names, types, or optionality

export interface Job {
  id: string;
  title: string;
  url: string;
  budget_min: number | null;
  budget_max: number | null;
  posted_date: string;
  snippet: string;
  relevance_rank: number;
  status: string;
  run_id: string;
  created_at: string;
}

export interface QualifiedJob {
  id: string;
  job_id: string;
  score: number; // 1.0–10.0
  payment_verified: boolean;
  total_spend: number;
  avg_rate: number;
  hire_rate: number;
  red_flags: string[];
  green_flags: string[];
  recommendation: "Pursue" | "Skip" | "Review";
  reasoning: string;
  created_at: string;
}

export interface Draft {
  id: string;
  job_id: string;
  content: string;
  voice_confidence_score: number; // 0.0–1.0
  portfolio_items_used: string[];
  edit_suggestions: string[] | null; // populated when confidence < 0.80
  edit_source: "ai_generated" | "assistant-ui" | "manual";
  status: "Drafted" | "Submitted" | "Archived";
  run_id: string;
  created_at: string;
  job: JobSummary;
}

export interface JobSummary {
  title: string;
  url: string;
  budget_min: number | null;
  budget_max: number | null;
  client_score: number; // from qualified_jobs.score
  recommendation: "Pursue" | "Skip" | "Review";
}

export interface RunStatus {
  run_id: string;
  status: "scanning" | "qualifying" | "writing" | "awaiting_cp2" | "done" | "error";
  current_step: string;
  progress_pct: number; // 0–100
  error_message?: string;
}

export interface FeedbackResult {
  success: boolean;
  draft_id: string;
  new_status: string;
  clipboard_text?: string; // present on approve action only
}

export interface FilterConfig {
  min_star_rating: number;
  min_hire_rate: number;
  min_avg_hourly_paid: number;
  priority_categories: string[];
  exclude_categories: string[];
  posted_within_hours: number;
}

// Zustand review session state shape (lib/store.ts)
export interface ReviewSessionState {
  run_id: string | null;
  drafts: Draft[];
  reviewed_ids: string[]; // draft ids the user has actioned
  pending_ids: string[]; // draft ids not yet actioned
  approved_count: number;
  skipped_count: number;
  scroll_gate_satisfied: Record<string, boolean>; // draft_id → true when scrolled to bottom
  is_editor_open: boolean;
  active_editor_draft_id: string | null;
}
