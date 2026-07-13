# 1 — Production Readiness Audit

Grep-verified findings against the actual codebase, not a generic checklist.

## The one that matters most: toasts are silently broken app-wide

**28 files call `toast(...)` from `sonner`** (forms, Debt, Automation,
Settings, Documents, Investments...) but **`<Toaster />` is never mounted
anywhere** — not in `app/layout.tsx`, not in any nested layout. Every one of
those 28 calls executes without error and produces **zero visible feedback**.
A user submitting `AddTransactionForm` today gets no confirmation and no
error message if something fails — the code that was written to tell them
is just never rendered. This is the highest-value single fix available in
this pass, and it's a one-line change. Fixed in this delivery — see
`03-error-handling-and-notifications.md`.

## No route-level error boundaries
Zero `error.tsx` files exist anywhere in `app/`, at any level. One
`app/(app)/loading.tsx` exists; nothing else. If any Server Component throws
(a failed Supabase query, a bad RPC call), the user sees Next.js's default,
unstyled error screen — completely off-brand from the "premium dark
experience" the rest of the app maintains. No `not-found.tsx` either, so a
bad URL gets the same default treatment. Fixed in this delivery.

## Search is a non-functional placeholder
`components/layout/TopBar.tsx` renders `"Search or type a command…"` as
static text with a `Ctrl K` badge next to it — there's no command palette,
no keyboard listener, no search index. It looks complete; it does nothing.
Part 7's ask ("global search across Accounts, Transactions, ...") starts
from zero, not from a partial implementation. Scoped as a follow-up (design
doc: `05-search-experience-plan.md`), not built this pass — a real search
needs an indexing strategy decision first, not just UI.

## Zero rate limiting anywhere
No file in `lib/` or `app/api/` implements request throttling. This is most
urgent on `/api/copilot/*` specifically — every chat message costs a Groq
API call with no per-user or per-IP limit, meaning a runaway client loop or
a malicious actor could generate unbounded API spend with no code-level
guard. Full recommendation in `05-security-report.md`.

## Validation is inconsistent
Only 1 file in the entire codebase imports `zod`. Every other Server Action
and API route either trusts its input shape or validates ad hoc inline —
including the AI Copilot routes added in earlier phases, which `await
req.json()` and destructure directly with no schema check.

## What's already solid (worth not touching)
- `sonner` itself is a reasonable, already-adopted choice for toasts — the
  fix is mounting it, not replacing it with something else.
- The design token system (`T` object pattern used throughout dashboard/
  copilot components, CSS vars in `globals.css`) is consistent and already
  supports the dark theme correctly everywhere it's used.
- Settings is already reasonably close to the target category structure
  (Profile, Theme/Appearance, Notifications, Security, Backup, Import/
  Excel Migration, Integrations) — see `06-settings-redesign-plan.md` for
  the gap analysis rather than a rebuild.
- RLS is consistently applied on every table across all three phases of
  this project's work so far — a real strength, not just an audit checkbox.

## Accessibility spot-check
9 `aria-*` attribute usages found across all of `components/`; 1 `<img>` /
`next/image` usage with no alt-text audit performed on it. This is not
remotely close to WCAG 2.2 AA. Full findings in `04-accessibility-report.md`
— this needs a dedicated pass, not a few line-item fixes, so it's scoped as
a plan rather than attempted piecemeal here.

## Performance
Not independently re-audited beyond what Phase 2's audit already found
(duplicate Supabase fetch fans between dashboard and AI Copilot context
building). No new bundle-analyzer run performed this pass — flagged as a
next step in `10-release-checklist-and-tech-debt.md` rather than guessed at.
