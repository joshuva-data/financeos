# 9 — Release Checklist

Organized by the sub-checklists the brief asked for, marked against actual
verified state — not a generic template.

## Deployment
- [ ] Confirm `.env.example` secrets were rotated (flagged, unverifiable remotely)
- [ ] `GROQ_API_KEY` set in Vercel env vars (confirmed done earlier in this project's history)
- [ ] All migrations applied: `0001_ai_copilot_layer.sql` (Phase 1) — confirm `0002_phase2_foundation.sql` recommendations from Phase 2 were actually applied, since that doc was a recommendation, not an applied migration
- [ ] `npm run build` succeeds (tolerant of the known `@supabase/ssr` type-generic issue via `ignoreBuildErrors: true`)

## Security
- [ ] Rate limiting on `/api/copilot/*` — **not yet done**, see `05-security-report.md`
- [ ] `zod` validation at API route boundaries — **not yet done**
- [ ] File upload validation — **not yet done**, needed before Document Pipeline
- [x] RLS verified on every table across all phases

## Performance
- [ ] Bundle analyzer run — **not yet done**
- [ ] Lazy-load AI Copilot's Brief/Action Center panels — **not yet done**
- [ ] Resolve duplicate Supabase fetch fans (dashboard vs. Copilot context) — **not yet done**

## Accessibility
- [ ] Automated axe/Lighthouse pass — **not yet done**, needs a live instance
- [ ] Form label audit — **not yet done**
- [x] Radix-based dialogs get focus trapping for free (already correct)

## Regression / QA
- [ ] No test suite exists yet — see `06-testing-plan.md`; **manual QA is
      currently the only safety net**
- [ ] Manually verify: Copilot chat still answers with real numbers after
      this pass's changes (Toaster/error-boundary additions shouldn't affect
      it, but weren't in the same files touched by prior AI Copilot work)
- [ ] Manually verify: toasts now visibly appear on at least one form
      (e.g. `AddTransactionForm`) after this pass's fix

## Launch
- [ ] Global search — **not built**, currently a non-functional placeholder;
      decide whether to ship without it or block launch on it
- [ ] Settings categories — mostly present, gap-check against
      `06-settings-redesign-plan.md`'s target list before calling it complete
- [ ] Notification preferences — `NotificationSettings.tsx` exists; not
      independently verified this pass whether it's wired to real preference
      storage or still a UI mock

## What's actually ready today
RLS, the Financial/Health Engines' correctness (now single-sourced), and the
AI Copilot's core chat/brief/action-center flow are the most production-
solid parts of the app based on everything verified across all phases.
Toasts and error boundaries are newly fixed in this pass. Everything else
above marked unchecked is a genuine gap, not a formality.
