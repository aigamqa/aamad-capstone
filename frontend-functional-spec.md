# Frontend Functional Spec — Today's Drafts Workflow
## AI Sales Team MVP Dashboard — CP2 HITL Surface

**Document Type**: Frontend Functional Specification
**Workflow**: Today's Drafts (Screen 1 — Dashboard)
**Phase**: 2 — Build (pre-implementation)
**Date**: 2026-05-18
**Persona**: @frontend.eng
**Action**: spec-only pre-build — no code generated
**PRD Reference**: project-context/1.define/prd.md
**SAD Reference**: project-context/1.define/sad.md

---

## 1. Overview

The Today's Drafts workflow is the primary Human-in-the-Loop (HITL) surface of the AI Sales Team MVP. It implements CP2 (mandatory HITL gate) and the conditional CP1 gate from the agent pipeline, giving the user a single daily review session in which every AI-generated proposal is reviewed and actioned before any external submission is possible.

This workflow is Screen 1 of the Next.js dashboard (SAD Section 3 "Key Screens"). It exists because HITL is an architectural invariant of the system, not a feature flag: no code path may submit a proposal to Upwork without explicit user approval (SAD Section 1, Decision D6). The dashboard is the sole point at which proposals cross from AI-generated draft to user-approved action.

**SAD sections implemented by this workflow:**

- SAD Section 3 — Frontend Architecture Specification (technology stack, directory structure, Screen 1 spec, assistant-ui integration)
- SAD Section 6 — Data Flow and Integration Architecture (primary data flow diagram, async generation pattern, CP1/CP2 gate descriptions, Telegram push trigger)

**Key design constraint (Decision D5):** the real user journey is: open app, see draft, read 30 seconds, Approve/Edit/Skip. The entire workflow must support this sub-30-second review path per draft. A chat-primary interface is deliberately rejected (Decision D10) in favor of card-based review.

---

## 2. Inputs

### 2.1 Data Inputs from the Backend

The workflow requires data from three backend tables before it can render. These are populated by the CrewAI pipeline before the user opens the dashboard (async pre-generation pattern — see Section 3).

| Source Table | When Available | Used By |
|---|---|---|
| `jobs` | After Step 1 (scan_jobs) | Job card header: title, URL, budget, posted_date |
| `qualified_jobs` | After Step 2 (qualify_jobs) | QualificationBadge: score, recommendation, red_flags, green_flags |
| `drafts` | After Step 3 (write_proposals) | Draft card: content, voice_confidence_score, portfolio_items_used, edit_suggestions |

### 2.2 State Inputs

| Input | Type | Source | Notes |
|---|---|---|---|
| `run_id` | `string` | `getRunStatus()` response | Identifies the active pipeline run; displayed in UI for traceability |
| `pipeline_status` | `RunStatus["status"]` | Polled via `getRunStatus()` | Drives FSM state transitions (Section 4) |
| `cp_gate_state` | `"cp1_pending" \| "cp2_ready" \| "all_reviewed"` | Derived from `getRunStatus()` + local Zustand store | Determines which gate overlay is shown |
| `review_session` | Zustand store | `lib/store.ts` | Tracks per-draft reviewed/pending/skipped within current session |

### 2.3 User-Configuration Context

| Input | Type | Loaded From | Notes |
|---|---|---|---|
| Filter settings | `FilterConfig` | `GET /api/settings` | Read-only in this workflow; modifiable in Settings screen |
| Voice examples loaded | `boolean` | `GET /api/settings` | If false, show onboarding warning banner; proposal generation is blocked upstream |
| Portfolio cases count | `number` | `GET /api/settings` | Informational; displayed in Settings screen only |

### 2.4 TypeScript Interface Shapes

```typescript
// lib/types.ts

interface Job {
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

interface QualifiedJob {
  id: string;
  job_id: string;
  score: number;               // 1.0–10.0
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

interface Draft {
  id: string;
  job_id: string;
  content: string;
  voice_confidence_score: number;    // 0.0–1.0
  portfolio_items_used: string[];
  edit_suggestions: string[] | null; // populated when confidence < 0.80
  edit_source: "ai_generated" | "assistant-ui" | "manual";
  status: "Drafted" | "Submitted" | "Archived";
  run_id: string;
  created_at: string;
  job: JobSummary;
}

interface JobSummary {
  title: string;
  url: string;
  budget_min: number | null;
  budget_max: number | null;
  client_score: number;          // from qualified_jobs.score
  recommendation: "Pursue" | "Skip" | "Review";
}

interface RunStatus {
  run_id: string;
  status: "scanning" | "qualifying" | "writing" | "awaiting_cp2" | "done" | "error";
  current_step: string;
  progress_pct: number;          // 0–100
  error_message?: string;
}

interface FeedbackResult {
  success: boolean;
  draft_id: string;
  new_status: string;
  clipboard_text?: string;       // present on approve action only
}

interface FilterConfig {
  min_star_rating: number;
  min_hire_rate: number;
  min_avg_hourly_paid: number;
  priority_categories: string[];
  exclude_categories: string[];
  posted_within_hours: number;
}

// Zustand review session state shape (lib/store.ts)
interface ReviewSessionState {
  run_id: string | null;
  drafts: Draft[];
  reviewed_ids: string[];        // draft ids the user has actioned
  pending_ids: string[];         // draft ids not yet actioned
  approved_count: number;
  skipped_count: number;
  scroll_gate_satisfied: Record<string, boolean>; // draft_id → true when scrolled to bottom
  is_editor_open: boolean;
  active_editor_draft_id: string | null;
}
```

---

## 3. Run

### 3.1 Trigger and Pre-Generation Pattern

The Today's Drafts workflow is designed around an **async pre-generation pattern** (SAD Section 6, Post-QR-v2 enhancement). The CrewAI pipeline (scan → qualify → write) executes as a background job, typically initiated automatically upon Chrome Extension ingestion. By the time the user opens the dashboard — triggered by a Telegram push notification — all three pipeline steps are already complete and the drafts table is populated with ready-to-review proposals.

This pattern resolves the latency tension between Opus 4.6 generation time and the `<15 minutes daily review` NFR: generation happens during the user's offline time, not during the review session.

Consequence for the frontend: the dashboard's initial load target is `<3 seconds` (SAD Section 7) because it is reading pre-computed data from Postgres, not triggering LLM generation. The Approve button renders immediately alongside the draft content.

The user may also manually trigger a new pipeline run via the "Scan Now" CTA, which transitions the workflow through the `running` states in real time.

### 3.2 UI State Transitions

The workflow transitions through the following states (full FSM definition in Section 6):

| FSM State | Transition Trigger | User-Visible Change |
|---|---|---|
| `idle` | App opened; no active run, or drafts already ready | Status banner: "Ready — N drafts awaiting review" or "No active run" |
| `running_scan` | `SCAN_TRIGGERED` | Status banner: "Scanning for jobs..." with progress indicator |
| `running_qualify` | `RUN_STARTED` (Scout complete) | Status banner: "Qualifying clients..." |
| `cp1_pending` | `CP1_FIRED` (borderline scores 0.4–0.6 detected) | CP1 overlay: borderline jobs surfaced for user confirmation before drafting continues |
| `running_write` | CP1 resolved (or skipped if no borderline) | Status banner: "Writing proposals..." |
| `cp2_ready` | `CP2_READY` (all drafts generated) | Full draft cards rendered; review session begins |
| `done` | `ALL_REVIEWED` | Summary panel: N approved, M skipped + "Mark pipeline complete" CTA |
| `error` | `RUN_ERROR` | Error banner with message + retry option |

### 3.3 What the User Sees at Each State

**idle:** Dashboard shows a "No drafts ready" empty state with a "Scan Now" button. If a previous run exists with unreviewed drafts, it shows those drafts immediately (the user may have been notified by Telegram and is returning to an in-progress session).

**running_scan / running_qualify / running_write:** A run status banner (shadcn/ui Alert) at the top of the screen shows the current step label and a progress bar. Draft cards are not shown during active generation — the page shows a loading skeleton layout. The user can leave and return; SWR polling resumes on re-focus.

**cp1_pending (conditional):** A modal or prominent Alert surfaces the borderline-scored jobs (qualification score 0.4–0.6). For each borderline job the user sees: job title, budget, client score, red_flags, green_flags, recommendation=Review, reasoning paragraph. Per-job actions: "Include in drafts" or "Skip this job." After the user resolves all borderline items, the flow resumes writing proposals for approved jobs. CP1 is conditional: if no jobs score 0.4–0.6, this state is bypassed entirely.

**cp2_ready:** The main review surface. Each draft is rendered as a DraftCard component (see Section 8). The user reviews drafts one by one or scrolls through all. Progress indicator (shadcn/ui Progress) shows "N reviewed / M total."

**done:** A summary panel shows the final counts (N approved, M skipped). A "Mark pipeline complete" button is visible. Future RLHF note: these approve/edit/skip counts are the telemetry seed for the V1 few-shot feedback loop (see Section 5).

**error:** A dismissible error banner shows `error_message` from `RunStatus`. The "Scan Now" button is re-enabled for retry.

### 3.4 CP1 Conditional HITL Behavior

CP1 fires when the Client Qualifier agent detects any job with a qualification score in the 0.4–0.6 range. From the frontend's perspective:

- `getRunStatus()` returns `status="qualifying"` with a `cp1_fired: boolean` field (or the status changes to a dedicated CP1 state — see Open Questions, item 1)
- The CP1 gate overlay renders on top of the current view
- The overlay lists all borderline jobs with their full qualification report visible
- User must action every borderline job (Include / Skip) before the overlay dismisses
- On dismiss: frontend posts `/api/hitl/checkpoint` with `{ checkpoint: "cp1", approved_job_ids: [...] }` to unblock the Flow `wait()` state
- This is a frontend blocking gate: no navigation away is permitted while the CP1 overlay is open (soft enforcement via beforeunload warning)

### 3.5 CP2 Mandatory HITL Gate Behavior

CP2 is the mandatory review gate for all draft proposals. Every draft must receive one of three actions: Approve, Edit, or Skip. There is no "proceed without review" path.

**Per-draft flow:**
1. User lands on a draft card
2. User reads the proposal text (scroll gate: Approve button is disabled until the draft scroll container has been scrolled to the bottom)
3. User clicks Approve, Edit, or Skip
4. Progress indicator increments: "N+1 reviewed / M total"
5. Next unreviewed draft card becomes focused (or a soft scroll-to-next behavior)
6. When all M drafts are actioned, `ALL_REVIEWED` event fires and the workflow transitions to `done`

**Scroll-to-bottom gate (Approve button):**
- The draft content container has a fixed height with overflow-y: scroll
- An IntersectionObserver watches a sentinel element at the bottom of the draft text
- When the sentinel is visible, `scroll_gate_satisfied[draft_id]` is set to `true` in Zustand
- The Approve button's `disabled` prop reads from this store value
- This ensures the user has seen the full proposal before approving (supports the `>60% proposal acceptance rate without major structural edit` acceptance criterion from SAD Section 9)

### 3.6 Progress Indicator

A shadcn/ui Progress component is shown at the top of the draft list area with a label: "N reviewed / M total."

- `N` = `reviewed_ids.length` from Zustand `ReviewSessionState`
- `M` = total draft count for the current `run_id` from `getDrafts()`
- The progress value passed to the component is `Math.round((N / M) * 100)`
- A secondary text label shows the breakdown: "N approved · S skipped"

---

## 4. Results

### 4.1 Approve

1. User clicks the Approve button (enabled only after scroll gate is satisfied)
2. Frontend calls `submitFeedback(draft_id, "approve")`
3. On success: `FeedbackResult.clipboard_text` is written to the clipboard via `navigator.clipboard.writeText()`
4. The Upwork job URL (`draft.job.url`) is opened in a new tab via `window.open()`
5. Draft card status updates to "Submitted" (optimistic UI update; confirmed by `FeedbackResult.new_status`)
6. A toast notification confirms: "Copied to clipboard — Upwork tab opened"
7. Frontend posts `/api/hitl/checkpoint` with `{ checkpoint: "cp2", draft_id, action: "approve" }` to record the HITL event and unblock the Flow
8. `draft_id` is added to `reviewed_ids` in Zustand; `approved_count` increments

### 4.2 Edit

1. User clicks the Edit button
2. `DraftEditor.tsx` opens inline within the draft card (not full-screen; not a modal)
3. `is_editor_open` and `active_editor_draft_id` are set in Zustand
4. The DraftEditor is powered by assistant-ui (scoped boundary — see Section 8)
5. The assistant-ui context receives: current draft text, job description, client signals, voice_confidence_score, and a system prompt instructing it to act as a proposal editing assistant
6. Every edit the user accepts through assistant-ui triggers `submitFeedback(draft_id, "edit", editedContent)`
7. Each saved edit creates a new draft version with `edit_source="assistant-ui"` written to the `drafts` table
8. After editing, the DraftEditor closes and the draft card re-renders with the updated content and a recalculated scroll gate (user must scroll through the new content before Approve is enabled)
9. The edited draft still requires explicit Approve to complete CP2. The assistant-ui editing surface does NOT bypass CP2 (Decision D6 — HITL as architectural invariant)
10. `is_editor_open` is reset in Zustand on close

### 4.3 Skip

1. User clicks the Skip button
2. Frontend calls `submitFeedback(draft_id, "skip")`
3. Draft card status updates to "Archived" (optimistic UI update)
4. Frontend posts `/api/hitl/checkpoint` with `{ checkpoint: "cp2", draft_id, action: "skip" }` to record the HITL event
5. `draft_id` is added to `reviewed_ids` in Zustand; `skipped_count` increments
6. No clipboard write, no tab open

### 4.4 voice_confidence_score Display Rules

The `voice_confidence_score` (0.0–1.0) is displayed on every draft card via a color-coded Badge component.

| Score Range | Badge Color | Badge Label | Additional UI |
|---|---|---|---|
| ≥ 0.80 | Green | "Voice match: strong" | None |
| 0.60 – 0.79 | Amber | "Voice match: moderate" | Amber warning text below score |
| < 0.60 | Red | "Voice match: weak" | Red Alert component listing all `edit_suggestions[]` |

The `edit_suggestions[]` array (from the `Draft` interface) is shown as a shadcn/ui Alert with variant="destructive" when score < 0.60. Each suggestion is a list item within the alert. This follows the Proposal Writer agent's guardrail: drafts with score < 0.60 are flagged with edit_suggestions required (SAD Section 2).

Threshold values (0.60 and 0.80) are resolved from SAD Section 2 guardrail spec. These thresholds are checked at render time in the DraftCard component and must match the backend guardrail values. See Section 9 Sync Checklist item 5.

### 4.5 Post-All-Reviewed State

When `reviewed_ids.length === drafts.length` (all drafts have been actioned), the `ALL_REVIEWED` event fires and the workflow transitions to `done`.

The UI shows a summary panel replacing the draft list:
- Heading: "Review complete"
- Counts: "N approved · M skipped"
- `run_id` displayed for traceability (links to future Prompt Trace view)
- "Mark pipeline complete" CTA button: triggers `POST /api/hitl/checkpoint { checkpoint: "cp2_final", run_id, action: "complete" }` to unblock the Flow's `cp2_final_reviewed` wait state

---

## 5. History

### 5.1 Drafts Table Writes

After each user action (Approve / Edit / Skip), the following fields are written to the `drafts` table by the backend:

| Field | Written on Approve | Written on Edit | Written on Skip |
|---|---|---|---|
| `status` | "Submitted" | — (unchanged until explicit Approve) | "Archived" |
| `edit_source` | — | "assistant-ui" (for each saved edit version) | — |
| `reviewed_at` | Set to current timestamp | — | Set to current timestamp |
| `content` | — | Updated to edited version (new row or version column — backend concern) | — |

Note: `reviewed_at` is not currently in the SAD's `drafts` table schema. It is a derived field this spec assumes will be added. See Open Questions, item 2.

### 5.2 HITL Telemetry Writes

Every CP gate action (CP1 resolution, CP2 per-draft action, CP2 final complete) is written to the `pipeline_state` table via `POST /api/hitl/checkpoint`. The payload structure:

```
POST /api/hitl/checkpoint
{
  checkpoint: "cp1" | "cp2" | "cp2_final",
  run_id: string,
  draft_id?: string,          // present for per-draft CP2 events
  action: "approve" | "skip" | "complete" | "include" | "exclude",
  timestamp: string           // ISO 8601
}
```

The `pipeline_state` table's `notes` field stores the serialized checkpoint payload for audit trail purposes.

### 5.3 Prompt Trace Display

Prompt Trace entries are a backend concern (all LLM calls are logged to `prompt_traces` table and JSONL files in `project-context/2.build/logs/`). The frontend's only obligation is to:
- Display the `run_id` string on the dashboard header and in the post-review summary panel
- Use `run_id` as a traceability anchor for any future Prompt Trace viewer screen (not in MVP scope)

The `run_id` is available from `getRunStatus()` and stored in `ReviewSessionState.run_id`.

### 5.4 Deferred Data Contract — RLHF (V1)

**[DEFERRED: V1]** The approve/edit/skip events recorded per draft run (Section 5.2) form the seed dataset for a Reinforcement Learning from Human Feedback loop. In V1, the Proposal Writer agent will receive approved drafts as few-shot examples in its generation prompt, and edited drafts will supply the before/after pairs for fine-tuning signals.

The frontend's HITL telemetry payload (Section 5.2) is designed to be RLHF-ready: it captures `action`, `draft_id`, `run_id`, and timestamp with sufficient granularity to reconstruct the review session. No additional frontend changes are required for V1 RLHF integration beyond ensuring the telemetry writes happen reliably on every CP2 action.

This is documented here as a deferred data contract so the frontend build does not omit any fields that the V1 RLHF pipeline will depend on.

---

## 6. FSM Definition

### 6.1 State Table

| State | Entry Condition | UI Appearance | Valid Transitions | Exit Condition |
|---|---|---|---|---|
| `idle` | App opened; no active run or no unreviewed drafts from prior run | Empty state: "No active run" or draft list from prior run; "Scan Now" button visible; run status banner hidden | `SCAN_TRIGGERED` → `running_scan` | User clicks Scan Now; or background run completes and CP2_READY fires |
| `running_scan` | `SCAN_TRIGGERED` event; `POST /api/crew/run` called | Status banner: "Scanning for jobs..." + spinner; progress bar at ~10%; draft area shows loading skeleton | `RUN_STARTED` → `running_qualify`; `RUN_ERROR` → `error` | Scout step completes; `getRunStatus()` returns `status="qualifying"` |
| `running_qualify` | Scout complete; `status="qualifying"` from API | Status banner: "Qualifying clients..." + progress bar ~40% | `CP1_FIRED` → `cp1_pending`; (no borderline scores) → `running_write`; `RUN_ERROR` → `error` | Qualifier step complete; CP1 either skipped or resolved |
| `cp1_pending` | `CP1_FIRED`; borderline jobs (score 0.4–0.6) detected | Blocking overlay with borderline job cards; "Include" / "Skip" per job; cannot navigate away | `DRAFT_APPROVED` (in CP1 context = include) / `DRAFT_SKIPPED` (skip) per borderline job → when all resolved → `running_write` | All borderline jobs actioned; `POST /api/hitl/checkpoint {checkpoint: "cp1"}` sent |
| `running_write` | CP1 resolved or bypassed; `status="writing"` from API | Status banner: "Writing proposals..." + progress bar ~75% | `CP2_READY` → `cp2_ready`; `RUN_ERROR` → `error` | All drafts generated; `status="awaiting_cp2"` |
| `cp2_ready` | `CP2_READY`; `getDrafts()` returns populated array | Full draft cards rendered; review session active; progress indicator N/M; CP2 actions available | `DRAFT_APPROVED` / `DRAFT_EDITED` / `DRAFT_SKIPPED` per draft; `ALL_REVIEWED` → `done`; `RUN_ERROR` → `error` | All drafts reviewed; `reviewed_ids.length === drafts.length` |
| `done` | `ALL_REVIEWED`; all drafts actioned | Summary panel: N approved · M skipped; run_id displayed; "Mark pipeline complete" CTA | `RUN_RESET` → `idle` | User clicks "Mark pipeline complete"; `POST /api/hitl/checkpoint {checkpoint: "cp2_final"}` sent; then → `idle` |
| `error` | `RUN_ERROR`; `status="error"` from API | Error banner with `error_message`; Scan Now re-enabled; prior draft content preserved if available | `SCAN_TRIGGERED` → `running_scan`; `RUN_RESET` → `idle` | User retries or resets |

### 6.2 Event Definitions

| Event | Fired By | Payload |
|---|---|---|
| `SCAN_TRIGGERED` | User clicks "Scan Now" | `{ initiated_at: string }` |
| `RUN_STARTED` | `getRunStatus()` returns status != "idle" | `{ run_id: string, status: RunStatus["status"] }` |
| `CP1_FIRED` | `getRunStatus()` signals borderline jobs | `{ borderline_job_ids: string[] }` |
| `CP2_READY` | `getRunStatus()` returns `status="awaiting_cp2"` | `{ run_id: string, draft_count: number }` |
| `DRAFT_APPROVED` | User clicks Approve; `submitFeedback()` succeeds | `{ draft_id: string }` |
| `DRAFT_EDITED` | User saves edit in DraftEditor | `{ draft_id: string, edited_content: string }` |
| `DRAFT_SKIPPED` | User clicks Skip; `submitFeedback()` succeeds | `{ draft_id: string }` |
| `ALL_REVIEWED` | `reviewed_ids.length === drafts.length` (computed in store) | `{ approved_count: number, skipped_count: number }` |
| `RUN_ERROR` | `getRunStatus()` returns `status="error"` | `{ error_message: string }` |
| `RUN_RESET` | User clicks "Start fresh" / pipeline complete confirmed | `{}` |

### 6.3 ASCII State Diagram

```
                    SCAN_TRIGGERED
         ┌──────────────────────────────────────┐
         │                                      │
         ▼                                      │
      [idle] ────────────────────────────► [running_scan]
                                                │
                                         RUN_STARTED
                                                │
                                                ▼
                                        [running_qualify]
                                           /        \
                                  CP1_FIRED          (no borderline)
                                     /                    \
                                    ▼                      ▼
                              [cp1_pending]         [running_write]
                                    │                      ▲
                             (all resolved)                │
                                    └──────────────────────┘
                                                │
                                          CP2_READY
                                                │
                                                ▼
                                          [cp2_ready]
                                          /    |    \
                                DRAFT_APPROVED |  DRAFT_SKIPPED
                                    (loop per draft)
                                               │
                                         ALL_REVIEWED
                                               │
                                               ▼
                                            [done]
                                               │
                                          RUN_RESET
                                               │
                                               ▼
                                            [idle]

         Any state ──── RUN_ERROR ────► [error]
         [error]  ──── SCAN_TRIGGERED ─► [running_scan]
         [error]  ──── RUN_RESET ──────► [idle]
```

---

## 7. TypeScript Service Contracts (Stub)

These are stub service function signatures for use during frontend development before the backend is integrated. Function bodies are not specified here — the body will be a `// stub` placeholder returning mock payloads. Interface definitions are authoritative for the frontend build.

### 7.1 Interface Definitions

```typescript
// lib/types.ts — authoritative interface definitions

interface RunStatus {
  run_id: string;
  status: "scanning" | "qualifying" | "writing" | "awaiting_cp2" | "done" | "error";
  current_step: string;
  progress_pct: number;       // 0–100
  error_message?: string;
}

interface Job {
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

interface JobSummary {
  title: string;
  url: string;
  budget_min: number | null;
  budget_max: number | null;
  client_score: number;
  recommendation: "Pursue" | "Skip" | "Review";
}

interface Draft {
  id: string;
  job_id: string;
  content: string;
  voice_confidence_score: number;
  portfolio_items_used: string[];
  edit_suggestions: string[] | null;
  edit_source: "ai_generated" | "assistant-ui" | "manual";
  status: "Drafted" | "Submitted" | "Archived";
  run_id: string;
  created_at: string;
  job: JobSummary;
}

interface FeedbackResult {
  success: boolean;
  draft_id: string;
  new_status: string;
  clipboard_text?: string;    // present on approve only
}
```

### 7.2 Stub Service Function Signatures

```typescript
// lib/api.ts — stub service contracts (no implementation)

// Triggers POST /api/crew/run
// Mock payload: { run_id: "run_mock_001", started_at: "2026-05-18T09:00:00Z" }
async function startScan(): Promise<{ run_id: string; started_at: string }> // stub

// Polls GET /api/crew/status/{run_id}
// Mock payload: { run_id: "run_mock_001", status: "awaiting_cp2", current_step: "write_proposals", progress_pct: 100 }
async function getRunStatus(runId: string): Promise<RunStatus> // stub

// Calls GET /api/drafts
// Mock payload: array of 2 Draft objects (see below)
async function getDrafts(runId: string): Promise<Draft[]> // stub

// Calls POST /api/drafts/{draft_id}/{action}
// Mock payload for approve: { success: true, draft_id: "draft_001", new_status: "Submitted", clipboard_text: "[proposal text here]" }
async function submitFeedback(
  draftId: string,
  action: "approve" | "edit" | "skip",
  editedContent?: string
): Promise<FeedbackResult> // stub
```

### 7.3 Mock Payloads

**`startScan()` mock:**
```
{ run_id: "run_mock_001", started_at: "2026-05-18T09:00:00Z" }
```

**`getRunStatus("run_mock_001")` mock:**
```
{
  run_id: "run_mock_001",
  status: "awaiting_cp2",
  current_step: "write_proposals",
  progress_pct: 100
}
```

**`getDrafts("run_mock_001")` mock:**
```
[
  {
    id: "draft_001",
    job_id: "job_001",
    content: "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow and immediately thought of the work I did for Warehance — a warehouse management platform where I redesigned the entire user onboarding experience, reducing time-to-first-value from 3 days to under 4 hours. The key was mapping the user's mental model before designing a single screen...",
    voice_confidence_score: 0.84,
    portfolio_items_used: ["warehance", "ernesto_vargas"],
    edit_suggestions: null,
    edit_source: "ai_generated",
    status: "Drafted",
    run_id: "run_mock_001",
    created_at: "2026-05-18T08:45:00Z",
    job: {
      title: "Senior UX Designer for B2B SaaS Onboarding Redesign",
      url: "https://www.upwork.com/jobs/~01mockjob001",
      budget_min: 3000,
      budget_max: 6000,
      client_score: 8.2,
      recommendation: "Pursue"
    }
  },
  {
    id: "draft_002",
    job_id: "job_002",
    content: "Hello, your project to improve the Shopify checkout conversion rate caught my attention. I recently completed a similar engagement with TechStyle — a Shopify fashion brand where cart abandonment was at 74%. After conducting user session analysis and redesigning the checkout flow...",
    voice_confidence_score: 0.55,
    portfolio_items_used: ["techstyle", "lari_digital"],
    edit_suggestions: [
      "Opening lacks a specific data hook — add a metric from TechStyle conversion improvement",
      "Tone is more formal than your typical voice; reduce passive voice in paragraph 2",
      "Missing a direct question to the client to invite response"
    ],
    edit_source: "ai_generated",
    status: "Drafted",
    run_id: "run_mock_001",
    created_at: "2026-05-18T08:47:00Z",
    job: {
      title: "Shopify Checkout UX Optimization",
      url: "https://www.upwork.com/jobs/~01mockjob002",
      budget_min: 1500,
      budget_max: 2500,
      client_score: 6.4,
      recommendation: "Review"
    }
  }
]
```

**`submitFeedback("draft_001", "approve")` mock:**
```
{
  success: true,
  draft_id: "draft_001",
  new_status: "Submitted",
  clipboard_text: "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow..."
}
```

---

## 8. UI Components Map

**Governing rule (Decision D10 — hybrid shadcn/assistant-ui):** shadcn/ui is used for all dashboard chrome, cards, badges, buttons, progress indicators, and layout. assistant-ui is scoped exclusively to `DraftEditor.tsx` — the inline draft editing surface opened when the user clicks Edit on a proposal draft.

Rationale for boundary: the primary UX pattern of this workflow is structured card review with discrete binary decisions (Approve / Edit / Skip). This is a dashboard pattern, not a conversational pattern. Applying assistant-ui to the whole dashboard would impose conversational overhead on a task that Decision D5 defines as a sub-30-second review path per draft. assistant-ui is genuinely useful only where the interaction is conversational: asking the AI to "make the opening punchier" or "reduce word count by 50" — which is what DraftEditor.tsx does.

| Component | Library | shadcn Component | File Location | Notes |
|---|---|---|---|---|
| Draft card container | shadcn/ui | `Card`, `CardHeader`, `CardContent`, `CardFooter` | `components/draft-card/DraftCard.tsx` | One card per draft; scroll container for scroll gate detection |
| Voice confidence badge | shadcn/ui | `Badge` | `components/draft-card/DraftCard.tsx` | Color-coded: green ≥0.80, amber 0.60–0.79, red <0.60 |
| Edit suggestions list | shadcn/ui | `Alert` (variant="destructive") | `components/draft-card/DraftCard.tsx` | Shown only when `voice_confidence_score < 0.60`; lists `edit_suggestions[]` |
| Approve button | shadcn/ui | `Button` (variant="default") | `components/draft-card/DraftCard.tsx` | Disabled until `scroll_gate_satisfied[draft_id]` is true in Zustand |
| Edit button | shadcn/ui | `Button` (variant="outline") | `components/draft-card/DraftCard.tsx` | Opens DraftEditor.tsx inline |
| Skip button | shadcn/ui | `Button` (variant="ghost") | `components/draft-card/DraftCard.tsx` | Archives draft; no scroll gate requirement |
| Inline draft editor | assistant-ui | `Thread` (inline mode) | `components/draft-card/DraftEditor.tsx` | assistant-ui scoped to this file only; receives draft context as system prompt |
| Progress indicator | shadcn/ui | `Progress` | `app/dashboard/page.tsx` | "N reviewed / M total"; value = (N/M)*100 |
| Run status banner | shadcn/ui | `Alert` | `app/dashboard/page.tsx` | Shows current FSM state label; hidden in cp2_ready state |
| Qualification badge | shadcn/ui | `Badge` + `Tooltip` | `components/job-card/QualificationBadge.tsx` | Shows client score + recommendation; Tooltip opens on hover with red_flags/green_flags |
| Job card header | shadcn/ui | `Card`, `CardHeader` | `components/job-card/JobCard.tsx` | Title, budget range, client score, recommendation |
| CP1 gate overlay | shadcn/ui | `Dialog` | `components/cp1-gate/Cp1Gate.tsx` | Blocking modal; borderline job list with Include/Skip per job |
| Post-review summary panel | shadcn/ui | `Card` | `app/dashboard/page.tsx` | Shown in `done` state; N approved · M skipped + run_id + CTA |
| "Mark pipeline complete" CTA | shadcn/ui | `Button` (variant="default") | `app/dashboard/page.tsx` | Shown in `done` state only |
| "Scan Now" button | shadcn/ui | `Button` | `app/dashboard/page.tsx` | Visible in `idle` and `error` states |
| Portfolio items list | shadcn/ui | `Badge` (multiple) | `components/draft-card/DraftCard.tsx` | One badge per item in `portfolio_items_used[]`; neutral color |
| Toast notification | shadcn/ui | `Toast` / `Sonner` | Global via layout provider | Confirm clipboard write on Approve |
| Page layout | shadcn/ui | `Separator`, layout primitives | `app/layout.tsx` | Root layout; sidebar nav; Telegram status indicator |
| Deferred: Active Chats tab | — | — | `app/chats/page.tsx` | **[DEFERRED: V1]** CP3 HITL surface; Chat Engagement agent not in MVP |
| Deferred: Mobile-responsive layout | — | — | All screens | **[DEFERRED: V1]** Desktop-only is acceptable for MVP (SAD MVP Scope Declaration) |

**assistant-ui boundary note:** assistant-ui's `Thread` component is used in inline mode inside `DraftEditor.tsx`. It must not be imported in any other component. The rationale (Decision D10): the rest of the dashboard is card-based review with discrete actions, not a conversational flow. Using assistant-ui outside `DraftEditor.tsx` would import its full chat UI paradigm — message bubbles, input bar, streaming responses — into a context where the user is performing binary approve/skip decisions, not holding a conversation. The cognitive mismatch would increase review time and contradict the sub-30-second-per-draft NFR from Decision D5.

See SAD Open Question #6 regarding assistant-ui version compatibility for inline (non-full-screen) embed mode. The version choice and embed approach for `DraftEditor.tsx` must be confirmed before that component is built.

---

## 9. Spec Sync Checklist

Items that must stay in sync between this spec and the SAD as implementation proceeds:

- [x] SAD Section 3 tech stack applied: Next.js App Router 14+, shadcn/ui, assistant-ui (scoped), Tailwind CSS, TypeScript 5+, Zustand, SWR
- [ ] API route paths match SAD Section 4 FastAPI route table (verify before integration epic begins)
- [ ] TypeScript `Draft` interface fields match `drafts` table schema in SAD Section 4 — note: `reviewed_at` field assumed by this spec is not yet in the SAD schema; must be added or reconciled
- [ ] FSM states cover all HITL checkpoints (CP1, CP2, CP2-final) from SAD Section 6 data flow — CP1 state signal mechanism from `getRunStatus()` is unresolved (see Open Questions, item 1)
- [ ] `voice_confidence_score` thresholds (0.60, 0.80) match SAD Section 2 guardrail spec — currently confirmed; verify no change during backend build
- [ ] Approve button clipboard behavior confirmed with backend: `POST /api/drafts/{id}/approve` must return `clipboard_text` in `FeedbackResult` — backend must implement this explicitly
- [ ] assistant-ui version compatibility resolved (SAD Open Question #6) before `DraftEditor.tsx` implementation begins
- [ ] Deferred items marked [DEFERRED: V1]: Active Chats (CP3), Mobile-responsive layout, RLHF data replay
- [ ] `POST /api/hitl/checkpoint` payload shape (Section 5.2) confirmed with backend before integration epic — frontend and backend must agree on `checkpoint` enum values and required fields
- [ ] Scroll-to-bottom gate implementation approach (IntersectionObserver sentinel) reviewed for compatibility with Next.js App Router Server Components boundary — gate logic must run client-side only (use `"use client"` directive in DraftCard)

---

## Sources

1. `project-context/1.define/sad.md` — System Architecture Document, @system.arch, 2026-05-15 — primary source for all architectural decisions applied in this spec
   - Section 1: MVP Design Principles (HITL invariant, async pattern, Decision D5, D6, D10)
   - Section 2: Multi-Agent System Specification (Agent definitions, CP1/CP2 gates, guardrail thresholds)
   - Section 3: Frontend Architecture Specification (tech stack, Screen 1 spec, assistant-ui scoping, directory structure)
   - Section 4: Backend Architecture Specification (API routes, database schema)
   - Section 6: Data Flow and Integration Architecture (primary data flow, CP gate sequence, async generation pattern)
   - Section 7: Performance and Scalability (dashboard load target, HITL response target)
   - Section 9: Testing and QA (acceptance criteria for proposal quality)
2. `project-context/1.define/prd.md` — Product Requirements Document, @product-mgr, 2026-05-04
   - Section 4: F03 (Proposal Drafting), F04 (Human Review Interface) — acceptance criteria
   - Section 6: UX design requirements, HITL checkpoints, transparency features

---

## Assumptions

1. The `POST /api/crew/run` endpoint returns a `run_id` synchronously and the pipeline executes asynchronously in the background. The frontend does not wait synchronously for any pipeline step to complete; it polls `GET /api/crew/status/{run_id}` via SWR.
2. The async pre-generation pattern (SAD Section 6) means that on first dashboard load after a Telegram notification, `getRunStatus()` will return `status="awaiting_cp2"` immediately and `getDrafts()` will return a populated array. The frontend renders the `cp2_ready` state without waiting for generation.
3. The `getRunStatus()` response includes a signal that CP1 has fired (borderline jobs exist). This spec assumes a dedicated status value or a flag field in `RunStatus` carries this signal. The exact mechanism is unresolved (see Open Questions, item 1).
4. `navigator.clipboard.writeText()` is available in the deployment context (modern browser, HTTPS). If not available, the Approve action falls back to displaying the clipboard text in a modal with a manual "Copy" button.
5. The `reviewed_at` field (Section 5.1) is assumed to be added to the `drafts` table by the backend build epic. This spec treats it as a required field for HITL audit trail completeness.
6. The Zustand store (`lib/store.ts`) is the authoritative source for review session state within a single browser session. On page reload, the store is re-initialized from `getDrafts()` response, which reflects the persisted `status` field of each draft.
7. The SWR polling interval for `getRunStatus()` during active pipeline run states is 3–5 seconds. In `cp2_ready` and `done` states, polling stops (no background state changes expected).
8. The assistant-ui `Thread` component can be embedded in inline (non-full-screen) mode within a shadcn/ui Card component. This is the basis of `DraftEditor.tsx`. If this is not possible with the installed assistant-ui version, a plain textarea fallback is used until SAD Open Question #6 is resolved.

---

## Open Questions

1. **CP1 state signal from API**: How does `getRunStatus()` signal that CP1 has fired? Does the `RunStatus.status` enum need a `"cp1_pending"` value, or is it a separate field (e.g., `cp1_borderline_job_ids: string[]`)? This must be resolved before the `running_qualify` → `cp1_pending` FSM transition can be implemented. References SAD Open Question #4 (CP1 threshold configuration).

2. **`reviewed_at` field in drafts table**: The SAD Section 4 `drafts` table schema does not include a `reviewed_at` timestamp. This spec assumes it will be added to support HITL audit trail (Section 5.1). Backend build epic must confirm whether this field is added, or whether the `pipeline_state` table's `updated_at` field serves the same purpose.

3. **CP1 gate UX blocking behavior**: Should the CP1 gate be a full-screen blocking `Dialog` (user cannot dismiss without actioning all borderline jobs) or a collapsible Alert section at the top of the page? A Dialog provides stronger HITL enforcement but is more disruptive. A section-level Alert is less intrusive but can be scrolled past. Decision required before `Cp1Gate.tsx` is built.

4. **Scroll gate on edited drafts**: After a user edits a draft via DraftEditor.tsx and the card re-renders with updated content, the `scroll_gate_satisfied` value for that `draft_id` should be reset to `false` (the user should read the edited version before approving). This is the intended behavior per Section 3.5. Confirm this is not too friction-heavy for users who made minor edits (e.g., a single word change). If it is, consider a lighter alternative: reset only if `editedContent.length` differs significantly from original.

5. **`POST /api/hitl/checkpoint` contract with backend**: The payload shape in Section 5.2 is specified by this spec. The backend build epic must implement the `/api/hitl/checkpoint` endpoint to accept this exact shape and unblock the CrewAI Flow `wait()` state. Until this endpoint is implemented, the frontend can call it as a stub (no-op response) without breaking the CP2 review flow, since the draft status updates are handled by the separate `submitFeedback()` calls.

6. **assistant-ui inline embed mode** (references SAD Open Question #6): The version of assistant-ui that supports embedding `Thread` in inline mode within a card component (not full-screen, not a modal overlay) must be confirmed before `DraftEditor.tsx` is built. If inline mode is not supported, the fallback is a plain controlled `Textarea` for draft editing, with a separate "Ask AI to rewrite" button that opens a minimal prompt modal. This fallback does not use assistant-ui at all and still satisfies HITL requirements.

---

## Audit

| Field | Value |
|---|---|
| Timestamp | 2026-05-18 |
| Persona ID | @frontend.eng |
| Action | spec-only pre-build — no code generated |
| Scope | Today's Drafts Workflow (Screen 1, CP2 HITL surface) |
| SAD Reference | project-context/1.define/sad.md (Sections 1, 2, 3, 4, 6, 7, 9) |
| PRD Reference | project-context/1.define/prd.md (Sections 4, 6) |
| Decisions Applied | D5 (sub-30s review path), D6 (HITL invariant, no auto-approve), D10 (hybrid shadcn/assistant-ui boundary), D3 (async pre-generation pattern) |
| Deferrals Documented | Active Chats / CP3 ([DEFERRED: V1]), Mobile-responsive layout ([DEFERRED: V1]), RLHF data replay ([DEFERRED: V1]) |
| Assumptions Recorded | 8 |
| Open Questions | 6 (items 1, 3 are blockers for specific component implementation; items 2, 5 require backend coordination) |
| Prompt Trace | Omitted — this is an IDE-time specification document, not a production LLM output artifact; no external actions taken |
| Output Artifact | /Users/aigamshamali/Projects/aamad-capstone/frontend-functional-spec.md |
| No Code Generated | Confirmed — no implementation files, no scaffold, no directories created |
