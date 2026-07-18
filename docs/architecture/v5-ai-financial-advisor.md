# v5 — AI Financial Advisor

## Two framing corrections, upfront

**"Analytics Engine" and "Automation Engine" are listed as already existing
in this brief's opening — one of those isn't accurate.** There is no
Analytics Engine anywhere in this codebase; the closest thing is
`lib/jobs/analyticsJobs.ts`, a background job file, not a reasoning engine.
The Automation Engine is still design-only (`docs/architecture/
07-automation-engine-design.md`), flagged as not-yet-built in both the v3
and v4 passes. Worth knowing before planning further work that assumes
either exists as real code.

## Most of these 15 deliverables already substantially exist

Before building anything new, here's what a fresh read of this brief would
have you rebuild from scratch — don't:

| Deliverable | Actual status |
|---|---|
| 11. Explainable AI | The `Recommendation` type (`lib/ai/types.ts`, Phase 1) already carries `why`/`sources`/`confidence`/`nextAction` on every recommendation the app generates. This pass adds a stricter `ExplainableInsight` shape (separate Observation/Evidence/Reasoning/Assumptions fields) for newer surfaces — additive, not a replacement. |
| 15. AI Action Center | Fully built in Phase 1 — `copilot_actions` table, `lib/ai/actions/action-store.ts`, `ActionCenterPanel.tsx`, propose→confirm→execute flow. Nothing to add here. |
| 7. Daily Financial Brief | The AI Copilot's Executive Brief (Phase 1) plus the Dashboard's "AI Daily Brief" text card (v2) already cover most of this. |
| 1-3, 5. Spending/Savings/Investment/Goal Intelligence | Partially real: `lib/ai/services/reasoning-engine.service.ts` already does trend explanation, period comparison, subscription detection, and cash-flow forecasting; `lib/engine/financial-engine.ts` and `health-score-engine.ts` already cover savings rate, portfolio allocation, and goal-progress scoring. What's genuinely missing per-engine: weekend/seasonal spending patterns (1), diversification/volatility/concentration risk scoring (3) — neither built this pass, see below. |
| 4. Tax Intelligence | `calculate_tax_estimate` (Phase 1 AI tool) covers the estimate; a document-driven "missing documents checklist" is genuinely new and not built this pass. |

## What's genuinely new and not covered anywhere: built this pass

**Scenario Simulator (Deliverable 13)** — `lib/ai/services/scenario-
simulator.service.ts`. Four scenarios, matching the brief's own examples
exactly:
- "What if salary increases by X%?"
- "What if rent/an expense increases by ₹X?"
- "What if I invest ₹X more per month?"
- "What if I pay off my loan early?"

Each reuses `FinancialEngine` and `lib/calculations/debtCalculator.ts`
rather than re-deriving projections, and returns the new `ExplainableInsight`
shape: observation, evidence, reasoning, **assumptions stated explicitly**,
suggested actions, a confidence level, and an `isEstimate: true` flag on
every result — satisfying Deliverable 11's exact requirement ("never
produce unexplained recommendations") for this feature specifically.

Wired into **both** surfaces, sharing one implementation:
- The AI Copilot's chat, via a new `simulate_scenario` tool
  (`lib/ai/tools/definitions.ts` + `executor.ts`) — ask "what if I invest
  ₹5,000 more?" in chat and it calls this directly.
- A standalone endpoint, `app/api/ai/scenario-simulator/route.ts`, for a
  future dedicated "What If" page that shouldn't need a chat turn to run one.

### Notable honesty in the SIP-increase scenario
Its confidence level is deliberately `'Low'`, not `'Medium'` like the other
three scenarios — because it's the only one whose projection depends on an
assumed market return (10% annual, clearly labeled as illustrative, not
predictive) rather than just arithmetic on known numbers. Confidence isn't
a fixed field per scenario type; it reflects how much the specific
projection actually depends on an uncertain external assumption.

### Loan payoff scenario reuses existing amortization math
Rather than adding a second interest-calculation formula, this reconstructs
the remaining amortization schedule from the debt's outstanding balance,
rate, and current EMI using the exact same functions
(`generateAmortizationSchedule`, `totalInterestPayable`) `lib/calculations/
debtCalculator.ts` already provides — the assumption this introduces (that
reconstruction is an estimate, not the loan's actual official schedule) is
stated explicitly in the result's `assumptions` array.

## What's not built this pass, and why
- **Investment Intelligence's risk/diversification/concentration scoring** —
  genuinely new math (e.g. Herfindahl-style concentration index across
  holdings), not a refactor of something existing. Good candidate for a
  focused next pass rather than folding in alongside Scenario Simulator.
- **Weekly/Monthly reports, PDF export** — needs the `docx`/`pdf` skill
  infrastructure wired to real aggregated data; a UI+export feature more
  than a reasoning engine, better scoped on its own.
- **AI Memory** (preferences, not sensitive data) — a real, buildable
  feature (a `user_preferences` table + explicit consent flow), deferred
  because the brief's own constraint ("do not infer or store sensitive
  personal information without explicit user consent") deserves a dedicated
  pass to get the consent UX right, not a rushed add-on here.
- **Recommendation Center** (dismiss/save persisted state) — straightforward
  once there's more than one recommendation *source* worth centralizing;
  most of those sources (Explainable AI, Scenario Simulator, existing
  Recommendation Engine) are now real, which makes this the natural next
  thing to build.

## Verified
`tsc --noEmit` on every new/changed file (`scenario-simulator.service.ts`,
`types.ts`, `tools/definitions.ts`, `tools/executor.ts`'s new function,
`prompt-orchestrator.service.ts`, the new API route) shows **zero errors of
any kind** — not even the pre-existing Supabase-generic pattern, since this
feature's core logic is pure computation over an already-built
`FinancialContext`.
