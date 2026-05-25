// stub — Phase 2 Integration epic wires this to FastAPI backend
// GET /api/crew/status/[run_id] — returns current pipeline run status

import { NextResponse } from "next/server";

export async function GET() {
  // stub — returns mock data; real backend wiring in Phase 2 Integration epic
  return NextResponse.json({
    run_id: "run_mock_001",
    status: "awaiting_cp2",
    current_step: "write_proposals",
    progress_pct: 100,
  });
}
