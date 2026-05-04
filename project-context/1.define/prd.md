# Product Requirements Document (PRD)
## AI Sales Team for Solo Freelancers

**System Concept**: Multi-agent CrewAI application automating client acquisition for high-earning independent freelancers
**Runtime**: `crewai`
**Phase**: 1 — Define
**Date**: 2026-05-04
**Author Persona**: @product-mgr (AAMAD Phase 1)
**Source MRD**: project-context/1.define/mr.md

---

## 1. Executive Summary

### Problem Statement (Research-Backed)

High-earning independent freelancers ($60–$150/hr) on Upwork spend 10–15 hours per week on non-billable client acquisition: scanning job feeds, qualifying clients, writing custom proposals, tracking follow-ups, and managing pipeline state. At an opportunity cost of $60–$150/hr, this represents $600–$2,250/week in forfeited billable capacity per freelancer. Approximately 3.7 million skilled US freelancers earning $75+/hr (MBO Partners 2023) lack a purpose-built, platform-safe automation tool. Upwork's Opportunity Manager provides only basic keyword filters with no AI-assisted proposal generation or enriched client qualification. Generic AI writing tools (Jasper, Copy.ai) offer no Upwork-specific workflow intelligence, no client enrichment, and no portfolio matching. The gap is real, unaddressed, and monetizable.

### Solution Overview (Evidence-Based)

**AI Sales Team for Solo Freelancers** is a 6-agent CrewAI crew automating the full client acquisition pipeline while enforcing mandatory Human-in-the-Loop (HITL) review before any external action. The crew: Job Scout (discovery), Client Qualifier (enrichment), Proposal Writer (drafting), Portfolio Matcher (relevance), Pipeline Tracker (state), Follow-up Agent (nurture). The MVP focuses on the three highest-leverage agents: Scout, Qualifier, Writer.

Key differentiators vs. all alternatives:
- **Platform safety**: zero automated submission; HITL is architecturally enforced, not policy-only
- **Voice preservation**: proposals generated in the user's own writing style via few-shot prompting
- **Portfolio intelligence**: semantic matching of personal case studies to job requirements
- **Explainable qualification**: transparent client signal scoring, not black-box pass/fail

### Strategic Rationale

Multi-agent architecture is optimal because freelance client acquisition has five distinct, sequential stages (discovery → qualification → drafting → follow-up → tracking), each requiring specialized capabilities and different tool access. A monolithic AI approach cannot specialize per stage or scale them independently. CrewAI's sequential task orchestration with explicit `Task.context` chaining maps naturally to this workflow. Market timing is favorable: LLM quality crossed the "sufficient for proposals" threshold in 2024, Upwork RSS feeds provide a legal data source with no API dependency, and no incumbent has built a purpose-built, HITL-compliant, voice-matching tool for this segment.

**Business case**: At $149/month and 70% gross margin, 1,000 users → $1.8M ARR. TAM is $2.1B; SOM at 0.5% penetration of the 3.7M premium freelancer segment → $220M ARR potential.

---

## 2. Market Context & User Analysis

### Target Market (From MRD Research)

**Primary Persona — "The Scaling Designer"**

| Attribute | Detail |
|-----------|--------|
| Role | Senior UX/UI designer, Top Rated Plus on Upwork |
| Earnings | $80k–$300k+/year; $75–$150/hr rate |
| Platform status | Top Rated Plus, Job Success Score 90%+, $50k+ lifetime earned |
| Core pain | 10–15 hrs/week on BD; wants to delegate execution and reclaim front-of-funnel time |
| Goals | More qualified leads/week, less non-billable overhead, better proposal-to-call conversion |
| Tech profile | Comfortable with CLI, APIs, Notion; not a developer; trusts AI tools that give control |
| Willingness to pay | $99–$199/month (vs. $1,200–$2,400/month VA alternative) |
| Representative quote | "I win 40% of the jobs I apply to. The bottleneck is I only apply to 3–4/week because writing proposals is exhausting." |

**Secondary Persona — "The Overloaded Developer"**

| Attribute | Detail |
|-----------|--------|
| Role | Senior full-stack or frontend developer, Top Rated Upwork |
| Earnings | $120k–$350k+/year; $100–$200/hr |
| Core pain | BD work competes directly with delivery time; loses deal flow momentum between project endings |
| Goals | Automated pipeline that keeps opportunities warm without stealing coding time |
| Willingness to pay | $149–$249/month |

**Anti-ICP — Do Not Target**
- Beginner freelancers (<$25/hr): needs skill/pricing development first, not throughput automation
- Freelance agencies with dedicated BD staff: already have human resources for this workflow
- Platform-adjacent workers using platforms with native API access (not applicable to Upwork)

**Market Segment Size**
- US total addressable: ~3.7M skilled freelancers at $75+/hr (MBO Partners 2023)
- Upwork beachhead (estimated active Top Rated+): ~500k–800k users
- SOM Year 1 target: 500–2,000 users (0.06–0.25% of beachhead)

### User Needs Analysis

| Pain Point | Severity | Current Workaround | Gap This Product Fills |
|------------|----------|--------------------|------------------------|
| Scanning 50+ daily job posts | High | Manual review, 1–2 hrs/day | Automated RSS filter shortlist |
| Qualifying client payment/history | High | Manual Upwork profile check, 5–10 min/job | Automated enrichment + explainable score |
| Writing custom cover letters | Very High | Manual writing, 30–60 min/letter | AI draft in user's voice, 5-min review |
| Selecting relevant portfolio items | High | Manual judgment, often skipped | Semantic matching from case study library |
| Tracking proposal pipeline status | Medium | Spreadsheet or memory | Persistent pipeline state with status board |
| Following up on stalled threads | Medium | Manual memory + Upwork inbox | Automated follow-up drafts surfaced for review |

### Competitive Landscape

| Competitor | Category | Strengths | Gaps vs. This Product |
|------------|----------|-----------|----------------------|
| Upwork Opportunity Manager | Native platform | Deep integration, free | No AI, no proposal writing, no enrichment |
| Jasper / Copy.ai | Generic AI writing | Fast drafting, affordable | No job context, no client signals, no portfolio |
| Human VA (Upwork) | Human labor | Judgment, relationship | 10–20× more expensive; inconsistent quality |
| Autobound / Lavender | B2B sales AI | Strong LinkedIn outreach | No Upwork/freelance specialization |
| Bonsai / HoneyBook | Freelance ops CRM | Invoicing + light CRM | No prospecting, no proposal generation |
| Custom GPT/AutoGPT DIY | Self-built | Fully flexible | No Upwork guardrails; high setup friction |

**Pricing benchmarks**: AI sales tools: $29–$149/month (Lavender, Apollo.io). Human VA: $1,200–$2,400/month. Proposed: $99–$199/month — below VA, above commodity AI writers, justified by specificity and quality.

---

## 3. Technical Requirements & Architecture

### CrewAI Framework Specifications

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Process mode | Sequential (MVP); Hierarchical (V1) | Sequential is reproducible and debuggable for MVP |
| Agent count | 3 (MVP) → 6 (V1) | Strict scope control per development-workflow rules |
| Task chaining | Explicit `Task.context` | Deterministic dependency flow; no implicit routing |
| Memory | `memory=False` | Reproducibility; portfolio context loaded per-run from storage |
| `CREWAI_STORAGE_DIR` | `project-context/2.build/crew-state/` | Project-scoped; version-controlled path |
| `max_iter` | 8 (Scout, Qualifier); 12 (Writer, Matcher) | MVP budget control |
| `max_execution_time` | 120s (Scout, Qualifier); 300s (Writer) | Timeout guards per adapter rules |
| `max_retry_limit` | 3 | Minimum per CrewAI adapter rules |
| `max_rpm` | 10 (crew-level) | Budget stability; prevents runaway API spend |

### Core Agent Definitions

**Agent 1: Job Scout** (MVP — P0)
```yaml
agent: job_scout
role: "Upwork Job Discovery Specialist"
goal: >
  Monitor Upwork RSS feeds and apply user-defined filters to surface a daily
  shortlist of 5–15 relevant, high-quality job opportunities.
backstory: >
  Expert in parsing job marketplace data and applying nuanced filters to
  distinguish signal from noise in high-volume job feeds.
tools: [RSSFeedTool, JobFilterTool, PipelineStateWriteTool]
memory: false
allow_delegation: false
max_iter: 8
max_execution_time: 120
expected_output: >
  Ranked list of 5–15 jobs meeting user criteria. Per job: title, budget,
  posted_date, url, 150-char snippet. Output to pipeline state as status=Discovered.
```

**Agent 2: Client Qualifier** (MVP — P0)
```yaml
agent: client_qualifier
role: "Client Due Diligence Analyst"
goal: >
  Enrich each shortlisted job with client signals from public Upwork profile
  data and output a qualification score with transparent, human-readable reasoning.
backstory: >
  Senior freelance consultant with 10+ years reading client red flags:
  payment history, hire rate, review sentiment, budget authenticity, scope patterns.
tools: [UpworkProfileFetchTool, ClientScoringTool, PipelineStateWriteTool]
memory: false
allow_delegation: false
max_iter: 8
max_execution_time: 120
expected_output: >
  Per-job qualification report: score (1–10), payment_verified (bool),
  total_spend ($), avg_rate ($/hr), hire_rate (%), red_flags[], green_flags[],
  recommendation (Pursue / Skip / Review). Readable reasoning paragraph required.
```

**Agent 3: Proposal Writer** (MVP — P0)
```yaml
agent: proposal_writer
role: "Expert Freelance Proposal Copywriter"
goal: >
  Draft a personalized, voice-matched cover letter for each qualified job,
  grounded in the user's portfolio and the specific job requirements.
backstory: >
  Award-winning copywriter specializing in high-conversion freelance proposals.
  Deep expertise in UX/UI, product design, and software development project briefs.
  Trained on the user's personal writing style and portfolio of past work.
tools: [PortfolioReadTool, VoiceExamplesTool, ProposalDraftTool, PipelineStateWriteTool]
memory: false
allow_delegation: false
max_iter: 12
max_execution_time: 300
expected_output: >
  Draft cover letter (200–350 words) in user's voice. Includes 2–3 portfolio
  references. Includes: voice_confidence_score (0–1), portfolio_items_used[],
  edit_suggestions[] when confidence < 0.80. Status updated to Drafted in pipeline.
```

**Agent 4: Portfolio Matcher** (V1 — P1)
```yaml
agent: portfolio_matcher
role: "Portfolio Relevance Optimizer"
goal: >
  Select the 2–3 most relevant portfolio case studies for each job using
  semantic similarity scoring between job description embeddings and case study embeddings.
tools: [EmbeddingSearchTool, PortfolioReadTool]
memory: false
allow_delegation: false
```

**Agent 5: Pipeline Tracker** (V1 — P1)
```yaml
agent: pipeline_tracker
role: "Sales Pipeline Manager"
goal: >
  Maintain accurate, up-to-date state for every opportunity in the pipeline
  and surface stale items and action items for the user.
tools: [PipelineStateReadTool, PipelineStateWriteTool, NotificationTool]
memory: false
allow_delegation: false
```

**Agent 6: Follow-up Agent** (V1 — P1)
```yaml
agent: followup_agent
role: "Relationship Nurture Specialist"
goal: >
  Identify stalled pipeline conversations and draft contextual follow-up
  messages in the user's voice for HITL review before any action.
tools: [PipelineStateReadTool, VoiceExamplesTool, MessageDraftTool]
memory: false
allow_delegation: false
```

### Integration Requirements

| Integration | Type | Priority | MVP / V1 | Notes |
|-------------|------|----------|----------|-------|
| Upwork RSS Feed | Data source | P0 | MVP | ToS-compliant; user manages session cookie |
| Upwork Public Profile Pages | Data enrichment | P0 | MVP | Client qualification signals; public data only |
| Anthropic Claude API | LLM runtime | P0 | MVP | Sonnet 4.6; prompt caching enabled |
| SQLite | State storage | P0 | MVP | Pipeline tracking; single-file, no server |
| PostgreSQL | State storage | P0 | V1 | Multi-tenant SaaS replacement for SQLite |
| Streamlit | Review UI | P0 | MVP | HITL review dashboard; desktop-only acceptable for MVP |
| OpenAI / Voyage Embeddings | Semantic search | P1 | V1 | Portfolio Matcher agent |
| Email / Slack | Notifications | P1 | V1 | Daily digest delivery |
| React / Next.js | Production UI | P1 | V1 | Replaces Streamlit; mobile-responsive |
| Contra RSS/API | Platform expansion | P2 | V2 | Phase 2 platform diversification |
| LinkedIn ProFinder | Platform expansion | P2 | V2 | Phase 2 |
| MCP Servers (portfolio, CRM) | Tool integration | P2 | V2 | Native MCP integration per adapter rules |

### Infrastructure Specifications

**Phase 1 — MVP**

| Component | Specification | Est. Cost |
|-----------|--------------|-----------|
| Compute | Render.com Web Service (1 CPU, 512MB RAM) | $7–$25/month |
| Storage | SQLite (local file) or Render PostgreSQL free tier | $0 |
| LLM | Anthropic Claude API (Sonnet 4.6) | $10–$50/month (solo user) |
| Secrets | `.env` file; `.env.example` in repo; no secrets in code | $0 |
| Logging | Prompt Trace logs → `project-context/2.build/logs/` | $0 |
| **Total** | | **<$75/month** |

**Phase 2 — V1 SaaS**

| Component | Specification |
|-----------|--------------|
| Compute | AWS ECS Fargate or Railway (auto-scaling) |
| Storage | PostgreSQL (multi-tenant; user data isolated by `tenant_id`) |
| LLM | Anthropic API with prompt caching (reduces cost ~70%) |
| Auth | Supabase Auth or Auth0 (OAuth2 / email magic link) |
| Observability | Langfuse or Datadog for LLM trace observability |
| CDN | Cloudflare for static assets |

---

## 4. Functional Requirements

### P0 — Core Features (MVP, Weeks 1–8)

**F01: Job Discovery (Job Scout Agent)**
- *User story*: As a freelancer, I can see a daily shortlist of 5–15 relevant Upwork jobs matching my filters, without manually scanning my feed each morning.
- *Acceptance criteria*:
  - System polls Upwork RSS feed on user-defined schedule (default: 6:00 AM user local time)
  - Applies filters: `min_budget`, `skills[]`, `posted_within_hours`, `exclude_countries[]`, `min_hours_per_week`
  - Deduplicates against jobs already in pipeline state (seen in last 30 days)
  - Output per job: title, budget range, posted_date, url, 150-char description snippet, relevance_rank
  - Full Scout run completes in <120 seconds for 50-job feed scan
- *Constraints*: RSS-only data source; no authenticated Upwork API calls; no automated application

**F02: Client Qualification (Client Qualifier Agent)**
- *User story*: As a freelancer, I can see a qualification score with transparent reasoning for each shortlisted job, letting me decide in under 30 seconds whether to pursue it.
- *Acceptance criteria*:
  - Fetches public client signals: `payment_verified`, `total_spend`, `hire_rate`, `avg_hourly_rate`, `review_count`, `review_score`, `open_jobs_count`
  - Applies configurable qualification rules: `payment_verified=required`, `min_total_spend=$500`, `hire_rate>30%`
  - Outputs per job: `score` (1–10), `green_flags[]`, `red_flags[]`, `recommendation` (Pursue / Skip / Review), human-readable reasoning paragraph
  - Completes in <60 seconds per job (10 jobs = <600s total)
- *Constraints*: Fetches only publicly visible Upwork data; no credential storage; no login automation

**F03: Proposal Drafting (Proposal Writer Agent)**
- *User story*: As a freelancer, I receive a draft cover letter in my own voice for each qualified job, ready for 5-minute review and light editing before I submit it manually.
- *Acceptance criteria*:
  - Draft is 200–350 words (optimal Upwork cover letter length)
  - References the specific job title, key stated requirement, and inferred client pain point
  - Includes references to 2–3 portfolio items from the user's case study library
  - Voice confidence score ≥ 0.75 for approved drafts; drafts scoring <0.60 are flagged with a warning and edit suggestions
  - User can Approve (copies to clipboard), Edit (inline edit), or Reject (archives job) from review UI
- *Constraints*: No auto-submission; clipboard-copy is the only external action; HITL is mandatory

**F04: Human Review Interface**
- *User story*: As a freelancer, I can review all AI-generated content in a single daily digest and approve, edit, or reject each item without switching between tools.
- *Acceptance criteria*:
  - Streamlit dashboard displays: today's shortlist (with qualification badges), proposal drafts (with confidence scores and portfolio references), pipeline summary
  - Per-item actions: Approve, Edit (inline), Reject
  - Review session state persists (approved items don't reappear in same session)
  - CLI fallback: `aamad-sales review` outputs interactive terminal review for V0.5
- *Constraints*: Desktop-only is acceptable for MVP; mobile-responsive required for V1

**F05: Pipeline State Management**
- *User story*: As a freelancer, I can see the current status of every opportunity I've engaged with, so nothing falls through the cracks.
- *Acceptance criteria*:
  - States: `Discovered → Qualified → Drafted → Submitted → Replied → Call Scheduled → Won → Lost → Archived`
  - User updates state via review UI (dropdown or button per item)
  - State persists across sessions in SQLite/PostgreSQL
  - Pipeline view sortable by date, status, budget; filterable by status
  - CLI: `aamad-sales pipeline` prints current pipeline table
- *Constraints*: Manual state updates only in MVP; no Upwork inbox API available

**F06: Voice Onboarding**
- *User story*: As a new user, I can upload my past proposals so the system learns my writing style before generating any drafts.
- *Acceptance criteria*:
  - Onboarding flow prompts for minimum 10 example proposals (plain text or markdown)
  - System generates and displays a style report: average word count, tone descriptors, sentence structure analysis
  - If fewer than 10 examples provided, system blocks proposal generation and shows warning
  - CLI: `aamad-sales onboard` triggers guided flow

### P1 — Enhanced Features (V1, Months 3–6)

**F07: Portfolio Matcher (Semantic Matching)**
- Embeddings-based similarity search across user's case study library
- Auto-selects top 2–3 case studies per job based on semantic similarity score
- User can override selection from review UI
- Portfolio quality improves as user adds more case studies (compounding value)

**F08: Follow-up Agent**
- Identifies conversations in Replied or Call Scheduled states with no activity for >48 hours (configurable)
- Drafts a contextual follow-up message referencing the conversation thread
- Surfaces for HITL review before any clipboard copy action

**F09: Daily Digest Notification**
- Morning email or Slack message: "N new opportunities discovered, M qualification reports ready, K proposals drafted for review"
- Link to Streamlit / React dashboard for review
- User-configurable schedule and notification channel

**F10: Portfolio Case Study Manager**
- Web UI for adding, editing, and tagging portfolio case studies
- Auto-generates embedding for each case study on save
- Shows per-case-study usage stats (how often referenced in proposals)

### P2 — Future Features (V2+, Months 6–12)

**F11: Contra Platform Integration** — RSS + enrichment for Contra job listings
**F12: LinkedIn ProFinder Integration** — Feed monitoring for ProFinder project requests
**F13: Outcome-Based Pricing Module** — Track proposal-to-engagement conversion for revenue-share billing tier
**F14: Multi-Seat / Agency Tier** — Tenant isolation, SSO, team pipeline views, 3-seat plans
**F15: A/B Proposal Testing** — Track conversion rate by proposal variant to improve generation quality
**F16: MCP Server Integration** — Native MCP tools for portfolio management and CRM data access
**F17: Mobile App (React Native)** — Native mobile review interface for on-the-go approvals

---

## 5. Non-Functional Requirements

### Performance Requirements

| Metric | MVP Target | V1 Target |
|--------|-----------|-----------|
| Full daily run (Scout 30 + Qualify 15 + Write 5) | <10 minutes | <5 minutes |
| Single proposal generation (end-to-end) | <60 seconds | <30 seconds |
| Dashboard load time | <3 seconds | <1 second |
| System uptime | ≥95% | ≥99.5% |
| LLM cost per user per day (full run) | <$2.00 | <$0.80 (with caching) |
| LLM cost per user per month (full usage) | <$50 | <$15 (with caching) |

### Security & Compliance

| Requirement | Implementation |
|-------------|---------------|
| API key management | All secrets in `.env`; `.env.example` in repo; zero secrets hardcoded |
| User data at rest | Filesystem for MVP; AES-256 encrypted storage for V1 |
| No credential storage | Upwork session cookies are user-managed; system never stores passwords or auth tokens |
| HITL enforcement | No code path exists for automated submission; clipboard-only external action |
| Prompt Trace | All LLM inputs/outputs logged; API keys and PII redacted before log write |
| GDPR readiness | User data deletion endpoint required before EU market expansion |
| Upwork ToS compliance | Legal review of ToS before V1 launch; RSS polling rate ≤1/hour |

### Scalability & Reliability

| Requirement | Implementation |
|-------------|---------------|
| Idempotency | All agent tasks are idempotent and safe to retry without side effects |
| Retry logic | `max_retry_limit=3` at task level; exponential backoff for external API calls |
| Graceful degradation | RSS parse failure → Diagnostic logged, run skipped, user notified; no silent failure |
| Stateless agents | No in-memory state between runs; all state in SQLite/PostgreSQL |
| Schema validation | RSS feed output validated against expected schema before processing; `Task.guardrail` for proposal output |

---

## 6. User Experience Design

### Interface Requirements

**V0.5 CLI** (Weeks 1–6)

| Command | Action |
|---------|--------|
| `aamad-sales onboard` | Guided portfolio and voice example setup |
| `aamad-sales scan` | Trigger daily job scan (Scout + Qualifier) |
| `aamad-sales draft` | Generate proposals for qualified jobs |
| `aamad-sales review` | Interactive terminal review session |
| `aamad-sales pipeline` | Print current pipeline status table |
| `aamad-sales config` | Edit filters (budget floor, skills, posting recency) |

**Enhanced MVP — Streamlit Dashboard** (Weeks 5–8)

| Tab | Content |
|-----|---------|
| Today's Jobs | Ranked shortlist with qualification badges (green/yellow/red), score, key signals |
| Proposals | Draft review cards: voice confidence score, portfolio items used, approve/edit/reject actions |
| Pipeline | Status board: cards grouped by pipeline stage; sortable by date and budget |
| Settings | Filters, portfolio manager, voice examples upload, notification preferences |

### Agent Interaction Design

**HITL Checkpoints** (architecturally enforced — no bypass):

1. **Post-qualification**: User reviews shortlist and qualification scores before proposal drafting begins
2. **Post-proposal generation**: User reviews and approves each draft before clipboard-copy action is offered
3. **Post-follow-up draft**: User reviews message and conversation context before any copy action

**Transparency Features** (required for all AI outputs):
- Every qualification score: reasoning paragraph with `green_flags[]` and `red_flags[]` displayed
- Every proposal: voice confidence score displayed; portfolio items used listed; edit suggestions shown when score <0.80
- Every follow-up: conversation thread context shown; days-since-last-activity displayed

**Error Handling**:
- LLM API timeout → retry ×3 with exponential backoff; surface Diagnostic to user after 3rd failure
- RSS feed parse error → log Diagnostic, skip run, notify user with next scheduled run time
- Portfolio item missing → Writer uses remaining items + logs warning in Prompt Trace; never silently omits context

---

## 7. Success Metrics & KPIs

### North-Star Metric
**Qualified opportunities surfaced per week per user** — primary measure of system value delivery. Leading indicator: proposal-to-interview conversion rate (AI-assisted vs. manual historical baseline).

### Business Metrics

| Metric | Founder MVP (Wk 1–8) | Beta Launch (Month 3) | Revenue Launch (Month 6) | Scale (Month 12) |
|--------|----------------------|----------------------|--------------------------|-----------------|
| Active users | 1 | 5–10 | 10–25 | 100+ |
| MRR | $0 | $0 (free beta) | $990–$2,500 | $9,900–$19,900 |
| Churn rate | N/A | N/A | <10%/month | <5%/month |
| CAC | N/A | $0 (community) | <$200 | <$150 |
| LTV | N/A | N/A | $1,000+ | $2,000+ |

### Technical Metrics

| Metric | Target |
|--------|--------|
| Jobs surfaced per daily run | 5–20 (user-configurable cap) |
| Qualification agreement rate (user agrees with AI recommendation) | >80% |
| Proposal acceptance rate (user approves without major structural edit) | >60% |
| Proposal-to-interview conversion lift vs. manual baseline | ≥+20% |
| System uptime | ≥95% (MVP); ≥99.5% (V1) |
| LLM cost per user per month | <$15 at full daily usage (with caching) |
| Prompt Trace coverage | 100% of proposal drafts |

### User Experience Metrics

| Metric | Target |
|--------|--------|
| Daily digest review time | <15 minutes (vs. 2+ hours manual) |
| Time saved per week per user | ≥8 hours |
| Onboarding completion rate | ≥80% within 7 days of signup |
| Weekly active rate | ≥70% (users running system ≥5 days/week) |
| Net Promoter Score (closed beta) | ≥50 |

---

## 8. Implementation Strategy

### Development Phases

**Phase 1: MVP (Weeks 1–8) — AAMAD Phase 2 Build Epics**

| Week | AAMAD Epic | Deliverable |
|------|-----------|-------------|
| 1 | Setup (@project.mgr) | Virtual env, dependencies, Upwork RSS confirmed, `project-context/2.build/setup.md` |
| 2–3 | Backend — Job Scout (@backend.eng) | CrewAI crew scaffold, Job Scout agent, RSSFeedTool, JobFilterTool, unit tests |
| 3–4 | Backend — Client Qualifier (@backend.eng) | Qualifier agent, UpworkProfileFetchTool, scoring logic, guardrail tests |
| 4–5 | Backend — Proposal Writer (@backend.eng) | Writer agent, VoiceExamplesTool, PortfolioReadTool, voice confidence guardrail |
| 5–6 | Frontend (@frontend.eng) | Streamlit dashboard: review UI, pipeline board, settings tab |
| 6–7 | Integration (@integration.eng) | End-to-end wiring, HITL checkpoints enforced, Prompt Trace logging |
| 7–8 | QA (@qa.eng) | 5+ real proposals sent, conversion tracked, `project-context/2.build/qa.md` |

**Phase 2: V1 SaaS (Months 3–6)**
- Add Portfolio Matcher (F07), Follow-up Agent (F08), Pipeline Tracker enhancements
- React/Next.js frontend replacing Streamlit; mobile-responsive
- Multi-tenant PostgreSQL with `tenant_id` isolation
- Email/Slack daily digest notifications (F09)
- Closed beta: $99–$149/month for 10 users

**Phase 3: Scale (Months 6–12)**
- Contra + LinkedIn ProFinder integrations (F11, F12)
- Outcome-based pricing option (F13)
- Agency/multi-seat tier (F14)
- 100+ user milestone
- SOC2 Type 1 compliance preparation

### Resource Requirements

| Resource | MVP (Wks 1–8) | V1 (Months 3–6) | Scale (Months 6–12) |
|----------|--------------|-----------------|---------------------|
| Engineering | 1 founder + Claude Code agents | 1–2 engineers | 2–3 engineers |
| LLM API | ~$50–$200/month | ~$500–$2,000/month | ~$2,000–$10,000/month |
| Infrastructure | <$50/month | $100–$500/month | $500–$5,000/month |
| Other (subs, tools) | <$50/month | <$200/month | <$500/month |
| **Total monthly burn** | **<$300/month** | **<$3,000/month** | **<$15,000/month** |

### Risk Mitigation

| Risk | Priority | Mitigation |
|------|----------|------------|
| Upwork ToS violation | Critical | HITL hardcoded; zero auto-submit code paths; RSS poll ≤1/hr; legal review before V1 |
| LLM quality regression | High | Prompt Trace on all drafts; voice confidence guardrail; user feedback loop in review UI |
| Scope creep in MVP | High | 3 agents only for MVP; remaining 3 explicitly deferred; AAMAD module boundaries enforced |
| RSS feed schema change | Medium | Schema validation + Diagnostic on parse failure; monitoring alert; manual trigger fallback |
| Founder context bias | Medium | 3–5 external beta users in non-design verticals recruited by Month 2 |
| LLM cost overrun | Medium | Prompt caching from day one; per-run budget cap; cost alerting configured |

---

## 9. Launch & Go-to-Market Strategy

### Beta Testing Plan

**Phase 0 — Founder Dog-Food (Weeks 1–8)**
- Solo validation on builder's own Upwork account (Top Rated Plus, $300k+ earned)
- Baseline measurement: jobs reviewed/week, proposals sent/week, interviews booked/month (manual)
- Success threshold: ≥3 interviews booked from AI-assisted proposals within 30 days of MVP completion
- Metrics logged daily to `project-context/2.build/logs/`

**Phase 1 Beta — Closed Cohort (Month 2–3)**
- Target: 5–10 Top Rated Upwork freelancers, non-UX verticals preferred for diversity (devs, copywriters)
- Recruitment: Upwork Community, LinkedIn posts, freelance Slack communities (e.g., Freelance Bold, independent dev communities)
- Incentive: Free access for 3 months in exchange for weekly 30-min feedback sessions
- Success threshold: ≥70% weekly active rate; NPS ≥40; ≥80% retention through Month 3

### Market Launch Strategy

**Positioning**: "Your AI sales team. You stay in control."

**GTM Channels** (in priority order):

| Channel | Approach | Timeline |
|---------|----------|----------|
| Founder content (LinkedIn/X) | Share dog-food results publicly: jobs surfaced, proposals sent, interviews booked, revenue won. Authentic first-user story. | Weeks 1–8 (concurrent with build) |
| Upwork Community | Top Rated / Top Rated Plus community threads; position as "tool built by a Top Rated+ freelancer" | Month 2+ |
| Freelance newsletters | Sponsored or organic mentions in Freelance Bold, The Freelancer's Year, Lenny's Newsletter (adjacent) | Month 3+ |
| ProductHunt launch | Full launch with demo video, $99/month pricing, waitlist | Month 4 |
| Referral program | 1 free month per successful referral; leverage word-of-mouth in tight freelancer communities | Month 4+ |

**Pricing Structure**

| Tier | Price | Includes | Timeline |
|------|-------|----------|----------|
| Beta (free) | $0 | Full access; feedback required | Months 2–4 |
| Starter | $99/month | 3 agents (Scout + Qualifier + Writer), 20 jobs/day cap | Month 4 launch |
| Pro | $149/month | Full 6-agent crew, unlimited jobs | Month 6 |
| Agency | $299/month | 3 seats, shared pipeline view | Month 9+ |

### Success Criteria

| Milestone | Metric | Timeline |
|-----------|--------|----------|
| MVP validation | ≥3 interviews from AI-assisted proposals | Week 8 |
| Beta quality signal | NPS ≥40; ≥70% weekly active rate | Month 3 |
| Revenue launch | 10 paying users at $99–$149/month | Month 4 |
| PMF signal | Monthly churn <5%; NPS ≥50; organic referrals >30% of new signups | Month 6 |
| Scale trigger | 100 paying users; positive unit economics | Month 12 |

---

## QA Checklist

- [x] All requirements traceable to MRD research findings (mr.md sections cited)
- [x] Technical specifications feasible with CrewAI sequential process mode
- [x] Success metrics aligned with business objectives (north-star: qualified opportunities/week)
- [x] Resource requirements realistic for solo founder on 6–8 week timeline
- [x] Risk mitigation comprehensive for Upwork ToS, LLM quality, and scope constraints
- [x] Timeline achievable with AAMAD Phase 2 modular workflow (one epic per module)
- [x] HITL enforced as architectural requirement throughout all agent definitions
- [x] Agent definitions include `allow_delegation: false` per CrewAI adapter rules
- [x] `max_iter`, `max_execution_time`, `max_retry_limit` specified for all MVP agents
- [x] Secrets management documented (`.env` / `.env.example` pattern)

---

## Sources

*(Full citations in project-context/1.define/mr.md — abridged here for reference)*

1. Upwork Inc. *Freelance Forward 2023*. https://www.upwork.com/research/freelance-forward
2. MBO Partners. *State of Independence in America 2023*. https://www.mbopartners.com/state-of-independence
3. Upwork Inc. *Annual Report (Form 10-K), FY2023*. https://investor.upwork.com
4. Freelancers Union. *Freelancing in America 2023*. https://www.freelancersunion.org
5. HubSpot. *State of AI Report 2024*. https://www.hubspot.com/state-of-ai
6. MarketsandMarkets. *Sales Automation Market Forecast to 2028*. https://www.marketsandmarkets.com
7. Upwork Inc. *Terms of Service*. https://www.upwork.com/legal
8. João Moura. *CrewAI GitHub Repository*. https://github.com/joaomdmoura/crewAI
9. Anthropic. *Claude Model Capabilities*. https://www.anthropic.com/claude
10. Anthropic. *Claude API Pricing and Prompt Caching*. https://www.anthropic.com/api
11. Nielsen Norman Group. *AI Writing Tools in Professional Contexts*. https://www.nngroup.com
12. Google. *Agent-to-Agent Protocol*. https://developers.google.com/agents
13. Anthropic. *Model Context Protocol*. https://modelcontextprotocol.io
14. Contra. *Platform Statistics 2023*. https://contra.com
15–20. See mr.md for full source list.

---

## Assumptions

- MRD findings accurately reflect market conditions as of 2026-05-04.
- CrewAI sequential process mode is sufficient for the 3-agent MVP; hierarchical mode is deferred to Phase 2.
- The builder's UX/UI Upwork profile is sufficiently representative of the primary ICP for MVP validation purposes.
- Streamlit is acceptable as the MVP review UI; React/Next.js replaces it at V1.
- $99–$199/month pricing is supported by VA alternative cost data; formal price sensitivity testing to follow in closed beta.
- `AAMAD_TARGET_RUNTIME=crewai` is confirmed for all Phase 2 Build epics.

---

## Open Questions

1. Will Upwork's Top Rated Community allow discussion or promotion of third-party workflow automation tools? (GTM channel eligibility risk)
2. What is the minimum viable portfolio library size (number of case studies) for acceptable Portfolio Matcher quality in Phase 2?
3. Should the MVP target UX/UI design exclusively, or be multi-vertical from launch to reduce founder context bias faster?
4. Is Streamlit sufficient for closed beta user review UX, or does the lower-fidelity UI create early churn risk?
5. How should the system handle non-English job posts (Upwork is a global platform)?
6. Is a free trial tier (e.g., 7-day or 3-job limit) necessary for conversion, or does direct $99/month launch pricing reduce support overhead?

---

## Audit

| Field | Value |
|-------|-------|
| Timestamp | 2026-05-04 |
| Persona ID | @product-mgr |
| Action | PRD Generation — Phase 1 Define |
| Source MRD | project-context/1.define/mr.md |
| Runtime Resolved | crewai (AAMAD_TARGET_RUNTIME=crewai) |
| Template Used | .cursor/templates/prd-template.md |
| LLM | claude-sonnet-4-6 |
| Assumptions Recorded | 6 |
| Open Questions | 6 |
| Output Artifact | project-context/1.define/prd.md |
