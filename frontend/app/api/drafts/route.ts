// stub — Phase 2 Integration epic wires this to FastAPI backend
// GET /api/drafts — returns draft proposals for the current run

import { NextResponse } from "next/server";

export async function GET() {
  // stub — returns mock data; real backend wiring in Phase 2 Integration epic
  return NextResponse.json([
    {
      id: "draft_001",
      job_id: "job_001",
      content:
        "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow...",
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
      content: "Hello, your project to improve the Shopify checkout conversion rate caught my attention...",
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
  ]);
}
