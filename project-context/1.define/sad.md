# System Architecture Document (SAD) — MVP
## AI Sales Team for Solo Freelancers

**Document Type**: System Architecture Document — MVP Variant (`*create-sad --mvp`)
**Phase**: 1 — Define
**Date**: 2026-05-15
**Persona**: @system.arch
**AAMAD_TARGET_RUNTIME**: crewai
**PRD Reference**: project-context/1.define/prd.md
**MRD Reference**: project-context/1.define/mr.md

---

## Stakeholders and Concerns

| Stakeholder | Role | Primary Concerns |
|-------------|------|-----------------|
| Aigam Shamali (Founder / Primary User) | Builder, first user, ICP | HITL enforced at all times; proposals in personal voice; zero ToS risk; daily review in <15 min |
| Phase 2 Implementation Agents (@backend.eng, @frontend.eng, @integration.eng, @qa.eng) | Developers | Unambiguous component boundaries; traceable spec; no ambiguity on MVP scope vs. deferrals |
| Future SaaS Users (V1+) | End users | Privacy, data isolation, multi-tenant readiness |

**Open Concerns documented in Open Questions section.**

---

## MVP Scope Declaration

**Included in MVP (P0):**
- 3 CrewAI agents: Job Scout, Client Qualifier, Proposal Writer
- Chrome Extension ingestion + manual URL paste fallback
- Telegram push notifications
- Next.js 14+ review dashboard (shadcn/ui + assistant-ui hybrid)
- PostgreSQL pipeline state storage (Render.com free tier)
- HITL checkpoints CP1 (conditional), CP2 (mandatory), CP3 (mandatory for V1)
- Prompt Trace logging
- Cost cap enforcement ($1/day)
- Render.com deployment

**Explicitly Excluded from MVP (deferred):**
- Portfolio Matcher agent — **[DEFERRED: V1]**
- Chat Engagement Agent — **[DEFERRED: V1]**
- Pipeline Tracker as standalone LLM agent — implemented as Postgres-backed service, not CrewAI agent
- Embeddings / semantic search — **[DEFERRED: V1]**
- PostgreSQL multi-tenant storage — **[DEFERRED: V1]**
- Email / Slack notifications — **[DEFERRED: V1]**
- Mobile-responsive frontend — **[DEFERRED: V1]**
- SOC2 / enterprise security — **[DEFERRED: V2]**
- Contra / LinkedIn ProFinder integrations — **[DEFERRED: V2]**
- MCP Server integration — **[DEFERRED: V2]**

**Known MVP Limitation (verbatim from Decision Log D6):**
> "Chrome Extension ingestion requires Chrome browser to be open on Aigam's machine and logged into Upwork with at least one Upwork tab active. When the laptop is closed or Chrome is not running, ingestion stops and no new jobs are captured. This is a known MVP scope limitation; v2 considers email digest fallback or always-on server-side scheduler."

---

## 1. MVP Architecture Philosophy & Principles

### MVP Design Principles

**Context-First, Not Throughput-First**
The product narrative is grounded in Aigam's real Q4 2023 data: 198 proposals, 10 conversations, 0 contracts. The bottleneck is not sending volume — it is match quality (low response rate) and chat-stage conversion (0% close rate). The architecture is designed to maximize match quality and support chat engagement, not to maximize proposal throughput.

**HITL as Architectural Invariant, Not Policy**
Human review is not a feature flag or a setting. No code path exists that performs an external action without explicit user approval. The CrewAI Flow `wait()` state pattern is used as the HITL gate mechanism. This is the single most important architectural constraint.

**Platform Safety by Design**
The Chrome Extension reads the Upwork DOM in Aigam's own authenticated session. No credentials are stored in the backend. No automated submission is possible. Zero auto-submit code paths exist anywhere in the system. Chrome Extension scans on a jittered schedule: base interval 15–30 minutes ± random(3–5 minutes) to avoid detectable polling patterns. Each scan includes simulated human behavior: page scroll + 2–4s dwell before DOM extraction. Extension halts and surfaces Telegram alert if Upwork serves a CAPTCHA or challenge page. Configurable minimum interval is 15 minutes.

**Flow + Crew(s) Orchestration**
CrewAI Flow orchestrates the main pipeline with explicit steps and wait gates. Local Crews handle reasoning-heavy subtasks. This separates pipeline control flow (Flow) from agent reasoning (Crew), making HITL checkpoints first-class citizens of the architecture.

**Minimal Viable Infrastructure**
Single-user MVP on Render.com at under $75/month. **PostgreSQL (Render.com free tier) for state** (chosen over SQLite-on-Volume after external QR identified `database is locked` risk under concurrent Chrome Extension writes + frontend reads on network-attached storage). Local file portfolio. No message queue, no container orchestration, no distributed systems complexity. All of these are deferred to V1/V2.

**Observable by Default**
Every LLM call generates a Prompt Trace entry. Every agent lifecycle event (start, stop, retry, guardrail outcome) is logged to `project-context/2.build/logs/`. Cost is tracked per run against a $1/day hard cap.

### Technical Architecture Decisions

**Why Next.js App Router (not Pages Router)**
App Router supports React Server Components, enabling server-side data fetching for pipeline state without client-side waterfall. Streaming responses from the Python backend are handled via Server Actions or API routes with ReadableStream. TypeScript and file-based routing reduce boilerplate.

**Why Hybrid shadcn/ui + assistant-ui (not pure assistant-ui)**
The primary UX pattern is structured card review (Approve / Edit / Skip per job), not a conversational chat flow. Pure assistant-ui would impose a chat paradigm on a task that is fundamentally card-based review, adding cognitive overhead. shadcn/ui handles the dashboard; assistant-ui is scoped to the inline draft editing surface only, where AI-assisted editing is genuinely conversational.

**Why CrewAI Flow + Local Crews (not Pure Crew)**
Pure Crew with delegation cannot natively pause for human input. Flow `wait()` states provide clean HITL checkpoints. Daily cost cap enforcement is deterministic at the Flow step level. Task output reproducibility is higher with explicit Flow steps than with hierarchical Crew delegation.

**Why Anthropic API Direct (not OpenRouter)**
OpenRouter adds ~5% cost margin and an extra dependency. All agents use Claude 4.x models exclusively; no multi-provider routing is needed. Anthropic's native SDK supports streaming, prompt caching (reducing costs ~70% on repeated prompt prefixes), and tool use natively. The builder already has existing Claude Pro context from the AAMAD academy.

### Core vs. Future Features Framework

| Category | MVP (P0) | V1 (P1) | V2 (P2) |
|----------|----------|---------|---------|
| Agents | 3 (Scout, Qualifier, Writer) | +Portfolio Matcher, Chat Engagement | MCP integrations |
| Storage | Postgres (Render free tier) + local files | Postgres multi-tenant | Encrypted at-rest |
| Notifications | Telegram bot | Email / Slack daily digest | Push (mobile) |
| Frontend | Next.js + shadcn/ui + assistant-ui | Mobile-responsive | React Native app |
| Ingestion | Chrome Extension + manual paste | Email digest fallback | Always-on scheduler |
| Platform | Upwork only | Upwork full | Contra + LinkedIn ProFinder |
| Observability | Prompt Trace JSONL files + cost cap | Langfuse for LLM trace dashboard + Phase 3 evaluation harness | Datadog APM, distributed tracing |
| Learning loop | HITL approve/edit/skip events written to Postgres | RLHF — replay approve/edit/skip telemetry as few-shot examples for Proposal Writer; calibrate voice_confidence_score against ground-truth labels | Fine-tuned voice model (open-source backbone) |

---

## 2. Multi-Agent System Specification

### System-Level Architecture: Flow + Crew(s)

```
CrewAI Flow: SalesPipelineFlow
│
├── Step 1: scan_jobs()
│   └── JobScoutCrew (1 agent: Job Scout)
│       └── Task: discover_jobs → output: ranked job list
│
├── Step 2: qualify_jobs()
│   └── QualifierCrew (1 agent: Client Qualifier)
│       └── Task: qualify_jobs → output: scored job reports
│       └── [CP1: conditional HITL — if any job score 0.4–0.6, pause for user review]
│
├── [CP2: mandatory HITL — user reviews shortlist, approves jobs to draft]
│   └── Flow.wait(approved_jobs) — blocks until approved=true
│
├── Step 3: write_proposals()
│   └── ProposalCrew (1 agent: Proposal Writer)
│       └── Task: draft_proposals → output: proposal drafts
│
└── [CP2 FINAL: mandatory HITL — user reviews drafts, approves/edits/skips]
    └── Flow.wait(reviewed_drafts) — blocks until all drafts actioned
```

**[DEFERRED: V1]** — V1 Flow steps will add Portfolio Matcher (as mini-Crew with Writer) and Chat Engagement (separate Flow trigger on Upwork chat reply event).

### Agent Definitions

#### Agent 1: Job Scout (MVP — P0)

| Attribute | Value |
|-----------|-------|
| id | `job_scout` |
| role | "Upwork Job Discovery Specialist" |
| LLM | Claude Haiku 4.5 |
| LLM rationale | Parsing + rules-based filtering; no complex reasoning needed; lowest cost per token |
| tools | `ChromeExtensionIngestionTool`, `JobFilterTool`, `PipelineStateWriteTool` |
| allow_delegation | false |
| memory | false |
| max_iter | 8 |
| max_execution_time | 120s |
| max_retry_limit | 3 |

**Task: discover_jobs**
- Input: Job payloads from Chrome Extension via authenticated webhook endpoint; user filter config from Postgres settings table
- Processing: Validate Chrome Extension payload schema; apply HARD_FILTERS (see D4); deduplicate against `jobs` table (last 30 days); rank by recency — jobs posted within SOFT_SIGNALS.posted_within_hours threshold receive priority weighting; older jobs are included but ranked lower. posted_within_hours is a ranking signal, not a hard filter.
- Output: Ranked list of 5–15 jobs meeting criteria. Per job: `title`, `budget`, `posted_date`, `url`, `150-char snippet`, `relevance_rank`. Written to Postgres `jobs` table with `status=Discovered`.
- expected_output path: `project-context/2.build/crew-state/scout_output.json`
- guardrail: Chrome Extension payload validated against expected schema before processing; halt with Diagnostic on schema mismatch
- Task.id: `task_discover_jobs`

**Hard Filter Configuration (from Decision D4):**
```python
HARD_FILTERS = {
    "min_star_rating": 4.5,
    "min_hire_rate": 0.55,
    "min_avg_hourly_paid": 30,
    "hires_on_this_job": 0,
    "exclude_categories": ["mobile_app"],
    "priority_categories": ["ecommerce_shopify", "b2b_website", "web_app"]
}
SOFT_SIGNALS = {
    "total_spent_min": 0,
    "posted_within_hours": 2,
    "activity_proposals_max": 30
}
```

#### Agent 2: Client Qualifier (MVP — P0)

| Attribute | Value |
|-----------|-------|
| id | `client_qualifier` |
| role | "Client Due Diligence Analyst" |
| LLM | Claude Sonnet 4.6 |
| LLM rationale | Gate decision with accuracy requirements; transparent scoring reasoning; error cost is high |
| tools | `UpworkProfileFetchTool`, `ClientScoringTool`, `PipelineStateWriteTool` |
| allow_delegation | false |
| memory | false |
| max_iter | 8 |
| max_execution_time | 120s per job |
| max_retry_limit | 3 |

**Task: qualify_jobs**
- Input: Discovered job list from Scout task (via Task.context); public Upwork client profile URLs
- Processing: Fetch public client signals; apply rules engine (payment_verified, hire_rate, spend thresholds from D4); compute score 1–10; identify green_flags[] and red_flags[]; generate reasoning paragraph
- Output: Per-job qualification report: `score` (1–10), `payment_verified` (bool), `total_spend` ($), `avg_rate` ($/hr), `hire_rate` (%), `red_flags[]`, `green_flags[]`, `recommendation` (Pursue / Skip / Review), reasoning paragraph. Written to `qualified_jobs` table.
- expected_output path: `project-context/2.build/crew-state/qualifier_output.json`
- guardrail: Score must be float 1.0–10.0; recommendation must be one of {Pursue, Skip, Review}; reasoning paragraph required (min 50 chars)
- HITL trigger: If any job score in range 0.4–0.6, CP1 fires — frontend surfaces borderline jobs for user review before proceeding
- Task.id: `task_qualify_jobs`
- Task.context: [task_discover_jobs]

#### Agent 3: Proposal Writer (MVP — P0)

| Attribute | Value |
|-----------|-------|
| id | `proposal_writer` |
| role | "Expert Freelance Proposal Copywriter" |
| LLM | Claude Opus 4.6 |
| LLM rationale | Highest-value agent; proposal quality directly drives monetization; upgraded from Sonnet to Opus per Decision D3 |
| tools | `PortfolioReadTool`, `VoiceExamplesTool`, `ProposalDraftTool`, `PipelineStateWriteTool` |
| allow_delegation | false |
| memory | false |
| max_iter | 12 |
| max_execution_time | 300s |
| max_retry_limit | 3 |

**Task: draft_proposals**
- Input: User-approved qualified jobs from CP2 (via Flow state); portfolio/[case].md files; voice examples from onboarding
- Processing: Load 6 canonical portfolio cases (Accounto, TechStyle, Immopro, Ernesto Vargas, Warehance, Lari.Digital); select 2–3 relevant by keyword overlap (MVP; semantic matching deferred to V1); load user voice examples; generate 200–350 word cover letter; compute voice_confidence_score
- Output: Draft cover letter, `voice_confidence_score` (0–1), `portfolio_items_used[]`, `edit_suggestions[]` (when confidence < 0.80). Written to `drafts` table with `status=Drafted`.
- expected_output path: `project-context/2.build/crew-state/writer_output.json`
- guardrail: Word count 180–380; voice_confidence_score must be float 0.0–1.0; portfolio_items_used must include 2–3 items; drafts with score < 0.60 flagged with edit_suggestions required
- Task.id: `task_draft_proposals`
- Task.context: [task_qualify_jobs]

**[DEFERRED: V1]** — Portfolio Matcher agent replaces keyword-overlap portfolio selection with embeddings-based semantic similarity. Portfolio Matcher and Proposal Writer will form a mini-Crew with explicit task chaining.

#### Pipeline Tracker (Service — not a CrewAI agent)

The Pipeline Tracker is implemented as a Postgres-backed state service, not a CrewAI LLM agent. It has no LLM, no CrewAI agent definition, and no YAML entry.

- **Implementation**: Python module `pipeline_tracker.py` with synchronous read/write methods
- **Called by**: All CrewAI agents via `PipelineStateWriteTool` and `PipelineStateReadTool`
- **Tables managed**: `jobs`, `qualified_jobs`, `drafts`, `pipeline_state`, `prompt_traces`
- **State machine**: Discovered → Qualified → Drafted → Submitted → Replied → Call Scheduled → Won → Lost → Archived

#### [DEFERRED: V1] Portfolio Matcher

| Attribute | Value |
|-----------|-------|
| id | `portfolio_matcher` |
| LLM | Claude Haiku 4.5 |
| Description | Multi-dimensional ranking (industry × problem × visual style) from 6 canonical cases using embeddings |
| Dependency | Requires OpenAI/Voyage Embeddings API for semantic search |

#### [DEFERRED: V1] Chat Engagement Agent

| Attribute | Value |
|-----------|-------|
| id | `chat_engagement` |
| LLM | Claude Sonnet 4.6 |
| Description | Triggered by Upwork chat reply event; drafts replies for active chats; pings stale chats (>3 days); HITL CP3 always required |

### CrewAI Framework Configuration

```python
# crew_config.py — resolved values
CREW_DEFAULT_LLM = "claude-haiku-4-5"
PROCESS_MODE = "sequential"          # Flow controls sequencing; Crews use sequential internally
MEMORY = False                        # Reproducibility; portfolio loaded per-run from storage
CREWAI_STORAGE_DIR = "project-context/2.build/crew-state/"
MAX_RPM = 10                          # Crew-level budget stability guard
VERBOSE = True                        # Debug logging for MVP

# Per-agent overrides (see agent definitions above)
# job_scout: Haiku 4.5, max_iter=8, max_execution_time=120
# client_qualifier: Sonnet 4.6, max_iter=8, max_execution_time=120
# proposal_writer: Opus 4.6, max_iter=12, max_execution_time=300
```

**Config file structure (CrewAI adapter requirement):**
```
backend/
  config/
    agents.yaml     # Agent role, goal, backstory, llm, tools, allow_delegation, memory, max_iter
    tasks.yaml      # Task description, expected_output, context, guardrail, agent, id
  crew.py           # Flow entrypoint; step definitions; wait() gates
```

**Cost Baseline:**
- Job Scout (Haiku 4.5): ~$0.01/run
- Client Qualifier (Sonnet 4.6): ~$0.12/run (10 jobs)
- Proposal Writer (Opus 4.6): ~$0.10/proposal
- Estimated total: ~$0.23/day for 1 full run with 5 proposals → ~$7/month at daily usage
- Decision D3 cost estimate: ~$23/month MVP (includes prompt caching amortization)
- Hard cap: `DAILY_LLM_COST_CAP_USD=1.00` enforced at Flow level before each step

---

## 3. Frontend Architecture Specification (Next.js + assistant-ui)

### Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js App Router | 14+ | Server Components; streaming; file-based routing; TypeScript native |
| Dashboard UI | shadcn/ui | latest | Accessible, headless components; Radix UI primitives; Tailwind-compatible |
| AI Editor | assistant-ui | latest | Scoped to inline draft editing only; genuine conversational editing surface |
| Styling | Tailwind CSS | 3+ | Utility-first; consistent design system; rapid iteration |
| Type Safety | TypeScript | 5+ | End-to-end type safety; required per adapter rules |
| State | Zustand | 4+ | Lightweight client-side state for review session (approved/pending/skipped) |
| API Client | native fetch + SWR | — | SWR for polling pipeline state; native fetch for POST actions |

### Application Directory Structure

```
frontend/
  app/
    layout.tsx                  # Root layout; global providers; Telegram status indicator
    page.tsx                    # Redirect to /dashboard
    dashboard/
      page.tsx                  # Today's Drafts (main HITL surface — CP2)
    pipeline/
      page.tsx                  # Pipeline Board (Kanban-style by stage)
    chats/
      page.tsx                  # [DEFERRED: V1] Active Chats (CP3)
    settings/
      page.tsx                  # Filters, portfolio manager, voice examples, notification prefs
    api/
      crew/
        run/route.ts            # POST: trigger Flow run; returns run_id
        status/[run_id]/route.ts # GET: poll run status and step progress
      pipeline/
        route.ts                # GET: fetch pipeline state; PATCH: update item status
      drafts/
        [draft_id]/
          approve/route.ts      # POST: mark draft approved, copy action offered
          edit/route.ts         # POST: save edited draft
          skip/route.ts         # POST: mark draft skipped
      hitl/
        checkpoint/route.ts     # POST: record HITL decision; unblocks Flow wait()
  components/
    ui/                         # shadcn/ui base components (Button, Card, Badge, etc.)
    draft-card/                 # Proposal draft review card (main HITL component)
      DraftCard.tsx             # Shows draft, confidence score, portfolio items, actions
      DraftEditor.tsx           # assistant-ui inline editor (opened on Edit action)
    job-card/                   # Job shortlist card with qualification badge
      JobCard.tsx
      QualificationBadge.tsx    # Green/Yellow/Red badge with score and flags
    pipeline-board/             # Kanban board by pipeline stage
      PipelineBoard.tsx
      PipelineColumn.tsx
    notifications/
      TelegramStatus.tsx        # Shows Telegram bot connection status
  lib/
    api.ts                      # Typed API client wrappers
    store.ts                    # Zustand store: review session state
    types.ts                    # Shared TypeScript types (Job, Draft, PipelineItem, etc.)
```

### Key Screens

**Screen 1: Today's Drafts (Dashboard — CP2 HITL surface)**
- Primary screen; opens on app launch
- Lists job cards (with qualification badges) for all Qualified jobs
- Below each qualified job: proposal draft card with voice confidence score, portfolio items used
- Per draft: Approve button (copies to clipboard + opens Upwork URL), Edit button (opens DraftEditor with assistant-ui), Skip button
- Progress indicator: N reviewed / M total
- Blocking: Approve button disabled until user has read the draft (scroll-to-bottom detection)

**Screen 2: Pipeline Board**
- Kanban columns by pipeline stage: Discovered, Qualified, Drafted, Submitted, Replied, Call Scheduled, Won, Lost, Archived
- Cards sortable by date and budget within column
- One-click status updates via drag-drop or dropdown

**Screen 3: Settings**
- Filter configuration: min_star_rating, min_hire_rate, min_avg_hourly_paid, priority_categories, exclude_categories
- Portfolio case studies: list of 6 canonical cases with add/edit links (file-based for MVP)
- Voice examples: upload/manage plain text or markdown examples
- Telegram: bot token status, test notification button

**[DEFERRED: V1] Screen 4: Active Chats (CP3 HITL surface)**

### assistant-ui Integration

assistant-ui is scoped exclusively to `DraftEditor.tsx` — the inline editor opened when a user clicks "Edit" on a proposal draft.

- **Mode**: Inline editor with streaming message support
- **Context**: Current draft text; job description; client signals; voice confidence score injected as system context
- **Actions**: User can request specific rewrites ("make the opening punchier", "reduce word count by 50"), or free-form editing
- **Output contract**: Every assistant-ui edit produces a new draft version stored in `drafts` table with `edit_source=assistant-ui`
- **HITL preserved**: Edited drafts still require explicit Approve action; assistant-ui does not bypass CP2

### Notification Integration (Telegram)

- Backend sends Telegram push on new hot match (job passing HARD_FILTERS)
- Message format: "New match: [Job Title] — Budget: [range] — Client score: [N/10] — [URL to review]"
- User opens app from Telegram link, lands on specific draft card
- Library: `python-telegram-bot` on backend; no frontend Telegram dependency

---

## 4. Backend Architecture Specification

### Service Architecture

The backend is a Python service (not a Next.js API route) responsible for all CrewAI orchestration. The Next.js frontend communicates with the Python backend via HTTP API (FastAPI or Flask). For MVP, both can run on the same Render.com service or as two separate Render services.

```
backend/
  main.py                   # FastAPI app entrypoint
  flow.py                   # SalesPipelineFlow (CrewAI Flow definition)
  crew.py                   # Crew definitions (JobScoutCrew, QualifierCrew, ProposalCrew)
  config/
    agents.yaml             # Agent definitions (CrewAI YAML format)
    tasks.yaml              # Task definitions with guardrails
  tools/
    chrome_extension_tool.py # Receive and validate Chrome Extension job payloads
    job_filter_tool.py      # Apply HARD_FILTERS and SOFT_SIGNALS
    upwork_profile_tool.py  # Fetch public Upwork client profile page
    client_scoring_tool.py  # Rules engine: scoring + flag generation
    portfolio_read_tool.py  # Read portfolio/*.md files
    voice_examples_tool.py  # Load voice examples from storage
    proposal_draft_tool.py  # Proposal generation wrapper
    pipeline_state_tool.py  # Read/write Postgres pipeline state via SQLAlchemy
  pipeline_tracker.py       # Postgres state service via SQLAlchemy (not a CrewAI agent)
  telegram_bot.py           # Telegram push notification service
  chrome_extension/
    manifest.json           # Chrome Extension manifest (Manifest V3)
    background.js           # Service worker: cron scan every 15–30 min
    content.js              # DOM reader: extracts job data from Upwork tabs
    popup.html/.js          # Extension popup for status/manual trigger
  portfolio/
    accounto.md             # Case study: Accounto (website)
    techstyle.md            # Case study: TechStyle (website)
    immopro.md              # Case study: Immopro (website)
    ernesto_vargas.md       # Case study: Ernesto Vargas (web app)
    warehance.md            # Case study: Warehance (web app)
    lari_digital.md         # Case study: Lari.Digital (web app)
  voice_examples/           # User-provided plain text or markdown examples (min 10)
  .env                      # Runtime secrets (never committed)
  .env.example              # Required variable names (committed)
```

### API Routes (FastAPI)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/crew/run` | Trigger SalesPipelineFlow run; returns `run_id` |
| GET | `/api/crew/status/{run_id}` | Poll run status: step name, progress, errors |
| GET | `/api/pipeline` | Fetch all pipeline items with current status |
| PATCH | `/api/pipeline/{job_id}` | Update pipeline item status |
| GET | `/api/drafts` | Fetch all draft proposals for current run |
| POST | `/api/drafts/{draft_id}/approve` | Approve draft; returns proposal text for clipboard |
| POST | `/api/drafts/{draft_id}/edit` | Save edited draft version |
| POST | `/api/drafts/{draft_id}/skip` | Skip draft; update status to Archived |
| POST | `/api/hitl/checkpoint` | Record HITL decision; unblock Flow wait() |
| GET | `/api/settings` | Fetch filter and notification config |
| PUT | `/api/settings` | Update config |
| GET | `/health` | Health check for Render.com |

### Database Schema (PostgreSQL)

**Table: jobs**
```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    budget_min REAL,
    budget_max REAL,
    posted_date TEXT,
    snippet TEXT,
    relevance_rank INTEGER,
    status TEXT DEFAULT 'Discovered',
    run_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Table: qualified_jobs**
```sql
CREATE TABLE qualified_jobs (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id),
    score REAL,
    payment_verified INTEGER,
    total_spend REAL,
    avg_rate REAL,
    hire_rate REAL,
    red_flags TEXT,          -- JSON array
    green_flags TEXT,        -- JSON array
    recommendation TEXT,     -- 'Pursue' | 'Skip' | 'Review'
    reasoning TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Table: drafts**
```sql
CREATE TABLE drafts (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id),
    content TEXT NOT NULL,
    voice_confidence_score REAL,
    portfolio_items_used TEXT,   -- JSON array
    edit_suggestions TEXT,       -- JSON array; populated when confidence < 0.80
    edit_source TEXT,            -- 'ai_generated' | 'assistant-ui' | 'manual'
    status TEXT DEFAULT 'Drafted',
    run_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Table: pipeline_state**
```sql
CREATE TABLE pipeline_state (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id),
    status TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
```

**Table: prompt_traces**
```sql
CREATE TABLE prompt_traces (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    agent_id TEXT,
    task_id TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    model TEXT,
    prompt_hash TEXT,           -- SHA256 of rendered prompt (not the prompt itself; PII-safe)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Table: chat_threads** — **[DEFERRED: V1]**

### Authentication and Security

**MVP scope**: Single-user, local deployment. No multi-user authentication required.
- API routes protected by `API_SECRET_KEY` env var (Bearer token in Authorization header)
- Frontend sets token from env var `NEXT_PUBLIC_API_SECRET` at build time
- All secrets in `.env`; `.env.example` defines required variable names
- No Upwork credentials stored anywhere in the system

**Required `.env.example` entries:**
```
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
API_SECRET_KEY=
DAILY_LLM_COST_CAP_USD=1.00
CREWAI_STORAGE_DIR=project-context/2.build/crew-state/
SQLITE_DB_PATH=backend/pipeline.db
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_SECRET=
```

**[DEFERRED: V1]** Multi-user auth: NextAuth.js with Supabase Auth or Auth0 OAuth2.

### Rate Limiting and Cost Cap

- `MAX_RPM=10` at crew level prevents runaway API spend
- `DAILY_LLM_COST_CAP_USD=1.00` enforced at Flow level: before each step, read today's cumulative cost from `prompt_traces`; if cost >= cap, halt Flow with user notification
- Exponential backoff on Anthropic API 429/500 errors: 2s, 4s, 8s (max 3 retries per task)

---

## 5. DevOps & Deployment Architecture

### Deployment Platform: Render.com (MVP)

**[DEFERRED: V1]** AWS ECS Fargate or Railway for multi-tenant SaaS.

| Component | Render Service Type | Spec | Est. Cost |
|-----------|--------------------|----|-----------|
| Python backend (FastAPI + CrewAI) | Web Service | 1 CPU, 512MB RAM | $7/month |
| Next.js frontend | Static Site or Web Service | — | $0–$7/month |
| PostgreSQL (managed) | Render.com PostgreSQL free tier | 256MB; 1GB storage | $0 (included) |
| Telegram bot | Integrated with backend service | — | $0 |
| **Total infra** | | | **$7–$14/month** |

### Environment Separation

**MVP**: Single environment (production) — founder-only usage, no staging needed.
**[DEFERRED: V1]** Staging + Production separation with environment-specific env vars and separate Render services.

### CI/CD Pipeline

**MVP**: GitHub Actions workflow triggered on push to `main` branch.

```yaml
# .github/workflows/deploy.yml (simplified)
on:
  push:
    branches: [main]
jobs:
  test:
    - Run backend unit tests (pytest)
    - Run frontend type check (tsc --noEmit)
    - Run frontend lint (eslint)
  deploy:
    needs: test
    - Trigger Render.com deploy hook (backend)
    - Trigger Render.com deploy hook (frontend)
```

**[DEFERRED: V1]** Blue-green deployment, automated rollback, E2E tests as deployment gate.

### Environment Variable Management

- All secrets stored in Render.com Environment Variables (dashboard-managed)
- `.env.example` committed to repo with placeholder values
- `.env` never committed; in `.gitignore`
- Chrome Extension: no secrets stored; reads from active browser session only

### Health Checks and Monitoring

- Backend: `GET /health` returns `{"status": "ok", "db": "connected", "run_active": bool}`
- Render.com health check configured to call `/health` every 30s; restart on 3 consecutive failures
- Prompt Trace logs: all LLM calls logged to `project-context/2.build/logs/prompt_traces_YYYYMMDD.jsonl`
- Agent lifecycle logs: task start/stop/retry events logged to `project-context/2.build/logs/agent_lifecycle_YYYYMMDD.jsonl`
- **[DEFERRED: V1]** Langfuse for LLM trace observability dashboard (visualizes per-call latency, token usage, cost; supports prompt A/B comparison and evaluation harness). Planned for Phase 3 Observability epic alongside QA submission. Datadog APM considered as V2 alternative for enterprise-grade distributed tracing.

---

## 6. Data Flow & Integration Architecture

### Primary Data Flow: Chrome Extension → Flow → HITL → Dashboard

```
[Chrome Extension]
  └── Service worker cron (every 15–30 min)
  └── Reads Upwork DOM (job listings in authenticated session)
  └── POST job data → Backend API /api/jobs/ingest
          │
[SalesPipelineFlow — Step 1: scan_jobs()]
  └── JobScoutCrew
      └── ChromeExtensionIngestionTool: receive validated job payloads via authenticated webhook
      └── JobFilterTool: apply HARD_FILTERS; rank by recency
      └── PipelineStateWriteTool: write to jobs table (status=Discovered)
          │
[SalesPipelineFlow — Step 2: qualify_jobs()]
  └── QualifierCrew
      └── UpworkProfileFetchTool: fetch public client profile
      └── ClientScoringTool: compute score + flags
      └── PipelineStateWriteTool: write to qualified_jobs table
      └── [CP1: if borderline score → Telegram push → user reviews in dashboard]
          │
[Flow.wait(cp2_approved_jobs)]  ← HITL gate CP2
  └── Frontend: user reviews shortlist cards, clicks Approve/Skip per job
  └── POST /api/hitl/checkpoint {approved_jobs: [ids]}
  └── Flow resumes with approved job ids only
          │
[SalesPipelineFlow — Step 3: write_proposals()]
  └── ProposalCrew
      └── PortfolioReadTool: load relevant portfolio/*.md
      └── VoiceExamplesTool: load voice examples
      └── ProposalDraftTool: generate 200–350 word draft via Opus 4.6
      └── PipelineStateWriteTool: write to drafts table (status=Drafted)
      └── Telegram push: "N proposals ready for review"
          │
[Flow.wait(cp2_final_reviewed)]  ← HITL gate CP2 final
  └── Frontend: user reviews each draft card
      └── Approve → copy to clipboard + open Upwork URL → user pastes manually
      └── Edit → DraftEditor (assistant-ui) → save revised draft → re-approve
      └── Skip → status=Archived
  └── POST /api/hitl/checkpoint {reviewed_drafts: [...]}
          │
[Post-HITL: user manually submits on Upwork]
  └── User clicks "Mark as Submitted" in pipeline board
  └── POST /api/pipeline/{job_id} {status: "Submitted"}
```

**Async generation pattern**: All Flow steps (scan → qualify → write) execute as background jobs immediately upon Chrome Extension ingestion. By the time the user opens the dashboard (triggered by Telegram push), drafts are pre-generated and ready for review at CP2. This honors the `daily review in <15 min` NFR despite Opus 4.6 latency — generation happens during the user's offline time, not during the review session.

### Fallback Flow: Manual URL Paste

When Chrome is not running, user pastes Upwork job URL in dashboard form → request relays to Chrome Extension via authenticated webhook → Extension opens URL in its own authenticated Upwork session → DOM is parsed in same session as automated scan path → result returns to backend with identical schema. Backend never performs direct HTTP fetch of upwork.com (would fail on auth-required pages and risks ToS scraping classification).

### Chrome Extension Architecture

```
chrome_extension/
  manifest.json     # Manifest V3; permissions: activeTab, alarms, storage
  background.js     # Service worker; chrome.alarms API for 15–30 min cron
                    # Reads job listings from active Upwork tab via chrome.tabs.sendMessage
                    # POSTs to backend API
  content.js        # Injected into upwork.com/jobs/search; reads DOM job cards
                    # Extracts: title, url, budget, posted_time, client_signals visible in listing
  popup.html/js     # Extension popup: shows last scan time, job count, manual trigger button
```

**Security boundaries:**
- Content script reads DOM only; no credentials, no cookies, no auth tokens accessed
- Backend API called with `API_SECRET_KEY` stored in `chrome.storage.local` (not hardcoded)
- Manifest V3 service worker; no background page persistence

### External Integrations

| Integration | Direction | Protocol | Auth | MVP / V1 |
|-------------|-----------|----------|------|----------|
| Upwork Public Profile Pages | Inbound | HTTP GET (HTML) | None (public pages) | MVP |
| Anthropic Claude API | Outbound | HTTPS REST | API Key | MVP |
| Telegram Bot API | Outbound | HTTPS REST | Bot Token | MVP |
| Chrome Extension → Backend | Inbound | HTTPS POST | API Secret Key | MVP |
| OpenAI/Voyage Embeddings | Outbound | HTTPS REST | API Key | [DEFERRED: V1] |
| Email/Slack webhooks | Outbound | HTTPS | OAuth/webhook | [DEFERRED: V1] |

### Prompt Trace Logging

Every LLM call records:
- `run_id`, `agent_id`, `task_id`
- `input_tokens`, `output_tokens`, `cost_usd`
- `model` (haiku-4-5 / sonnet-4-6 / opus-4-6)
- `prompt_hash` (SHA256 of rendered prompt — PII-safe; not the prompt itself)
- Actual prompt content stored to `project-context/2.build/logs/` with PII/API key redaction
- Prompt Trace coverage: 100% of proposal drafts (required per AAMAD Core rules)

---

## 7. Performance & Scalability Specifications

### MVP Performance Targets

| Operation | Target | Constraint |
|-----------|--------|-----------|
| Full pipeline run (Scout 30 + Qualify 15 + Write 5) | <10 minutes | max_execution_time guards per agent |
| Single proposal generation | <60 seconds | Opus 4.6 streaming; 300s hard cap |
| Dashboard initial load | <3 seconds | Server Component with Postgres read via connection pool |
| HITL checkpoint response | <1 second | Simple Postgres read/write via pooled connection |
| Chrome Extension scan cycle | 15–30 minutes | configurable; minimum 15 min enforced |
| Telegram notification latency | <5 seconds from hot match detection | Telegram API SLA |
| System uptime | ≥95% | Render.com SLA |

### Resource Optimization

**LLM Cost Controls:**
- Prompt caching enabled for all Anthropic API calls (reduces cost ~70% on repeated prompt prefixes)
- `DAILY_LLM_COST_CAP_USD=1.00` hard limit enforced at Flow level
- Per-agent max_iter controls prevent runaway token spend
- `max_rpm=10` at crew level prevents burst overspend
- Estimated monthly cost at daily usage: ~$23/month (Decision D3)

**Postgres Performance:**
- Connection pooling via SQLAlchemy (`pool_size=5`, `max_overflow=10`) handles concurrent Chrome Extension writes + frontend reads
- Indexed on `jobs.url` (deduplication), `jobs.status`, `pipeline_state.job_id`
- 30-day job deduplication window prevents unbounded table growth
- Render.com free tier limits (256MB RAM, 1GB storage) sufficient for MVP single-user volume

**MVP Scalability Boundary:**
This architecture is explicitly designed for single-user, single-machine use. It does not scale horizontally. The following are deferred to V1:
- **[DEFERRED: V1]** PostgreSQL with tenant isolation
- **[DEFERRED: V1]** Connection pooling (PgBouncer)
- **[DEFERRED: V1]** Read replicas for pipeline board queries
- **[DEFERRED: V2]** Microservice separation of Scout, Qualifier, Writer
- **[DEFERRED: V2]** Container orchestration (ECS, Kubernetes)

---

## 8. Security & Compliance Architecture

### Security Controls

| Control | Implementation | Scope |
|---------|---------------|-------|
| API key management | All secrets in `.env`; `.env.example` in repo; zero secrets hardcoded | All components |
| Transport security | HTTPS enforced for all external API calls; Render.com TLS by default | All |
| No credential storage | Upwork session cookies are user-managed; system never stores passwords or auth tokens | Chrome Extension, Backend |
| HITL enforcement | No code path for automated submission; clipboard-only external action | ProposalCrew, Flow |
| Prompt Trace PII protection | API keys and PII redacted before log write; only prompt_hash stored in DB | Logging |
| Chrome Extension isolation | Content script reads DOM only; no cookie/auth token access; Manifest V3 | Chrome Extension |
| Network egress allowlist | Backend agent tools (`ProposalDraftTool`, `JobFilterTool`, `ClientScoringTool`, etc.) are restricted by outbound HTTP allowlist to `api.anthropic.com` and local DB connection only. Tools physically cannot POST to `upwork.com` or any external service. Enforced at process level (urllib3/httpx restricted transport). HITL becomes architecturally impossible to bypass, not just policy-enforced. | Backend |
| Input validation | Chrome Extension payload validated against schema; proposal output validated by guardrail; API request bodies validated by Pydantic | Backend |
| Rate limiting | `max_rpm=10` crew-level; exponential backoff on 429 | CrewAI, API calls |
| Cost cap | `DAILY_LLM_COST_CAP_USD=1.00` enforced before each Flow step | Flow |

### Upwork ToS Compliance

| Concern | Mitigation |
|---------|-----------|
| Automated submission | Zero auto-submit code paths; clipboard-only; HITL mandatory |
| Credential storage | No Upwork credentials stored anywhere; Chrome Extension reads own session DOM only |
| Scraping prohibition | Chrome Extension reads own authenticated session (personal-use automation, read-only DOM access); no server-side scraping from non-user IPs |
| Chrome Extension scan rate | Default 15–30 min cron via Manifest V3 service worker alarm; minimum 15 min enforced; ≤4 scans/hour |
| Legal review | Formal Upwork ToS legal review required before V1 public launch |
| DOM breakage detection | Chrome Extension records parsed_job_count per scan to backend telemetry. If 7-day rolling average drops by >80% (likely Upwork DOM change broke selectors), Telegram alert "Selectors may be broken — investigate" is fired; ingestion pauses until manual confirm. |

### Data Retention

**MVP (single user):**
- Jobs and drafts retained indefinitely in Postgres (single user, low volume; fits free tier storage)
- Prompt Trace log files rotated daily; retained 30 days locally
- No user PII stored (system is personal tool; no other users)

**[DEFERRED: V1]** GDPR compliance: user data deletion endpoint; data retention policies; EU legal review before market expansion.

### Compliance Deferrals

- **[DEFERRED: V1]** GDPR deletion endpoint; user consent management
- **[DEFERRED: V1]** AES-256 encryption at rest for Postgres (Render.com offers paid tier with at-rest encryption)
- **[DEFERRED: V2]** SOC2 Type 1 compliance preparation
- **[DEFERRED: V2]** Penetration testing and vulnerability assessment program

---

## 9. Testing & Quality Assurance Specifications

### Testing Strategy

**Unit Tests (pytest — backend):**
- `JobFilterTool`: test HARD_FILTERS application with fixture Chrome Extension payloads (pass/fail cases for each filter)
- `ClientScoringTool`: test scoring logic with fixture client profiles; verify score range 1–10; verify flag generation
- `pipeline_tracker.py`: test all state transitions; test deduplication logic
- `ProposalDraftTool` guardrail: test word count validation (180–380); test confidence score range
- Cost cap enforcement: mock `prompt_traces` table to simulate cap breach; verify Flow halts correctly
- Coverage target: ≥80% line coverage for all tool modules

**Integration Tests:**
- Flow integration: stub external API calls; verify task chaining via Task.context; verify HITL wait() blocks correctly
- Chrome Extension → Backend: test ingest endpoint with fixture DOM payload
- Telegram notification: mock Telegram API; verify notification sent on hot match

**End-to-End Tests (MVP — manual):**
- 5+ real proposals generated from live Chrome Extension ingestion on builder's own Upwork account
- Proposal-to-interview conversion tracked in `project-context/2.build/logs/`
- QA criteria: ≥80% qualification agreement rate; ≥60% proposal approval rate without major structural edit

**[DEFERRED: V1]** Playwright E2E tests for dashboard flows; load testing; security scanning.

### Quality Gates (CrewAI Adapter Requirements)

| Gate | Implementation |
|------|---------------|
| Required template headings | Task self-check before final write; Diagnostic + halt on missing headings |
| Proposal output schema | `Task.guardrail` on draft_proposals: word count, confidence score range, portfolio items count |
| Qualification output schema | `Task.guardrail` on qualify_jobs: score range, recommendation enum, reasoning length |
| Chrome Extension payload schema validation | Schema check on Chrome Extension ingestion output before passing to JobFilterTool |
| Machine-ingested output sections | Plain JSON (no code fences) in crew-state/ artifacts |
| High-risk output review | `human_input=True` (via Flow.wait()) for all proposal drafts — CP2 is mandatory |
| Prompt Trace coverage | 100% of proposal drafts; verified in QA checklist |
| Task.id traceability | All tasks have explicit Task.id; referenced in Prompt Trace and Diagnostic logs |

### Acceptance Criteria (MVP Launch)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| MVP validation milestone | ≥3 interviews from AI-assisted proposals | Week 8 |
| Qualification agreement rate | >80% | User agrees with AI recommendation |
| Proposal acceptance rate | >60% | User approves without major structural edit |
| Daily review time | <15 minutes | Timer in review session |
| System uptime | ≥95% | Render.com uptime monitor |
| Zero ToS violations | 0 automated submissions | Code audit + manual review |

---

## 10. MVP Launch & Feedback Strategy

### Phase 0: Founder Dog-Food (Weeks 1–8)

The builder is the first user. The MVP is validated on Aigam's own Top Rated Plus Upwork account ($300k+ earned, JSS 90%+).

**Baseline measurement (pre-MVP, from Q4 2023 real data):**
- 198 proposals sent (with 3 bid managers)
- 10 conversations (5.1% response rate)
- 0 contracts (0% close rate from chat)
- Root cause analysis: low match quality → low response rate; no chat engagement support → 0% close rate

**Success threshold**: ≥3 interviews booked from AI-assisted proposals within 30 days of MVP completion.

**Daily logging**: Jobs surfaced, proposals sent, interviews booked — all logged to `project-context/2.build/logs/founder_metrics_YYYYMMDD.jsonl`.

### Beta Testing Plan

**Closed Beta (Month 2–3):**
- Target: 5–10 Top Rated Upwork freelancers; non-UX verticals preferred (developers, copywriters) for ICP diversity
- Recruitment: Upwork Community, LinkedIn, Freelance Bold Slack
- Incentive: Free access for 3 months in exchange for weekly 30-min feedback sessions
- Success threshold: ≥70% weekly active rate; NPS ≥40; ≥80% retention through Month 3

**Feature Flag Strategy (MVP):**
- No feature flags in MVP (single-user; no need for gradual rollout)
- **[DEFERRED: V1]** Feature flags for Portfolio Matcher and Chat Engagement rollout to beta users

### User Onboarding Flow

1. `aamad-sales onboard` CLI command triggers guided setup
2. System prompts for minimum 10 example proposals (plain text or markdown)
3. Style report generated: average word count, tone descriptors, sentence structure
4. If <10 examples: proposal generation blocked with warning
5. Portfolio case studies: 6 canonical cases pre-loaded; user reviews/edits via Settings
6. Telegram bot: guided BotFather setup; test notification sent
7. Chrome Extension: install from local build; configure backend URL in popup

### Business Metrics and KPIs

| Metric | Founder MVP (Wk 1–8) | Beta (Month 3) | Revenue Launch (Month 6) |
|--------|----------------------|----------------|--------------------------|
| Active users | 1 | 5–10 | 10–25 |
| MRR | $0 | $0 (free beta) | $990–$2,500 |
| Qualified opportunities/week | Target: 5–15 | — | — |
| Proposal-to-interview lift vs. baseline | Target: ≥+20% | — | — |
| Daily review time | <15 min | — | — |

**North-Star Metric**: Qualified opportunities surfaced per week per user — primary measure of system value delivery.

### GTM Channels (Priority Order)

1. Founder content (LinkedIn/X): share dog-food results publicly (jobs surfaced, proposals sent, interviews booked, revenue won). Authentic first-user story. Weeks 1–8 concurrent with build.
2. Upwork Community: Top Rated / Top Rated Plus threads; "built by a Top Rated+ freelancer" positioning. Month 2+.
3. Freelance newsletters: Freelance Bold, The Freelancer's Year, Lenny's Newsletter adjacent. Month 3+.
4. ProductHunt launch: full launch with demo video, $99/month pricing, waitlist. Month 4.
5. Referral program: 1 free month per successful referral. Month 4+.

**Pricing**:

| Tier | Price | Includes |
|------|-------|----------|
| Beta | $0 | Full access; feedback required |
| Starter | $99/month | 3 agents (Scout + Qualifier + Writer), 20 jobs/day cap |
| Pro | $149/month | Full 5-agent crew (Scout + Qualifier + Writer + Portfolio Matcher + Chat Engagement), unlimited jobs |
| Agency | $299/month | 3 seats, shared pipeline view |

---

## Considered Alternatives

### Alt-1: Flow + Crew(s) vs. Pure Crew (Decision D1)

**Alternative considered**: One Crew, six agents, hierarchical delegation (CrewAI Process.HIERARCHICAL).

**Why rejected**:
- HITL checkpoints inside a Pure Crew require workarounds (agent self-interruption, custom callbacks) — CrewAI Flow provides native `wait()` states that make HITL first-class
- Cost cap enforcement is non-deterministic inside a Crew (agent routing is emergent); Flow steps are explicit checkpoints where cost can be read and enforced before each step
- Pure Crew output is harder to reproduce deterministically (emergent manager routing varies between runs) — critical for debugging on a real Upwork profile with real consequences

**Decision**: Flow + Crew(s) chosen. Flow orchestrates pipeline with explicit steps and gates; local single-agent Crews for each step in MVP; V1 will add mini-Crew (Writer + Matcher) as a nested Crew within the Flow.

### Alt-2: Hybrid shadcn/assistant-ui vs. Pure assistant-ui (Decision D10)

**Alternative considered**: Pure assistant-ui (Claude.ai-style conversational interface for all screens).

**Why rejected**:
- Primary UX pattern is structured card review (Approve / Edit / Skip per job) — not a conversational flow
- A chat-primary interface imposes conversational overhead on a task that is fundamentally card-based review with discrete binary decisions
- Real user journey (from Decision D5) is: open app, see draft, read 30 seconds, Approve/Edit/Skip — this is a dashboard pattern, not a chat pattern

**Decision**: Hybrid chosen. shadcn/ui handles the dashboard (Today's Drafts, Pipeline Board, Settings). assistant-ui is scoped to two conversational surfaces: (1) inline draft editing (DraftEditor.tsx) where AI-assisted rewriting is conversational, and (2) Voice Onboarding chat (one-time, ~30-min flow) where the system elicits 10+ style examples through structured conversation. Implementation depth of (2) is finalized in Phase 2 Frontend.

### Alt-3: Chrome Extension vs. Server-Side Scraping (Decision D6)

**Alternative considered**: Server-side HTTP scraping (requests/BeautifulSoup on a backend cron job).

**Why rejected**:
- Upwork robots.txt and ToS prohibit unauthorized automated scraping from non-user sessions
- Server-side scraping from a different IP/session is unambiguously prohibited and creates ToS violation risk on a production Upwork account
- Upwork has no public API for job browsing or proposal submission

**Decision**: Chrome Extension chosen. Reads DOM in Aigam's own logged-in browser session. No credentials stored in backend. Read-only DOM access. Arguable personal-use automation (user reading their own session data). See MVP limitation note above regarding Chrome-must-be-open constraint.

### Alt-4: Anthropic API Direct vs. OpenRouter (Decision D9)

**Alternative considered**: OpenRouter as a multi-provider LLM gateway.

**Why rejected**:
- OpenRouter adds ~5% cost margin on all LLM calls; at $23/month estimated cost, this adds ~$1.15/month with no added value for this use case
- Adds an extra authentication layer and dependency; creates a single point of failure between the application and Anthropic
- All agents use Claude 4.x models exclusively; no multi-provider routing is needed
- Anthropic's native Python SDK provides streaming, prompt caching, and tool use natively; no feature parity gap

**Decision**: Anthropic API direct chosen. Simpler billing, no intermediary margin, native SDK features (prompt caching, streaming, tool use), existing Claude Pro context from AAMAD academy.

---

## Sources

1. `project-context/1.define/prd.md` — Product Requirements Document, @product-mgr, 2026-05-04
2. `project-context/1.define/mr.md` — Market Research Document, @product-mgr, 2026-05-04
3. Pre-SAD Decision Log (КОНСПЕКТ_Week2.md) — Decisions D1–D11, resolved 2026-05-15
4. CrewAI Framework Documentation — https://github.com/joaomdmoura/crewAI
5. Anthropic Claude API Documentation — https://www.anthropic.com/api
6. CrewAI Flow Documentation — CrewAI Flow `wait()` state pattern for HITL
7. Upwork Terms of Service — https://www.upwork.com/legal (ToS compliance analysis)
8. Chrome Extension Manifest V3 Documentation — https://developer.chrome.com/docs/extensions/mv3/
9. python-telegram-bot library — https://python-telegram-bot.org
10. Next.js 14 App Router Documentation — https://nextjs.org/docs/app
11. shadcn/ui Documentation — https://ui.shadcn.com
12. assistant-ui Documentation — https://www.assistant-ui.com
13. Render.com Documentation — https://render.com/docs

---

## Assumptions

1. `AAMAD_TARGET_RUNTIME=crewai` is confirmed for all Phase 2 Build epics.
2. CrewAI Flow's `wait()` state pattern is sufficient to implement HITL checkpoints without custom CrewAI patches. If Flow wait() is unavailable in the installed CrewAI version, a webhook-based pause mechanism will be implemented as a substitute.
3. Claude Opus 4.6 is available via Anthropic API at the time of build. If unavailable, Claude Sonnet 4.6 is the fallback for the Proposal Writer, with a corresponding reduction in expected draft quality.
4. Chrome Extension Manifest V3 service worker alarm API supports 15-minute minimum intervals (Chrome's minimum alarm interval is 1 minute in MV3; 15-minute cron is within spec).
5. Upwork job-feed DOM structure remains stable enough for selector-based extraction during the MVP build period; a Chrome Extension self-test suite against a reference page detects breakage early.
6. The 6 canonical portfolio cases (Accounto, TechStyle, Immopro, Ernesto Vargas, Warehance, Lari.Digital) are available as completed .md files before Proposal Writer agent development begins.
7. Telegram Bot API is accessible from Render.com without IP allowlisting or rate restrictions for single-user notification volume.
8. Postgres on Render.com free tier (256MB RAM, 1GB storage) is sufficient for MVP single-user concurrency (Chrome Extension writes + frontend reads). Upgrade to paid tier or migration to dedicated Postgres is deferred to V1 (multi-tenant readiness).
9. Next.js frontend and Python FastAPI backend can run as separate Render.com services with CORS configured between them.
10. Voice onboarding (minimum 10 examples) will be completed by the builder before the first live pipeline run.

---

## Open Questions

The following items are genuinely unresolved and not covered by Decision Log decisions D1–D11.

1. **Chrome Extension distribution**: Will the Chrome Extension be loaded as an unpacked extension (developer mode, localhost-only) for MVP, or published to Chrome Web Store? Chrome Web Store review may add 1–3 weeks to the build timeline and requires privacy policy compliance.

2. **Portfolio .md file format**: What is the required schema for portfolio case studies in `portfolio/*.md`? The Proposal Writer agent needs structured fields (client name, industry, problem, solution, outcomes, visual style tags) to perform even keyword-based matching. This schema must be defined before Writer agent development begins.

3. **Voice confidence score calibration**: How will the `voice_confidence_score` threshold of 0.75 (approval gate) and 0.60 (hard warning) be calibrated? External QR (Gemini Flash, 2026-05-15) flagged LLM self-evaluation as unreliable (model tends to overestimate own output). Proposed hybrid approach to validate during Phase 2 Backend build: (a) **rule-based phrase overlap** — count of N-gram matches between draft and voice examples; (b) **independent critic model** — cheap Haiku call evaluates draft-vs-voice-examples without seeing the original generation context; final score = weighted average. The same model that wrote the draft does NOT self-score.

4. **HITL CP1 threshold configuration**: Decision D5 states CP1 fires for qualification scores 0.4–0.6. Is this threshold user-configurable in Settings, or hardcoded? If configurable, what is the valid range and default?

5. **Chrome Extension DOM selector versioning strategy**: Upwork is likely to modify its job-feed DOM structure over time, which will break the Chrome Extension's content script selectors. What versioning and test-suite strategy will detect selector breakage early? Should the extension include a self-test that runs a known reference page and reports schema mismatch to the backend?

6. **assistant-ui version compatibility**: Which version of assistant-ui supports the inline editor pattern (non-full-screen, embedded in a card component) without requiring a full-page chat layout? This determines the DraftEditor.tsx implementation approach.

> **Status note (2026-05-26)**: Open Question #6 above and four items derived from the Frontend Acceptance Review (2026-05-26) have been resolved in the v1.4 Addendum below. SAD-original Open Questions #1, #2, #4, #5 remain unresolved and are non-blocking for Week 3 Backend.

---

## v1.4 Addendum — Backend Pre-flight Decisions (2026-05-26)

**Context**: Pre-Build Phase 2 (Week 3 Backend) pre-flight resolved four open architectural questions arising from the Frontend Acceptance Review (`~/Downloads/Become an Agentic Architect/Frontend_Acceptance_Review_2026-05-26.md`). These resolutions are binding on the Backend epic and supersede any conflicting interpretations in the SAD v1.3 body.

### A1. CP1 Signal Mechanism — RESOLVED (Option B)

**Question reference**: Frontend Spec Open Q #1; SAD §6 (Data Flow CP1 Gate).

**Resolution**: Extend `RunStatus` shape with two new fields. Pipeline lifecycle status and HITL signal are orthogonal axes — keep them in separate fields, do not overload the `status` enum.

Updated `RunStatus` contract (v1.4):

```typescript
interface RunStatus {
  run_id: string;
  status: "scanning" | "qualifying" | "writing" | "awaiting_cp2" | "done" | "error";
  current_step: string;
  progress_pct: number;
  error_message?: string;
  // NEW v1.4:
  cp1_fired: boolean;
  borderline_jobs: BorderlineJob[];  // empty array when cp1_fired === false
}

interface BorderlineJob {
  id: string;
  title: string;
  budget_min: number | null;
  budget_max: number | null;
  client_score: number;
  reasoning: string;
  red_flags: string[];
  green_flags: string[];
}
```

**Rationale**: Clean separation — `status` answers "where is the pipeline?", `cp1_fired` answers "is there a HITL gate active?". Two orthogonal axes. Scales to multiple concurrent HITL gates in V1 (CP3 Chat Engagement).

**Backend implementation note**: Client Qualifier agent writes borderline jobs to a transient buffer (e.g., `pipeline_state.notes` JSONB field). When CrewAI Flow hits `wait()` for CP1, `GET /api/crew/status/{run_id}` serializes the buffer into the response.

**Frontend impact (Integration epic)**: `dashboard/page.tsx` SWR polling effect needs a new branch — when `runStatus.cp1_fired === true && fsmState !== "cp1_pending"`, dispatch `CP1_FIRED` and pass `runStatus.borderline_jobs` to `Cp1Gate` (currently passed as `[]` stub on `dashboard/page.tsx:340`).

### A2. `reviewed_at` Timestamp Storage — RESOLVED (Option B)

**Question reference**: Frontend Spec Open Q #2; SAD §4 (Database Schema).

**Resolution**: Single source of truth in `pipeline_state.notes` JSONB. No column added to `drafts` table.

**Rationale**: Avoid duplicating timestamp sources of truth. Single source preserves the full HITL history (multiple events per draft if user changes their mind), which is required for V1 RLHF replay per Frontend Spec §5.4.

**Backend implementation note**: each `POST /api/hitl/checkpoint` writes a row to `pipeline_state` with `notes` JSONB containing the payload + ISO timestamp. To derive `reviewed_at` for a specific draft:

```sql
SELECT (notes->>'timestamp')::timestamptz AS reviewed_at
FROM pipeline_state
WHERE notes->>'draft_id' = $1
  AND notes->>'checkpoint' = 'cp2'
ORDER BY created_at DESC
LIMIT 1;
```

**Frontend impact**: None. Frontend does not read `reviewed_at` directly.

### A3. HITL Checkpoint Contract — REAFFIRMED

**Question reference**: Frontend Spec Open Q #5; Frontend Spec §5.2.

**Resolution**: Backend MUST implement `POST /api/hitl/checkpoint` accepting exactly this payload shape:

```typescript
// HITL Checkpoint Request — v1.4 binding contract
{
  checkpoint: "cp1" | "cp2" | "cp2_final",
  run_id: string,
  draft_id?: string,        // present for per-draft CP2 events only
  action: "approve" | "skip" | "complete" | "include" | "exclude",
  timestamp: string         // ISO 8601
}
```

Response shape (success):
```typescript
{ success: true, checkpoint: string, recorded_at: string }
```

**Rationale**: Frontend already POSTs this payload from three call sites (`Cp1Gate.tsx`, `DraftCard.tsx` for approve and skip, `dashboard/page.tsx` for cp2_final). Any backend deviation = silent frontend telemetry loss.

**Backend implementation note**: endpoint writes row to `pipeline_state` (action, run_id, draft_id, payload=notes JSONB) AND releases the corresponding CrewAI Flow `wait()` state matching `(run_id, checkpoint)` tuple.

### A4. assistant-ui Removal — RESOLVED (Option B); Decision D10 Modified

**Question reference**: Frontend Spec Open Q #6; SAD §3 (Frontend Architecture); Decision D10 (Hybrid shadcn + assistant-ui).

**Resolution**: Remove `@assistant-ui/react` dependency entirely. Replace with single-shot Rewrite UX: editable Textarea + "Rewrite with AI" button → modal with rewrite instruction → backend `POST /api/draft-assist` returns one new draft per request.

**Decision D10 Modification (v1.4 supersedes v1.3 D10)**: shadcn/ui used for the full dashboard including `DraftEditor.tsx`. `@assistant-ui/react` removed entirely from MVP. Conversational chat UX deferred to V1.

**Rationale**: Conversational chat editor conflicts with Decision D5 (sub-30-second review path per draft). Proposal editing is transactional ("I know what one thing I want changed"), not exploratory. Single-shot rewrite preserves the fast review flow. Removes ~12 MB unused dependency from frontend bundle.

**Backend implementation note**: new endpoint `POST /api/draft-assist`:

```typescript
// Request
{
  draft_id: string,
  current_content: string,
  rewrite_instruction: string,
  context: {
    job_title: string,
    voice_examples_summary: string,
    portfolio_items_used: string[]
  }
}

// Response
{
  success: true,
  rewritten_content: string,
  generation_metadata: { model: string, tokens_in: number, tokens_out: number }
}
```

Model selection: Sonnet 4.5 for `/api/draft-assist` (balance of quality and cost). Opus reserved for the primary Proposal Writer agent only, per cost discipline.

**Frontend impact (Integration epic)**:
- `package.json`: remove `@assistant-ui/react` dependency
- `DraftEditor.tsx`: replace Textarea-only fallback with Textarea + "Rewrite with AI" button + modal
- `lib/api.ts`: add `rewriteDraft()` function calling `/api/draft-assist`
- `components/draft-rewrite-modal/RewriteModal.tsx`: new component

These frontend changes are deferred to Integration epic (Week 4); current MVP frontend Textarea fallback remains functional in the interim.

---

**Addendum Audit**:

| Field | Value |
|-------|-------|
| Timestamp | 2026-05-26 |
| Resolution session | Cowork (Aigam + Claude) |
| Trigger artifact | `~/Downloads/Become an Agentic Architect/Frontend_Acceptance_Review_2026-05-26.md` — §3 (Risks for Backend Integration) |
| Items resolved | 4 (A1 CP1 signal, A2 reviewed_at, A3 HITL contract, A4 assistant-ui) |
| Items remaining unresolved | SAD-original O.Q. #1, #2, #4, #5 — non-blocking for Week 3 Backend |
| Modifications to Decisions | D10 (Hybrid shadcn + assistant-ui) → `@assistant-ui/react` removed from MVP; shadcn/ui covers full dashboard |
| Binding on | Week 3 Backend epic, Week 4 Integration epic |
| LLM consulted | claude-opus-4-7 (Cowork session reasoning + recommendations) |

---

## Audit

| Field | Value |
|-------|-------|
| Timestamp | 2026-05-15 |
| Persona ID | @system.arch |
| Action | `*create-sad --mvp` |
| LLM | claude-sonnet-4-6 |
| AAMAD_TARGET_RUNTIME | crewai (resolved from env; default per adapter-registry.md) |
| Template Used | .cursor/templates/sad-template.md |
| PRD Reference | project-context/1.define/prd.md |
| MRD Reference | project-context/1.define/mr.md |
| Pre-SAD Decision Log | КОНСПЕКТ_Week2.md (Decisions D1–D11; all resolved) |
| Decisions Applied | D1 (Flow + Crew), D2 (Agent Roster), D3 (LLM per agent), D4 (Hard filters), D5 (User journey), D6 (Chrome Extension ingestion), D7 (storage — originally SQLite per Pre-SAD Decision Log; upgraded to Postgres per External QR v2 — see Post-QR-v2 Propagation Cleanup row below), D8 (Telegram), D9 (Anthropic direct), D10 (Next.js + shadcn/ui + assistant-ui), D11 (Cost cap) |
| MVP Deferrals Documented | Portfolio Matcher (V1), Chat Engagement (V1), Embeddings (V1), PostgreSQL (V1), Email/Slack (V1), Mobile (V1), SOC2 (V2), MCP (V2), Contra/LinkedIn (V2) |
| Considered Alternatives | 4 (Alt-1 through Alt-4) |
| Assumptions Recorded | 10 |
| Open Questions | 6 (all genuinely unresolved; no Decision Log items reopened) |
| Prompt Trace | Omitted — this is an IDE-time architecture document, not a production LLM output artifact; no external actions taken |
| Output Artifact | project-context/1.define/sad.md |
| Post-Review Cleanup | 2026-05-15: RSS references replaced with Chrome Extension consistently (per Decision D6); Utkan stakeholder removed (not part of MVP scope); Pricing tier corrected (6→5 agents in V1 vision); Open Question #5 and Assumption #5 reframed around Chrome Extension DOM selector strategy. Decision D2 noted as applied with *--mvp* phasing modification: 3 agents in MVP P0 (Scout, Qualifier, Writer) + 2 deferred to V1 (Portfolio Matcher, Chat Engagement) — confirmed by builder. |
| Extended Cleanup Pass | 2026-05-15: applied via Cowork session (not system-arch subagent) due to scope: 9 additional RSS-residual references replaced with Chrome Extension equivalents across Sections 4 (backend file structure, data flow), 6 (External Integrations table), 8 (Security & ToS Compliance), and 9 (Testing & Quality Gates). All edits are pure consistency replacements with no architectural changes. Verified with grep — final RSS count in SAD: 0. |
| External Quality Review Enhancement | 2026-05-15: external Quality Review attempt (QR_SAD.docx) returned an alternative architecture proposal rather than a critique of this SAD; classified as misunderstanding of task. However, 2 legitimate observations adopted as SAD enhancements: (1) Langfuse mention in Section 5 strengthened with explicit Phase 3 alignment and capability scope; (2) Core vs. Future Features table extended with "Observability" and "Learning loop" rows — V1 roadmap now explicitly includes RLHF feedback loop from approve/edit/skip telemetry and Langfuse evaluation harness. Reviewer's suggestion to introduce confidence-based auto-approve rejected — contradicts core Architectural Invariant (HITL with zero auto-submit per Decision D6 platform safety). |
| External Quality Review v2 (Gemini Flash) | 2026-05-15: second external QR with targeted critique prompt returned 9 substantive observations. Adopted: (1) Chrome Extension jitter + human-like behavior + CAPTCHA halt; (2) posted_within_hours clarified as soft ranking signal not hard filter; (3) assistant-ui scope extended to Voice Onboarding conversational surface; (4) **PostgreSQL chosen over SQLite for prod state** — addresses `database is locked` risk on Render.com Volumes; (5) async background generation flow added to Section 6 — resolves Opus latency vs <15-min NFR tension; (6) Manual URL paste rerouted through Chrome Extension authenticated session — backend no longer attempts direct upwork.com HTTP fetch; (7) Network egress allowlist added to Section 8 — agent tools physically cannot POST to upwork.com (HITL becomes architectural impossibility, not policy); (8) DOM breakage Telegram alert mechanism added; (9) Voice confidence Open Question reframed — LLM self-evaluation rejected, hybrid rule-based + critic-model approach proposed. Refined: assistant-ui extension scope adopted as concept; implementation depth deferred to Phase 2 Frontend. Rejected: none. |
| Post-QR-v2 Propagation Cleanup | 2026-05-15: applied via Cowork session. The QR-v2 subagent edit pass changed the deployment table and rationale to Postgres, but did not propagate the choice through the rest of the document (downstream SQLite references in Sections 2 Agent definitions, 4 Backend file structure + DB schema header, 7 NFR Performance table + SQLite-specific WAL/index notes, 8 Data Retention + Compliance Deferrals, and Assumption #8 remained as SQLite). This cleanup pass replaced 15 SQLite references with Postgres equivalents, reframed the Postgres Performance notes around SQLAlchemy connection pooling (pool_size=5, max_overflow=10) and Render.com free-tier limits (256MB RAM, 1GB storage), and rewrote Assumption #8 from SQLite-WAL-sufficiency to Postgres-free-tier-sufficiency. Decision D7 marker in this Audit table also updated to reflect SQLite → Postgres trajectory. Verified with grep — production SQLite mentions: 0. |
| ISO/IEC/IEEE 42010 Alignment | Stakeholders and concerns, viewpoints, rationale, and correspondence rules documented across logical, process/runtime, deployment, and data views |
