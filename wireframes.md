# Frontend Wireframes — Today's Drafts Workflow (MVP)

> **Status**: Bridge artifact (textual wireframes). To be refined in Figma by builder before `*develop-fe` scaffold step.
> **Author**: Aigam + Cowork session 2026-05-18
> **References**: `frontend-functional-spec.md` (workflow contract), `project-context/1.define/sad.md` Section 3 (Frontend Architecture)
> **Out of Scope for this artifact**: pixel-perfect spacing, color tokens beyond palette, mobile breakpoints (desktop-only MVP per SAD)

---

## Layout System

Per SAD Section 3 + Tailwind defaults:

- Container: `max-w-7xl mx-auto px-6`
- Top app bar: `h-16 sticky top-0 bg-white border-b z-50`
- Status banner zone: directly below app bar, height variable by state
- Main content: scrollable area below status banner
- Side rail / navigation: deferred to V1 (single-screen MVP)

## Color Palette (from KONSPEKT_Week2 Block B Lesson 2 + SAD)

| Token | Tailwind | Use |
|-------|----------|-----|
| Status idle | `bg-gray-400` (dot) | Empty/no run state |
| Status running | `bg-blue-500 animate-pulse` | Active pipeline step |
| Status done | `bg-green-500` | Pipeline complete |
| Status error | `bg-red-500` | Failure |
| Voice match strong | `bg-green-100 text-green-800` (Badge) | confidence ≥ 0.80 |
| Voice match moderate | `bg-amber-100 text-amber-800` | 0.60–0.79 |
| Voice match weak | `bg-red-100 text-red-800` | < 0.60 |
| Approve action | `bg-green-600 hover:bg-green-700` (Button primary) | Primary CTA per draft |
| Edit action | outline button (default) | Secondary |
| Skip action | ghost button (subtle) | Tertiary, less prominent |

---

## Screen 1 — Dashboard in `idle` state

User opens dashboard, no active run.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AI Sales Team          run_id: —          last_updated: —    [⚙ Settings]      │ ← App bar (h-16)
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ●  Crew: idle                                                                  │ ← Status banner (Alert, neutral)
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                                                                                  │
│                              ┌─────────────────────────┐                        │
│                              │                         │                        │
│                              │       No active run     │                        │
│                              │                         │                        │
│                              │   Click "Scan Now" to   │                        │
│                              │   discover new jobs.    │                        │
│                              │                         │                        │
│                              │     [ ⌕  Scan Now ]     │                        │ ← Primary button, centered
│                              │                         │                        │
│                              └─────────────────────────┘                        │
│                                                                                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Layout decisions:**
- Empty state vertically centered to avoid feeling barren
- "Scan Now" button is **only** affordance — no distractions
- App bar shows `run_id: —` and `last_updated: —` placeholders (consistency with other states)

---

## Screen 2 — Dashboard in `running_qualify` state (representative of all `running_*` states)

User triggered scan; pipeline is mid-execution. Loading skeleton replaces draft cards.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AI Sales Team       run_id: run_mock_001     last_updated: 09:23   [⚙]          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ●  Crew: running · Step 2/3: Qualifying clients...      [██████░░░░░░] 40%     │ ← Banner blue pulse + step + progress
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Today's Drafts — preparing...                                                   │ ← Section header
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │ ← Skeleton card 1
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░  ░░░░░░░░░░░░░░░░░░░░  ░░░░░░░░░░░░░░░░░     │    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │ ← Skeleton card 2
│  │  ...                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Layout decisions:**
- Status banner sticky during scroll (`sticky top-16`) — always visible
- Step counter `Step 2/3` + progress bar gives **two visual signals** (textual + bar)
- Skeleton cards match real card layout — no jarring layout shift when transitioning to `cp2_ready`
- `last_updated` updates on each `getRunStatus()` poll — shows UI is alive

---

## Screen 3 — Dashboard in `cp2_ready` state (MAIN HITL surface)

This is **the screen** users see most. 3 draft cards rendered, user processes Approve/Edit/Skip per card.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AI Sales Team       run_id: run_mock_001     last_updated: 09:24   [⚙]          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ●  Crew: done · 3 drafts ready for review            Progress: 0 / 3 reviewed  │ ← Banner green + progress
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Today's Drafts (3)                                                              │ ← Section header
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │  Senior UX Designer for B2B SaaS Onboarding Redesign           ⌃ Open    │    │ ← DraftCard (collapsed/expanded)
│  │  $3,000–$6,000  ·  Client score: 8.2/10  ·  Pursue            │           │    │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │    │
│  │  │  Hi [Client Name], I came across your post about building a       │  │    │
│  │  │  custom B2B SaaS onboarding flow and immediately thought of the   │  │    │
│  │  │  work I did for Warehance — a warehouse management platform...    │  │    │ ← Scroll-gated text
│  │  │  ↓ scroll to see full draft ↓                                     │  │    │
│  │  └────────────────────────────────────────────────────────────────────┘  │    │
│  │  [🟢 Voice match: strong]  Cases used: warehance · ernesto_vargas         │    │
│  │                                                                           │    │
│  │              [ Skip ]    [ Edit ]    [ ✓ Approve & Copy ]                │    │ ← Actions: ghost / outline / primary
│  │                                              (disabled until scrolled)    │    │
│  │  ▼ Why this draft?                                                        │    │ ← Collapsed evidence section
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │  Shopify Checkout UX Optimization                              ⌃ Open    │    │
│  │  $1,500–$2,500  ·  Client score: 6.4/10  ·  Review            │           │    │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │    │
│  │  │  Hello, your project to improve the Shopify checkout conversion   │  │    │
│  │  │  rate caught my attention. I recently completed a similar...      │  │    │
│  │  └────────────────────────────────────────────────────────────────────┘  │    │
│  │  [🔴 Voice match: weak]  Cases used: techstyle · lari_digital             │    │
│  │                                                                           │    │
│  │  ⚠  Suggestions for improvement:                                          │    │ ← Alert (destructive variant, when < 0.60)
│  │     • Opening lacks a specific data hook — add a metric from TechStyle    │    │
│  │     • Tone is more formal than your typical voice; reduce passive voice   │    │
│  │     • Missing a direct question to invite client response                 │    │
│  │                                                                           │    │
│  │              [ Skip ]    [ Edit ]    [ ✓ Approve & Copy ]                │    │
│  │  ▼ Why this draft?                                                        │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  [draft 3 would render here, abbreviated for wireframe]                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Layout decisions:**
- Status banner stays — but now shows progress N/M instead of step progress
- Cards stack vertically (single column) — focus and discipline > horizontal density
- **Action buttons right-aligned** — convention; primary (Approve) on far right
- Voice match badge directly under preview — immediate trust signal
- Edit suggestions Alert: shown only when `voice_confidence_score < 0.60` — never wastes space when not needed
- "Why this draft?" disclosure collapsed by default — observability without overwhelm
- Scroll gate visible by ↓ chevron at preview bottom; Approve disabled until satisfied

---

## Screen 4 — Dashboard in `done` state

All drafts actioned. Summary panel + next-step CTA.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AI Sales Team       run_id: run_mock_001     last_updated: 09:42   [⚙]          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ●  Crew: done                                          Progress: 3 / 3 reviewed │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                                                                                  │
│                ┌─────────────────────────────────────────────────┐              │
│                │                                                 │              │
│                │             ✓  Review complete                  │              │
│                │                                                 │              │
│                │           2 approved   ·   1 skipped            │              │
│                │                                                 │              │
│                │     Approved drafts copied to clipboard,        │              │
│                │     Upwork tabs opened. Submit on Upwork,       │              │
│                │     then return to mark pipeline complete.      │              │
│                │                                                 │              │
│                │       [  Mark pipeline complete  →  ]           │              │ ← Primary CTA
│                │                                                 │              │
│                │   run_id: run_mock_001 · Started: 09:00         │              │ ← Traceability footer
│                │                                                 │              │
│                └─────────────────────────────────────────────────┘              │
│                                                                                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Layout decisions:**
- Centered card (~520px wide) — celebration moment, focused on summary
- Counts shown big — primary information
- Instructions text below counts — reminds user of manual Upwork submit step (ToS-compliant)
- `run_id` in footer — small, for traceability/debugging
- Single CTA — no decision paralysis

---

## DraftCard component — expanded with "Why this draft?" open

This is detail-zoom of one card with evidence section expanded.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Senior UX Designer for B2B SaaS Onboarding Redesign           ⌃ Open in Upwork  │
│  $3,000–$6,000  ·  Client score: 8.2/10  ·  Pursue                               │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Hi [Client Name], I came across your post about building a custom B2B    │  │
│  │  SaaS onboarding flow and immediately thought of the work I did for       │  │
│  │  Warehance — a warehouse management platform where I redesigned the       │  │
│  │  entire user onboarding experience, reducing time-to-first-value from     │  │
│  │  3 days to under 4 hours.                                                 │  │
│  │                                                                            │  │
│  │  The key was mapping the user's mental model before designing a single    │  │
│  │  screen. I'd love to apply that same approach to your B2B SaaS...         │  │
│  │  [...full draft scrolls here, 250-300 words total...]                     │  │
│  │  ⬇ scrolled to end ⬇                                                       │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  [🟢 Voice match: strong]  Cases used: warehance · ernesto_vargas                │
│                                                                                  │
│              [ Skip ]    [ Edit ]    [ ✓ Approve & Copy ]                       │
│                                                                                  │
│  ▲ Why this draft? (expanded)                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Qualification: score 8.2/10 — Pursue                                      │  │
│  │  Green flags: payment verified, $20K+ spent, 5-star rating, US-based      │  │
│  │  Red flags: (none detected)                                                │  │
│  │                                                                            │  │
│  │  Portfolio match:                                                          │  │
│  │  • Warehance — B2B SaaS onboarding redesign (3 days → 4 hours metric)    │  │
│  │  • Ernesto Vargas — B2B web app first-run UX                              │  │
│  │  Match reason: industry + problem type both align (B2B + onboarding flow) │  │
│  │                                                                            │  │
│  │  Voice confidence: 0.84 (strong) — phrase overlap with 3 voice examples  │  │
│  │  Generated by: Proposal Writer (Opus 4.6) · 09:23 UTC                    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Layout decisions:**
- "Why this draft?" — collapsed by default; user expands when wants details
- Inside: qualification + portfolio + voice confidence — all three trust signals in one place
- Generator attribution (Opus 4.6 + timestamp) — observability, debugging

---

## Out of scope for this artifact (decide in Figma or next session)

- **CP1 gate overlay** — Modal vs section-level Alert (spec Open Question #3)
- **DraftEditor with assistant-ui** — exact embed layout (spec Open Question #6)
- **Settings page** layout
- **Mobile breakpoints** — desktop-only MVP per SAD
- **Dark mode** — defer
- **Spacing tokens / exact paddings** — Figma will resolve

---

## Decisions log for Figma session

For each decision below, builder should validate or revise in Figma:

| # | Decision (proposed) | Alt option | Verify in Figma? |
|---|---------------------|------------|------------------|
| 1 | Approve button on far right of action row | Center, full-width | Yes |
| 2 | Action row: Skip · Edit · Approve (left to right) | Approve · Edit · Skip | Yes |
| 3 | Status banner sticky on scroll | Static at top | Yes |
| 4 | Cards in single column, full width | Two-column grid | Yes — single column wins for review focus |
| 5 | "Why this draft?" expanded inline (below buttons) | Modal | Yes |
| 6 | Voice match badge color = strict 3-level (green/amber/red) | Continuous gradient | Yes — discrete is simpler |
| 7 | Skip button = ghost variant (subtle) | Same prominence as Approve | Yes — discourage skipping prematurely |
| 8 | Edit button = outline variant | Same as Skip | Yes |
| 9 | App bar: minimal (logo + run_id + last_updated + settings) | Add user/profile area | No, MVP single-user |
| 10 | Scroll gate visible via ↓ chevron at preview bottom | Hidden behind disabled state only | Yes — chevron is more discoverable |

---

## Source files

- `frontend-functional-spec.md` — workflow contract (FSM, services, components map)
- `project-context/1.define/sad.md` — SAD v1.3 (Sections 3, 6)
- `/Users/aigamshamali/Downloads/Become an Agentic Architect/Week 2/КОНСПЕКТ_Week2.md` — Block B user journey + visual signals palette
