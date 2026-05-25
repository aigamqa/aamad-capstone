// stub — Phase 2 Integration epic wires this to FastAPI backend
// POST /api/crew/run — triggers pipeline run, returns run_id synchronously

import { NextResponse } from "next/server";

export async function POST() {
  // stub — returns mock data; real backend wiring in Phase 2 Integration epic
  return NextResponse.json({
    run_id: "run_mock_001",
    started_at: new Date().toISOString(),
  });
}
