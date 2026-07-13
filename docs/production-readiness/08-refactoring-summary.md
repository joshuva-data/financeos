# 8 — Refactoring Summary

Cumulative view across all phases of this project's work to date — useful
as a single reference rather than re-reading three separate change logs.

## Phase 1 — AI Copilot rebuild
- Wired a fully-built-but-orphaned AI layer (Context Builder, Recommendation
  Engine, tool executor) into the actual chat route for the first time.
- Fixed a dead import (`getNetWorthBreakdown`, never defined) and a missing
  `calendar_events` table (queried but never created).
- Switched LLM provider from a planned Anthropic integration to Groq.
- Fixed 7 separate RLS violations caused by missing `user_id` on inserts.

## Phase 2 — Architectural foundation
- Audited and confirmed net worth was computed independently in 9 places
  (including 2 files from Phase 1's own AI layer).
- Built `lib/engine/financial-engine.ts` as the mandatory single source of
  truth for net worth, cash flow, debt ratio, emergency fund coverage,
  budget utilization, portfolio allocation, and investment performance.
- Migrated the AI Context Builder and tool executor onto it.
- Refactored `lib/supabase/queries/dashboard.ts` onto it too — **which
  turned out to be dead code**, discovered in the next phase.

## v2 — Financial Health Engine
- Built `lib/engine/health-score-engine.ts`: an 8-category weighted health
  score with graceful degradation for categories with no underlying data
  (Budget Adherence — no budgets table exists).
- **Discovered the Phase 2 dead-code issue**: the real, live dashboard path
  is `PremiumDashboard.tsx`, not `lib/supabase/queries/dashboard.ts`.
  Refactored the actual live component onto the Financial Engine, closing a
  4th net-worth implementation and a 3rd health-score formula that the
  original Phase 2 audit had missed because it only grepped for files, not
  runtime import graphs.
- Added health-score history tracking via the existing (previously unused)
  `metadata` jsonb column on `net_worth_snapshots` — zero migration needed.

## v3 — This pass
- Discovered and fixed: `sonner`'s `<Toaster />` was never mounted, so 28
  files' worth of `toast()` calls have been silently producing no visible
  UI since whenever those forms were written.
- Added themed route-level error boundaries (`error.tsx`, `not-found.tsx`)
  — previously zero existed anywhere in the app.

## Pattern worth naming
Two of the three phases before this one shipped something described as
"the real fix" that turned out, on the next pass, to have missed the actual
live code path. That's a direct consequence of grep-based auditing without
tracing the runtime import graph. **Recommendation for future passes**: when
claiming a duplicate-logic fix is complete, verify the *replaced* file is
actually imported by the route/page that renders in production — not just
that the new code compiles and the old code still exists somewhere.
