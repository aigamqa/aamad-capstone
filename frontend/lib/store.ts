// lib/store.ts — Zustand ReviewSessionState store
// Exact shape from spec Section 2.4

import { create } from "zustand";
import type { ReviewSessionState, Draft } from "./types";

interface ReviewSessionActions {
  setRunId: (run_id: string) => void;
  setDrafts: (drafts: Draft[]) => void;
  markReviewed: (draft_id: string, action: "approve" | "skip") => void;
  setScrollGateSatisfied: (draft_id: string) => void;
  resetScrollGate: (draft_id: string) => void;
  openEditor: (draft_id: string) => void;
  closeEditor: () => void;
  updateDraftContent: (draft_id: string, content: string) => void;
  reset: () => void;
}

const initialState: ReviewSessionState = {
  run_id: null,
  drafts: [],
  reviewed_ids: [],
  pending_ids: [],
  approved_count: 0,
  skipped_count: 0,
  scroll_gate_satisfied: {},
  is_editor_open: false,
  active_editor_draft_id: null,
};

export const useReviewStore = create<ReviewSessionState & ReviewSessionActions>()(
  (set) => ({
    ...initialState,

    setRunId: (run_id) => set({ run_id }),

    setDrafts: (drafts) =>
      set({
        drafts,
        pending_ids: drafts.map((d) => d.id),
        reviewed_ids: [],
        approved_count: 0,
        skipped_count: 0,
        scroll_gate_satisfied: {},
      }),

    markReviewed: (draft_id, action) =>
      set((state) => ({
        reviewed_ids: [...state.reviewed_ids, draft_id],
        pending_ids: state.pending_ids.filter((id) => id !== draft_id),
        approved_count:
          action === "approve" ? state.approved_count + 1 : state.approved_count,
        skipped_count:
          action === "skip" ? state.skipped_count + 1 : state.skipped_count,
        drafts: state.drafts.map((d) =>
          d.id === draft_id
            ? {
                ...d,
                status:
                  action === "approve"
                    ? "Submitted"
                    : action === "skip"
                      ? "Archived"
                      : d.status,
              }
            : d
        ),
      })),

    setScrollGateSatisfied: (draft_id) =>
      set((state) => ({
        scroll_gate_satisfied: {
          ...state.scroll_gate_satisfied,
          [draft_id]: true,
        },
      })),

    // Reset scroll gate after edit — user must re-scroll edited content before approving
    resetScrollGate: (draft_id) =>
      set((state) => ({
        scroll_gate_satisfied: {
          ...state.scroll_gate_satisfied,
          [draft_id]: false,
        },
      })),

    openEditor: (draft_id) =>
      set({ is_editor_open: true, active_editor_draft_id: draft_id }),

    closeEditor: () =>
      set({ is_editor_open: false, active_editor_draft_id: null }),

    updateDraftContent: (draft_id, content) =>
      set((state) => ({
        drafts: state.drafts.map((d) =>
          d.id === draft_id ? { ...d, content, edit_source: "manual" } : d
        ),
      })),

    reset: () => set(initialState),
  })
);
