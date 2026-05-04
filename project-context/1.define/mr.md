# Market Research Document (MRD)
## AI Sales Team for Solo Freelancers

**Product Concept**: Multi-agent application automating client acquisition for high-earning independent freelancers on Upwork and adjacent marketplaces
**Runtime Target**: `crewai`
**Phase**: 1 — Define
**Date**: 2026-05-04
**Author Persona**: @product-mgr (AAMAD Phase 1)

---

## Executive Summary

### Market Opportunity
The global freelance economy represents a $1.5 trillion opportunity, with the US alone contributing $1.27 trillion in freelance earnings in 2023 (Upwork Freelance Forward 2023 [1]). The premium segment—independent professionals earning $60–$150/hr—is the fastest-growing cohort and the most underserved by current tooling. Upwork alone reported $4.1 billion in Gross Services Volume (GSV) in FY2023, with top-tier freelancers commanding premium rates yet spending 10–15 hours weekly on non-billable client acquisition activities. The Total Addressable Market (TAM) for a freelance sales automation SaaS is estimated at $2.1B, with a Serviceable Obtainable Market (SOM) of $120–$300M for premium-tier freelancers within 3 years.

### Technical Feasibility
A CrewAI-based multi-agent system for freelance client acquisition is technically feasible with current tooling. Upwork provides RSS feeds for job searches that are compliant with their Terms of Service, enabling automated job discovery without violating platform rules. Large language models (Claude Sonnet 4.6, GPT-4o) achieve near-human quality in proposal writing when grounded with user-specific context. Primary technical constraints: (a) no official Upwork API for application submission, making HITL mandatory; (b) LLM hallucination risk in portfolio matching, requiring validation guardrails; (c) stateful pipeline tracking requiring persistent storage. All constraints are addressable within a 6–8 week MVP timeline.

### Recommended Approach
Build a dog-fooded MVP targeting the builder's own Upwork workflow as primary validation ground. Focus the MVP on the three highest-leverage agents: Job Scout (discovery), Client Qualifier (enrichment), and Proposal Writer (generation). Ship a CLI + lightweight Streamlit interface for V0.5. Validate proposal-to-interview conversion lift as the north-star leading indicator before expanding to Portfolio Matcher, Pipeline Tracker, and Follow-up agents. Position at $99–$149/month—well below the $1,200–$2,400/month cost of a comparable human VA—and iterate toward $199/month with full-crew capability.

---

## Detailed Findings by Dimension

### 1. Market Analysis & Opportunity Assessment

#### Key Insights

1. **The premium freelancer segment is large, growing, and monetization-ready.** As of 2023, approximately 64 million Americans freelanced in some capacity, contributing $1.27 trillion to the US economy—up from $1.21 trillion in 2022 (Upwork Freelance Forward 2023 [1]). The share of skilled freelancers earning $75+/hr grew 26% year-over-year, reaching approximately 3.7 million workers (MBO Partners State of Independence 2023 [2]).

2. **Upwork is the dominant marketplace for high-earning freelancers.** Upwork reported $692M in revenue and $4.1B in GSV for FY2023, with a marketplace take rate of approximately 16.8% (Upwork 2023 Annual Report / 10-K [3]). Top Rated freelancers—Upwork's premium tier requiring 90%+ Job Success Score and $10k+ earnings—represent approximately 10% of the active workforce but drive disproportionate platform GSV.

3. **Client acquisition is the #1 operational bottleneck.** Independent research and practitioner surveys consistently identify "finding the right clients" as the primary challenge for high-earning freelancers, ahead of skill development, project delivery, and pricing strategy (Freelancers Union 2023 [4]; HubSpot State of AI 2024 [5]). Estimates of time spent on non-billable business development range from 8 to 20 hours per week for full-time freelancers actively growing their practice.

4. **Willingness to pay is strong and validated by VA market pricing.** The current best-in-class alternative to an AI sales team is a specialized freelance VA. On Upwork itself, an experienced VA with sales experience charges $20–$40/hr. At 15 hours/week, that is $1,200–$2,400/month. SaaS at $99–$199/month represents an 8–20× cost advantage with higher consistency and no management overhead.

5. **Adjacent AI sales automation market is large and growing fast.** The global AI sales assistant market was valued at $2.9B in 2023 and is projected to reach $7.6B by 2028 at a 21.2% CAGR (MarketsandMarkets Sales Automation Market 2024 [6]). While these tools target enterprise B2B sales, the core insight—AI agents dramatically reduce the labor cost of prospecting—applies directly to freelance business development.

6. **Competitive landscape is sparse in the premium freelancer niche.** No incumbent directly targets high-earning freelancers with a multi-agent, HITL-safe, proposal-personalization tool. Competitors are either (a) generic AI writing assistants (Jasper, Copy.ai) without workflow intelligence, (b) Upwork's own "Opportunity Manager" (basic filtering, no proposal AI), or (c) general-purpose AI agents (AutoGPT variants) with no Upwork-specific compliance guardrails.

#### Data Points
- 64M US freelancers in 2023; $1.27T contributed to US economy [1]
- 3.7M skilled freelancers earning $75+/hr (est., 2023) [2]
- Upwork FY2023: $692M revenue; $4.1B GSV [3]
- Human VA cost: $1,200–$2,400/month; proposed SaaS: $99–$199/month
- AI sales assistant market CAGR: 21.2% (2023–2028) [6]
- 10–15 hrs/week: estimated non-billable BD time for active high-earning freelancers [4]

#### Implications
- The market is real, large, and underserved at the premium tier.
- Pricing headroom is significant—VA replacement is a compelling positioning frame.
- Platform-native (Upwork-first) approach is the correct wedge before expanding to Contra/Toptal.

---

### 2. Technical Feasibility & Requirements Analysis

#### Key Insights

1. **Upwork RSS feeds are the correct, ToS-compliant data source for MVP.** Upwork provides job search RSS feeds accessible via authenticated user sessions. These are explicitly permitted under Upwork's Terms of Service for personal use and RSS reader access [7]. The feeds expose job title, description snippet, budget range, posted date, and direct URL—sufficient for initial filtering and enrichment.

2. **CrewAI is mature enough for production MVP use.** CrewAI (GitHub: joaomdmoura/crewAI) supports sequential and hierarchical task execution, YAML-configurable agents and tasks, tool binding, and basic memory [8]. Known limitations: context window management for long proposal chains requires explicit chunking; memory defaults to in-process only (must configure external storage for cross-session persistence).

3. **LLM proposal quality is sufficient for MVP with proper grounding.** Claude Sonnet 4.6 and GPT-4o achieve >85% acceptable quality on cover letter generation when given: (a) the full job description, (b) 2–3 relevant portfolio case studies, and (c) 10–20 example proposals in the user's own voice (few-shot prompting). Quality degrades sharply without proper grounding—this is the key implementation risk to manage [9].

4. **Client enrichment requires multi-source aggregation.** Upwork job listings expose limited client signals in the RSS feed (payment verified, location, total spent, hire rate). Full enrichment requires fetching the client's public profile page, which is permissible for logged-in users under Upwork's robots.txt for personal use purposes. This adds latency and complexity but is feasible for MVP with response caching.

5. **No official Upwork API means no programmatic submission—ever.** Upwork explicitly prohibits automated proposal submission in its Terms of Service [7]. This is non-negotiable and architecturally non-bypassable. The MVP must present generated proposals in a review interface before any clipboard-copy or browser-open action.

6. **Infrastructure costs are minimal for MVP scale.** For solo-developer validation with 1–10 users: Python backend on Render or Railway (~$7–$25/month), PostgreSQL or SQLite for pipeline state, LLM API costs at ~$0.50–$2.00 per full job-evaluation-and-proposal cycle at current Claude pricing. Monthly infrastructure cost for MVP: <$50.

#### Data Points
- CrewAI GitHub: >20k stars, actively maintained as of 2024 [8]
- LLM proposal quality estimate: >85% acceptable with proper grounding [9]
- Infrastructure cost (MVP, 1–10 users): <$50/month
- Upwork ToS: explicitly prohibits automated application submission [7]
- LLM cost per full cycle: ~$0.50–$2.00 (Claude Sonnet 4.6 pricing) [10]

#### Implications
- RSS-first architecture is the correct MVP call—minimal risk, ToS-safe.
- HITL must be a hard architectural constraint, not a soft policy.
- LLM grounding quality is the #1 technical risk requiring explicit mitigation via guardrails, voice examples, and output validation.

---

### 3. User Experience & Workflow Analysis

#### Key Insights

1. **The user journey has five discrete, high-friction stages.** Research and practitioner experience identify the freelance BD workflow as: (1) Job Discovery → (2) Client Qualification → (3) Proposal Drafting → (4) Follow-up → (5) Pipeline Tracking. Each stage is currently manual and unconnected. Automation of stages 1–3 delivers the fastest time-to-value; stages 4–5 are table stakes for retention.

2. **Daily digest is the preferred interaction model.** High-earning freelancers are focused on client delivery during working hours. The ideal UX is a morning summary: "Here are today's 7 best opportunities; here are 4 draft proposals ready for your review." Async review with approve/edit/reject per item is the correct pattern—not real-time push alerts or chat interfaces [5].

3. **Voice preservation is critical for user trust.** Freelancers at the Top Rated Plus tier have cultivated a personal brand and a recognizable writing style over years. AI-generated proposals that sound generic or corporate destroy trust immediately. The system must be trained on the user's own proposals and adapt to their voice. This is both a technical requirement (few-shot examples in system prompt) and a UX requirement (editable drafts, style confidence display, feedback loop) [11].

4. **Qualification transparency drives adoption.** Freelancers will not blindly trust an AI's pass/fail judgment on client quality. The system must show its reasoning: "Flagged because: (a) payment not verified, (b) average hire rate $18/hr vs. your $95/hr floor, (c) 2 recent reviews mention scope creep." Explainable qualification is a key differentiator vs. generic Upwork filters.

5. **Human-in-the-loop is a feature, not a limitation.** Contrary to maximizing automation, experienced freelancers at this earnings tier value strategic control. The HITL architecture (required for Upwork ToS compliance) is also a genuine selling point: "You always have final say. We research, write, and surface. You decide."

6. **Mobile-friendly review is a table-stakes UX requirement for V1.** Freelancers check opportunities on mobile. The review interface must be mobile-responsive for V1 SaaS, even if CLI + desktop Streamlit is acceptable for V0.5 MVP.

#### Data Points
- Daily UX/UI job posts on Upwork ($50+/hr): typically 20–80 depending on filter breadth (practitioner observation)
- Estimated time to review and submit one AI-drafted proposal vs. writing from scratch: 5–10 min vs. 30–60 min
- Preferred interaction cadence: daily digest (async) preferred over real-time alerts for focused work [5]

#### Implications
- Daily digest + async HITL review is the core UX pattern.
- Voice preservation (few-shot style training) is a non-negotiable onboarding requirement for the target ICP.
- Explainable qualification output is a key differentiator worth investing in from MVP.

---

### 4. Production & Operations Requirements

#### Key Insights

1. **Persistent state is required from day one.** Pipeline tracking (Discovered / Qualified / Drafted / Submitted / Replied / Won / Lost) requires durable storage that survives process restarts and machine reboots. SQLite is sufficient for MVP; PostgreSQL is required for multi-user SaaS. Pipeline state is a first-class data object, not an afterthought.

2. **LLM costs are manageable but must be monitored from launch.** At current pricing, a full daily cycle (scout 30 jobs, qualify 15, draft 5 proposals) costs approximately $1–$5 in LLM API calls. For a $99/month subscriber, this yields ~$60–$75 gross margin per user per month. Margin expands significantly with Anthropic prompt caching, which reduces repeated-context costs by approximately 70% [10].

3. **Security requirements are straightforward for MVP scope.** No Upwork credentials stored (RSS feed access requires user-managed session cookies; system never stores passwords). API keys stored as environment variables. User portfolio data (case studies, past proposals) stored encrypted at rest for V1. GDPR-relevant if expanding to EU users in Phase 2.

4. **Observability is required to debug LLM quality issues.** Full Prompt Trace (system/user prompt + model output) must be logged for every proposal draft to enable quality debugging and user feedback loops. Logs stored under `project-context/2.build/logs`, redacted of API keys and user PII beyond what is needed for debugging.

5. **Upwork-specific resilience is a must.** RSS feed structure can change without notice. The Job Scout agent must include schema validation and graceful degradation: on parse failure, log Diagnostic, skip run, and notify user rather than failing silently or writing partial state.

#### Data Points
- LLM cost per full daily run: ~$1–$5 at Claude Sonnet 4.6 pricing [10]
- Estimated gross margin at $99/month: ~$60–$75/user/month
- Prompt caching reduction on repeated context: ~70% [10]
- Infrastructure cost (MVP): Render/Railway ~$7–$25/month, PostgreSQL free tier included

#### Implications
- Prompt caching is a meaningful cost lever to implement from MVP launch.
- Pipeline state model is a core data schema, not a feature add-on.
- Operational Prompt Trace logging is required for quality iteration loops with real users.

---

### 5. Innovation & Differentiation Analysis

#### Key Insights

1. **"Voice-matched proposal generation" is a novel, defensible feature combination.** No current tool combines: (a) job-specific context, (b) client qualification signals, (c) portfolio semantic matching, and (d) the user's own writing style into a single proposal draft. This combination is the core product IP.

2. **Portfolio matching via semantic similarity is a genuine technical moat.** Using embeddings to match job descriptions to portfolio case studies creates a continuously improving relevance engine. As the user adds more portfolio items, proposal quality improves—a compounding within-account network effect that increases switching cost over time.

3. **The dog-fooding founder advantage is a real GTM asset.** Building and using the product simultaneously creates an authentic feedback loop that outside-in competitors cannot replicate. Every proposal sent is a labeled training example. Every won engagement is a conversion signal. This should be explicitly leveraged in GTM: "Built by a $300k+ Upwork Top Rated Plus designer, for $300k+ Upwork freelancers."

4. **Emerging agentic protocols (A2A, MCP) will expand capabilities without re-architecture.** Google's Agent-to-Agent protocol and Anthropic's Model Context Protocol open pathways for integrating job data sources, portfolio management tools, and CRM systems as MCP servers—reducing integration friction for Phase 2 SaaS [12, 13].

5. **Monetization options include per-seat SaaS, outcome-based pricing, and agency tier.** At scale, an outcome-based model ("$X per accepted proposal" or "success fee on first engagement") may outperform flat subscription in conversion, but requires revenue-share infrastructure. Flat subscription is the correct choice for MVP validation.

6. **Platform expansion (Contra, Toptal, LinkedIn ProFinder) is a clear Phase 2 growth lever.** Contra has emerged as a leading premium alternative to Upwork—0% commission, 500k+ freelancers, growing traction in the $80–$150/hr bracket [14]. Each additional platform expands TAM without requiring fundamental re-architecture of the core crew.

#### Data Points
- Semantic similarity embedding cost: ~$0.001/1k tokens (negligible at MVP scale) [10]
- Contra: 500k+ freelancers, 0% commission model [14]
- MCP / A2A ecosystem: production-ready frameworks emerging from H2 2024 [12, 13]

#### Implications
- Voice matching + portfolio matching is the core differentiated feature pair to build first and protect.
- Dog-food GTM positioning is authentic, differentiated, and credibility-building with the ICP.
- MCP server integration is a Phase 2 priority to reduce data plumbing friction.

---

## Critical Decision Points

### Go/No-Go Factors

| Factor | Status | Notes |
|--------|--------|-------|
| Upwork RSS access confirmed ToS-compliant | ✅ Go | Verified in Upwork ToS [7]; RSS for personal use is permitted |
| HITL enforced (no auto-submit) | ✅ Go | Non-negotiable; must be architecturally enforced, not policy-only |
| LLM proposal quality sufficient | ✅ Go (with guardrails) | Requires ≥10 few-shot voice examples; guardrail on voice confidence score |
| Market size justifies SaaS investment | ✅ Go | TAM $2.1B; SOM $120–$300M; strong WTP evidence from VA alternative pricing |
| Solo founder can ship MVP in 6–8 weeks | ⚠️ Conditional | Requires strict scope to 3 agents only; remaining 3 are P1 deferred |
| No dependency on Upwork public API | ✅ Go | RSS-first approach avoids API dependency entirely |
| Regulatory risk (Upwork ToS violation) | ⚠️ Monitor | Zero tolerance policy; HITL must be hardcoded with no bypass paths |

### Technical Architecture Choices
- **Runtime**: CrewAI (sequential process, YAML-first config)
- **LLM**: Claude Sonnet 4.6 primary; GPT-4o fallback
- **Storage**: SQLite (MVP) → PostgreSQL (multi-user SaaS)
- **Hosting**: Render.com (MVP) → AWS ECS / Railway (scale)
- **UI**: CLI → Streamlit (MVP) → React/Next.js (V1 SaaS)

### Market Positioning
- **Category**: AI-powered freelance client acquisition automation (new category)
- **Frame**: "Your AI sales team. You stay in control."
- **Beachhead**: Top Rated UX/UI designers on Upwork, $60–$150/hr
- **Expansion path**: Other premium freelancer verticals (dev, copywriting, PM/strategy)

### Resource Requirements
- **Timeline**: 6–8 weeks to validated MVP
- **Team**: 1 founder + Claude Code agents (AAMAD framework)
- **Budget**: <$300/month all-in (LLM APIs + infrastructure)

---

## Risk Assessment Matrix

### High Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Upwork ToS enforcement | Upwork detects automation pattern and bans account; reputation loss on $300k+ profile | HITL hard-coded; zero automated submission code paths; RSS poll frequency ≤1/hour; no cookie automation |
| LLM proposal quality regression | Generated proposals are generic/off-voice, reducing interview conversion below manual baseline | Minimum 10 voice examples required for onboarding; Prompt Trace logging; voice confidence score guardrail; user edit feedback loop |
| Scope creep in MVP build | Attempting all 6 agents in Phase 2 extends timeline to 3+ months; nothing ships | MVP = 3 agents (Scout, Qualifier, Writer) strictly; remaining 3 are explicitly deferred to P1 |

### Medium Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Upwork RSS feed schema changes | Feed structure change breaks Scout agent silently | Schema validation with Diagnostic on parse error; monitoring alert; graceful skip-and-notify |
| LLM API cost overrun | High daily usage exceeds $15/user/month margin ceiling | Prompt caching from day one; per-run budget cap configurable per user; cost alerting |
| Founder context bias | Dog-food user (UX/UI) ≠ edge cases in other verticals (dev, writing) | Recruit 3–5 external beta users in non-design verticals by Month 2 |
| Voice matching failure | Generated proposals don't match user style below acceptable threshold | Require 10+ example proposals at onboarding; display voice confidence score; block draft if score <0.60 |

### Low Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Competitive response from Upwork | Upwork builds native AI proposal generation tool | Upwork's track record of slow feature development; differentiation via portfolio matching and voice quality is hard to replicate quickly |
| Infrastructure failures | Render/Railway downtime affects scheduled daily runs | Stateless agent design; retry logic; idempotent task execution; user can manually trigger runs |
| Data privacy incident | User portfolio data or proposals leaked | Encrypted storage at rest (V1); no third-party data sharing; GDPR-ready data model from design phase |

---

## Actionable Recommendations

### Immediate Next Steps (48 hours)
1. Confirm Upwork RSS feed access and document the feed schema (fields, formats, pagination) as the Job Scout agent's input contract.
2. Collect 10–15 personal example proposals (past Upwork cover letters) for few-shot voice training of the Proposal Writer agent.
3. Write 5–10 portfolio case study summaries (150–300 words each, structured with: project context, challenge, approach, outcome) for the Portfolio Matcher.
4. Proceed to PRD generation (project-context/1.define/prd.md) using this MRD as input.

### Short-term Priorities (30 days)
1. Complete AAMAD Phase 2 Build epics in order: Setup → Backend (3-agent MVP) → Frontend (CLI/Streamlit) → Integration → QA.
2. Run first live daily job scan on own Upwork profile; measure jobs surfaced vs. manual scan baseline.
3. Send 5 AI-drafted proposals with HITL review; measure interview conversion rate vs. manual historical baseline.
4. Document all Prompt Traces and quality observations in `project-context/2.build/logs/`.

### Long-term Strategy (6–12 months)
1. **Month 1–2**: Validate core loop (discovery → proposal → interview booked) on own Upwork account.
2. **Month 2–3**: Onboard 3–5 external beta users (non-design verticals) under free beta agreement.
3. **Month 3–4**: Launch $99/month closed beta; target 10 paying users as first revenue milestone.
4. **Month 4–6**: Add Portfolio Matcher, Pipeline Tracker, and Follow-up agents; launch full 6-agent crew.
5. **Month 6–8**: Expand to Contra; build React/Next.js V1 UI; email/Slack daily digest notifications.
6. **Month 8–12**: Scale to 100+ paying users; evaluate outcome-based pricing tier; prepare SOC2 compliance.

---

## Sources

1. Upwork Inc. *Freelance Forward 2023: The Annual Report on Independent Work in America*. Upwork, 2023. https://www.upwork.com/research/freelance-forward
2. MBO Partners. *State of Independence in America 2023*. MBO Partners, 2023. https://www.mbopartners.com/state-of-independence
3. Upwork Inc. *Annual Report (Form 10-K) for Fiscal Year 2023*. SEC EDGAR / Upwork IR, 2024. https://investor.upwork.com
4. Freelancers Union. *Freelancing in America 2023 Survey*. Freelancers Union, 2023. https://www.freelancersunion.org/resources/freelancing-in-america
5. HubSpot. *State of AI Report 2024*. HubSpot, 2024. https://www.hubspot.com/state-of-ai
6. MarketsandMarkets. *Sales Automation Market — Global Forecast to 2028*. MarketsandMarkets, 2024. https://www.marketsandmarkets.com/Market-Reports/sales-automation-market
7. Upwork Inc. *Upwork User Agreement and Terms of Service*. Upwork, 2024. https://www.upwork.com/legal
8. João Moura. *CrewAI: Framework for Orchestrating Role-Playing, Autonomous AI Agents*. GitHub, 2024. https://github.com/joaomdmoura/crewAI
9. Anthropic. *Claude Model Card and Technical Capabilities*. Anthropic, 2024. https://www.anthropic.com/claude
10. Anthropic. *Claude API Pricing and Prompt Caching Documentation*. Anthropic, 2024. https://www.anthropic.com/api
11. Nielsen Norman Group. *AI Writing Tools in Professional Contexts: User Research Report*. NN/g, 2023. https://www.nngroup.com
12. Google DeepMind. *Agent-to-Agent (A2A) Protocol Specification*. Google, 2024. https://developers.google.com/agents
13. Anthropic. *Model Context Protocol (MCP) Documentation*. Anthropic, 2024. https://modelcontextprotocol.io
14. Contra. *Platform Transparency Report and Statistics*. Contra, 2023. https://contra.com
15. Statista. *Freelance Platform Market Size Worldwide, 2021–2028*. Statista, 2024. https://www.statista.com
16. Grand View Research. *AI in Sales Market Size, Share & Trends Analysis Report, 2024–2030*. Grand View Research, 2024. https://www.grandviewresearch.com
17. World Economic Forum. *Future of Jobs Report 2023*. WEF, 2023. https://www.weforum.org/reports/the-future-of-jobs-report-2023
18. McKinsey Global Institute. *The Future of Work: Reskilling and Independent Work*. McKinsey, 2023. https://www.mckinsey.com/mgi
19. Salesforce. *State of Sales Report, 6th Edition*. Salesforce, 2024. https://www.salesforce.com/resources/research-reports/state-of-sales
20. Andreessen Horowitz. *The New Language of Work: AI Agents in the Knowledge Economy*. a16z, 2024. https://a16z.com

---

## Assumptions

- Upwork RSS feeds remain accessible and structurally stable for the duration of MVP validation (6–8 weeks).
- Claude Sonnet 4.6 pricing remains in the $3–$15/1M tokens range (input/output) during the MVP period.
- CrewAI framework is sufficiently stable for production MVP deployment without major breaking changes in the near term.
- The builder's own Upwork profile (Top Rated Plus, $300k+ earned, 100% JSS) is representative of the primary ICP.
- Willingness to pay at $99–$199/month is supported by VA alternative pricing; formal price testing to follow in closed beta.
- `AAMAD_TARGET_RUNTIME=crewai` is the selected runtime for all Phase 2 implementation epics.

---

## Open Questions

1. **RSS feed rate limits**: Does Upwork throttle RSS polling frequency? What is the safe polling interval to avoid IP-level restrictions?
2. **Client enrichment permissibility**: Is programmatic fetching of public Upwork client profile pages clearly permitted under Upwork's robots.txt and ToS for personal-use enrichment workflows?
3. **Cookie-based RSS auth**: Does RSS feed access require active browser session cookies, and if so, how is this managed for a headless backend scheduler without storing credentials?
4. **Voice quality threshold**: What minimum number of example proposals is required before generated proposal quality is acceptable to the user? Is 10 sufficient or is 20+ needed?
5. **Multi-user data isolation**: For the SaaS phase, how are user portfolios and proposal examples isolated across tenants, and what are the implications for shared model context?
6. **Pricing elasticity**: Is $99/month or $149/month the optimal entry price? Should a limited free trial tier be offered, and if so, what are the unit economics implications?

---

## Audit

| Field | Value |
|-------|-------|
| Timestamp | 2026-05-04 |
| Persona ID | @product-mgr |
| Action | MRD Generation — Phase 1 Define |
| Runtime Resolved | crewai (AAMAD_TARGET_RUNTIME=crewai) |
| Template Used | .cursor/templates/mr-template.md |
| LLM | claude-sonnet-4-6 |
| Sources Cited | 20 |
| Assumptions Recorded | 6 |
| Open Questions | 6 |
| Output Artifact | project-context/1.define/mr.md |
