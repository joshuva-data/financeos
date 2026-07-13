# 10 — Remaining Technical Debt

Ranked by risk × effort-to-fix, not just severity alone.

## High risk, low effort (fix next)
1. **No rate limiting on `/api/copilot/*`** — direct cost exposure, small fix.
2. **`lib/supabase/queries/dashboard.ts` is dead code** — harmless today, but
   a future engineer (or AI assistant) could easily "fix" it again, wasting
   effort on a file nothing renders. Either delete it or add a top-of-file
   comment explaining it's unused, pending a decision either way.
3. **`.env.example` key rotation** — can't be verified remotely; needs a
   human to confirm or act.

## High risk, higher effort
4. **Zero test coverage** — every refactor in this project's history (three
   separate net-worth implementations found and "fixed" across three
   phases) is exactly the failure mode automated tests catch cheaply. See
   `06-testing-plan.md`.
5. **No rate limiting or cost ceiling on Groq usage generally** — same root
   issue as #1 but broader; worth a dedicated look once usage patterns are
   real (post-beta) rather than guessed at now.
6. **Global search is vaporware** — visually present, functionally absent.
   Either build it before beta or remove the placeholder so it doesn't
   mislead users into thinking it works.

## Medium risk
7. **`@supabase/ssr` / `@supabase/supabase-js` version skew** — causes
   widespread `never`-type errors across the codebase, tolerated today via
   `ignoreBuildErrors: true`. Not urgent (doesn't affect runtime), but
   makes the editor's type-checking unreliable app-wide, which slows down
   every future change by removing a safety net that should be free.
8. **Accessibility** — see `04-accessibility-report.md`; not urgent for a
   single-user personal app, becomes urgent fast if this ever supports
   multiple users or is submitted anywhere requiring compliance.
9. **Duplicate Supabase fetch fans** (dashboard vs. AI Copilot context
   builder) — a performance cost today, will compound as data volume grows.

## Lower risk / can wait
10. **Bundle size / code splitting** — no evidence of a current problem
    (no bundle analyzer run to confirm one way or the other), but no
    mitigation exists either. Reasonable to defer until there's a measured
    number to react to.
11. **Design System components** (`KpiCard`, `EmptyState`, etc.) — designed
    in Phase 2, never built. Each new UI addition since then (the Financial
    Health card, error boundaries) has hand-rolled its own markup rather
    than waiting on components that don't exist yet — a reasonable
    trade-off each time individually, but the debt compounds the longer the
    shared components don't exist.
12. **Automation Engine and Document Pipeline** are fully designed
    (Phase 2) but not built as code — the largest remaining "designed but
    not real" gap in the whole project. Both depend on the Event Bus's
    durable log, which is also design-only.

## Honest meta-note
This project now has four rounds of "audit, find duplication, fix the
highest-value instance, defer the rest" behind it. That pattern is working
— each pass has found and fixed something real — but the deferred list
keeps growing roughly as fast as it shrinks. At some point the highest-
leverage move stops being "audit again" and starts being "spend a pass
clearing the top 3 items on this list end to end." Worth deciding
explicitly which mode the next pass should be, rather than defaulting to
another audit.
