// stub — Phase 2 Integration epic wires this to FastAPI backend
// POST /api/drafts/[draft_id]/[action] — records draft action (approve | edit | skip)

import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { draft_id: string; action: string } }
) {
  // stub — returns mock data; real backend wiring in Phase 2 Integration epic
  const { draft_id, action } = params;

  if (action === "approve") {
    return NextResponse.json({
      success: true,
      draft_id,
      new_status: "Submitted",
      clipboard_text: "Hi [Client Name], I came across your post about building a custom B2B SaaS onboarding flow...",
    });
  }

  if (action === "skip") {
    return NextResponse.json({
      success: true,
      draft_id,
      new_status: "Archived",
    });
  }

  return NextResponse.json({
    success: true,
    draft_id,
    new_status: "Drafted",
  });
}
