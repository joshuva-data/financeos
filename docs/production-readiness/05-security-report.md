# 5 — Security Report

## Findings

**No rate limiting anywhere** (confirmed: zero matches for rate-limiting
patterns in `lib/` or `app/api/`). Highest-priority target:
`/api/copilot/route.ts` — each request triggers a Groq API call with no
per-user throttle. Recommendation: a simple per-user sliding-window limiter
backed by a new small table or Upstash/Vercel KV if available, applied at
minimum to `/api/copilot/*` and any future document-upload/OCR endpoint
(OCR calls, once Part 6 of the v1 Phase 2 Document Pipeline design ships,
are similarly cost-bearing per request).

**Validation gap**: only 1 file uses `zod`. The AI Copilot routes
(`app/api/copilot/route.ts`, `.../actions/[id]/route.ts`) parse
`await req.json()` directly with no schema check — a malformed or
unexpectedly-shaped body currently fails deep inside a service function with
a less clear error than a schema validator would give at the boundary.
Recommendation: adopt `zod` schemas at every API route boundary,
prioritizing routes that accept free-form client input over routes that only
read.

**RLS — a genuine strength.** Every table added across all three phases of
this project's work (`copilot_*`, `calendar_events`, `automations`,
pre-existing core tables) consistently scopes to `auth.uid() = user_id`.
No table was found with RLS disabled or a broader-than-owner policy.

**Secrets**: `.env.example` was found in an earlier phase to contain what
appeared to be live keys committed as "example" values; already redacted.
**This report re-flags it because it can't verify from here whether those
keys were actually rotated** — that confirmation needs to happen on your
end if it hasn't already.

**File uploads**: no file-type or size validation was found at any upload
call site in `components/documents/*`. Recommend adding both — server-side,
not just an `accept=""` attribute on the input — before any OCR/extraction
pipeline goes live, since unvalidated uploads are the highest-risk input
surface once a Document Pipeline exists.

**Authentication**: every API route added in this project's AI Copilot work
checks `supabase.auth.getUser()` and returns 401 if absent — consistent,
good pattern to keep for any new route.

**Authorization beyond ownership**: none exists (no roles/permissions
system), which is appropriate for a single-user app today but is the first
design decision needed before any multi-tenant SaaS migration.

**Audit logging**: `copilot_actions` and `copilot_messages` already function
as a de facto audit trail for AI-driven actions specifically. No equivalent
exists for direct user actions (e.g., editing a transaction) — acceptable
for a single-user app, worth revisiting pre-multi-tenant.

## Priority order for fixes
1. Confirm `.env.example` keys were rotated (can't be verified remotely —
   action item for you, not code)
2. Rate limit `/api/copilot/*`
3. Add `zod` validation at the Copilot API route boundaries
4. File upload validation before the Document Pipeline ships
