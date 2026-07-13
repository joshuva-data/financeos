# 2 & 3 — UX and Performance Improvements

## UX — fixed this pass
- **Toasts now actually render** (`<Toaster />` mounted in `app/layout.tsx`)
  — the single highest-impact UX fix available, since it makes 28 already-
  written feedback messages visible for the first time.
- **Themed error boundaries** added (`app/error.tsx`, `app/(app)/error.tsx`,
  `app/not-found.tsx`) — a thrown error or bad URL now shows a dark-themed,
  on-brand screen with a retry action instead of Next.js's default page.

## UX — scoped, not built this pass
- **Global search** is currently a non-functional placeholder (see audit).
  Recommend `cmdk` (already a natural fit alongside the existing
  `@radix-ui/*` primitives) wired to a new `/api/search` route that queries
  across the modules listed in Part 7 of the brief. This is a multi-day
  feature on its own — indexing strategy, keyboard shortcut registration,
  and result ranking all need real design, not just a UI shell.
- **Empty states, loading skeletons, form consistency**: the Design System
  plan from the earlier architecture phase (`KpiCard`, `EmptyState`,
  `LoadingSkeleton`, etc.) already covers this; it wasn't built as code in
  that pass either. Recommend building it now that there's a concrete,
  proven consumer pattern (the AI Copilot's `ActionCenterPanel.tsx` already
  has both a loading state and an empty state that could become the first
  real implementations of `LoadingSkeleton` and `EmptyState`).

## Performance
No new profiling was run this pass (would require a live instance, not
static analysis). Carried forward from the earlier architecture audit,
still unaddressed:
- Dashboard load and any AI Copilot chat turn each independently run a
  ~13-query fan against Supabase, with no request-scoped caching between
  them.
- No component-level code splitting (`next/dynamic`) found anywhere —
  `PremiumDashboard.tsx` (now ~1185 lines) and `AICopilotPage.tsx` both ship
  their full chart/panel code in the initial client bundle for their route.

**Recommended first performance fix** (not done this pass, but well-scoped
for the next one): lazy-load the three AI Copilot tab panels
(`ExecutiveBriefPanel`, `ActionCenterPanel`) with `next/dynamic`, since a
user opening the Copilot to chat pays the bundle cost of two panels they may
never click into. Same pattern applies to Recharts-heavy sections of the
dashboard.
