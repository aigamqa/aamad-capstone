// stub — Phase 2 Integration epic wires this to FastAPI backend
// POST /api/hitl/checkpoint — records HITL gate events and unblocks CrewAI Flow wait() states
// Payload shape from spec Section 5.2:
// { checkpoint: "cp1" | "cp2" | "cp2_final", run_id?, draft_id?, action?, approved_job_ids?, timestamp }

import { NextResponse } from "next/server";

export async function POST() {
  // stub — returns mock success; real backend wiring in Phase 2 Integration epic
  // In production: this endpoint unblocks the CrewAI Flow wait() state for the given checkpoint
  return NextResponse.json({ success: true });
}
