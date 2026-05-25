// lib/api.ts — stub service functions with exact mock payloads from spec Section 7.3
// stub — real backend wiring in Phase 2 Integration epic

import type { RunStatus, Draft, FeedbackResult } from "./types";

// stub — returns mock data; real backend wiring in Phase 2 Integration epic
export async function startScan(): Promise<{ run_id: string; started_at: string }> {
  // Mock payload from spec Section 7.3
  await new Promise((resolve) => setTimeout(resolve, 300)); // simulate network
  return {
    run_id: "run_mock_001",
    started_at: "2026-05-18T09:00:00Z",
  };
}

// stub — returns mock data; real backend wiring in Phase 2 Integration epic
// Returns status: "awaiting_cp2" so dashboard opens in cp2_ready state by default
export async function getRunStatus(runId: string): Promise<RunStatus> {
  // Mock payload from spec Section 7.3
  // Suppress unused parameter warning for stub
  void runId;
  return {
    run_id: "run_mock_001",
    status: "awaiting_cp2",
    current_step: "write_proposals",
    progress_pct: 100,
  };
}

// stub — returns mock data; real backend wiring in Phase 2 Integration epic
// Returns the 2 drafts exactly as spec Section 7.3
export async function getDrafts(runId: string): Promise<Draft[]> {
  // Suppress unused parameter warning for stub
  void runId;
  await new Promise((resolve) => setTimeout(resolve, 200)); // simulate network
  return [
    {
      id: "draft_001",
      job_id: "job_001",
      content:
        "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow and immediately thought of the work I did for Warehance — a warehouse management platform where I redesigned the entire user onboarding experience, reducing time-to-first-value from 3 days to under 4 hours. The key was mapping the user's mental model before designing a single screen.\n\nI started with a 3-day discovery sprint: five user interviews with warehouse operations managers, a competitor audit of seven platforms, and a full audit of every onboarding touchpoint. What we found was that users were failing not because the interface was unclear — it was because the onboarding assumed knowledge of the product vocabulary (\"zones,\" \"routes,\" \"assignments\") before users had any operational context.\n\nThe redesign introduced a progressive onboarding that tied every concept introduction to a real operational moment: users set up their first zone while the system explained zones. First-value metric dropped from 3 days to under 4 hours. Churn in the first 30 days dropped 40%.\n\nI'd approach your B2B SaaS onboarding with the same first-principles methodology: understanding where users are mentally, not just where they are in the UI. Would love to learn more about your current onboarding drop-off points. What does your data show about where users lose momentum?",
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
        recommendation: "Pursue",
      },
    },
    {
      id: "draft_002",
      job_id: "job_002",
      content:
        "Hello, your project to improve the Shopify checkout conversion rate caught my attention. I recently completed a similar engagement with TechStyle — a Shopify fashion brand where cart abandonment was at 74%. After conducting user session analysis and redesigning the checkout flow, we reduced abandonment to 51% — a 31% relative improvement — and increased revenue per session by 18%.\n\nThe core issues we found at TechStyle were three: unexpected shipping costs surfaced too late (step 3 of 4), a required account creation step before purchase, and a confusing promo code field that caused rage-clicks. We addressed each with focused interventions rather than a full redesign.\n\nFor your project, I would begin with a session recording audit (FullStory or Hotjar) to identify your specific failure points before proposing any solution. Checkout optimization is highly context-dependent — the right fix depends on your specific user cohort and abandonment stage.\n\nI am available for an initial discovery call to review your current analytics and discuss the scope. What does your current checkout abandonment rate look like, and at which step do you see the largest drop-off?",
      voice_confidence_score: 0.55,
      portfolio_items_used: ["techstyle", "lari_digital"],
      edit_suggestions: [
        "Opening lacks a specific data hook — add a metric from TechStyle conversion improvement",
        "Tone is more formal than your typical voice; reduce passive voice in paragraph 2",
        "Missing a direct question to the client to invite response",
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
        recommendation: "Review",
      },
    },
  ];
}

// stub — returns mock data; real backend wiring in Phase 2 Integration epic
export async function submitFeedback(
  draftId: string,
  action: "approve" | "edit" | "skip",
  editedContent?: string
): Promise<FeedbackResult> {
  // Suppress unused parameter warning for stub
  void editedContent;
  await new Promise((resolve) => setTimeout(resolve, 200)); // simulate network

  if (action === "approve") {
    return {
      success: true,
      draft_id: draftId,
      new_status: "Submitted",
      clipboard_text:
        draftId === "draft_001"
          ? "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow..."
          : "Hello, your project to improve the Shopify checkout conversion rate caught my attention...",
    };
  }

  if (action === "skip") {
    return {
      success: true,
      draft_id: draftId,
      new_status: "Archived",
    };
  }

  // edit
  return {
    success: true,
    draft_id: draftId,
    new_status: "Drafted",
  };
}
