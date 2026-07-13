# 6 — Testing Plan

## Current state
No test files exist anywhere in the repository — confirmed absence of any
`*.test.ts`, `*.spec.ts`, or `__tests__/` directory. Zero automated
coverage. This section is a plan; introducing a full test suite is out of
scope to also implement in this same pass alongside the audit + one shipped
fix, per this project's established working pattern (do fewer things
completely rather than many things partially).

## Priority order (highest-value-per-effort first)

1. **`lib/engine/financial-engine.ts` and `lib/engine/health-score-engine.ts`**
   — pure functions, zero I/O, highest blast radius if wrong (every module
   and the AI Copilot both depend on these numbers being correct). This is
   the single best first test target in the codebase: fast to write, fast
   to run, catches the exact class of bug ("two things disagree on net
   worth") this project has spent three phases fixing.
2. **`lib/calculations/*`** — same rationale, one level down; these are what
   the Financial Engine wraps.
3. **AI tool executor** (`lib/ai/tools/executor.ts`) — integration-level
   (needs a Supabase test client or mocked client), verifies each of the 19
   tools returns the shape the Prompt Orchestrator expects.
4. **Document processing pipeline** — once built (see Phase 2's Document
   Pipeline design), each pipeline stage should be unit-tested in isolation
   given the "each stage should be modular" design goal; that modularity is
   exactly what makes per-stage testing cheap.
5. **Automation workflows** — once the Automation Engine execution loop is
   built, condition evaluation and retry logic are natural unit-test
   targets; end-to-end workflow execution is a better fit for integration
   tests against a seeded test database.
6. **Dashboard summaries** — snapshot/regression tests comparing
   `FinancialEngine` output against known-good fixture data, to catch
   accidental behavior changes during future refactors specifically (this
   project has now refactored net worth calculation three separate times
   across three phases — a regression test would have caught the dead-code
   discovery in the v2 pass immediately).

## Recommended tooling
`vitest` (already listed as the intended test runner per this project's own
stated tooling — "Vitest (used for AI safety layer unit tests)" — though no
actual test files were found, so that intent hadn't been executed on yet).
Vitest's speed and native TypeScript/ESM support fit this codebase's stack
without additional config beyond what a Next.js + TypeScript project
typically needs.

## Suggested first PR
A single file, `lib/engine/financial-engine.test.ts`, covering
`calculateNetWorth`, `calculateDebtRatio`, and `calculateHealthScore` against
5-6 fixture scenarios each (zero debt, high debt, no investments, etc.).
Small, immediately valuable, and establishes the pattern the rest of the
suite follows.
