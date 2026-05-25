# AI Sales Team MVP Dashboard

Frontend scaffold for the AI Sales Team CP2 HITL review surface.
Phase 2 Frontend epic — @frontend.eng, 2026-05-20.

## Tech Stack

- Next.js 14 App Router
- TypeScript 5
- Tailwind CSS 3
- shadcn/ui components (rewritten for Tailwind CSS 3 / Next.js 14 compatibility)
- Zustand 5 — ReviewSessionState store
- SWR 2 — polling getRunStatus during pipeline runs
- sonner — toast notifications
- Radix UI primitives (collapsible, tooltip, progress)
- lucide-react — icons

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
# Redirects to http://localhost:3000/dashboard
```

Dashboard opens in `cp2_ready` state by default, showing 2 mock draft cards:
- **draft_001**: Senior UX Designer for B2B SaaS Onboarding Redesign — voice match: strong (0.84)
- **draft_002**: Shopify Checkout UX Optimization — voice match: weak (0.55) with edit suggestions

## Mock Data

All data is stubbed in `lib/api.ts`. No backend required, no API keys, no external calls.

Mock payloads match spec Section 7.3 exactly.

## HITL Behavior

- Approve button is disabled until you scroll to the end of the draft (scroll gate via IntersectionObserver)
- Approve copies clipboard text and opens Upwork job URL in a new tab. No automated submission ever occurs.
- Skip archives the draft
- Edit opens an inline textarea editor. Saving resets the scroll gate — you must re-read before approving.

## Where the CrewAI Backend Connects

Per SAD Section 4 FastAPI route table:

| Frontend stub | FastAPI route |
|--------------|---------------|
| `startScan()` | `POST /api/crew/run` |
| `getRunStatus(runId)` | `GET /api/crew/status/{run_id}` |
| `getDrafts(runId)` | `GET /api/drafts` |
| `submitFeedback(id, action, content?)` | `POST /api/drafts/{id}/{action}` |
| HITL checkpoint | `POST /api/hitl/checkpoint` |

Integration happens in the Phase 2 Integration epic. All stub functions are in `lib/api.ts` with comments marking the wiring points.

## Build

```bash
npm run build   # exits 0
```

## Status

MVP scaffold — Phase 2 Frontend epic complete.
Integration epic will wire stub functions to FastAPI backend.
