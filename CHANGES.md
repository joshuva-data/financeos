# AI Copilot Rebuild — Summary of Changes

## Provider: Groq (not Anthropic)
Per your request, the orchestrator uses **Groq's OpenAI-compatible chat completions
API with tool/function calling** (`groq-sdk`, model `llama-3.3-70b-versatile` by
default, overridable via `GROQ_MODEL`). `@anthropic-ai/sdk` was removed from
`package.json` since nothing uses it anymore. Tool schemas are stored provider-
neutral in `lib/ai/tools/definitions.ts` and adapted to Groq's function-calling
shape inside the orchestrator — so swapping providers again later only touches
one adapter function.

## What was actually broken (found during audit)
- `app/api/copilot/route.ts` called Groq directly with a **generic system prompt
  and zero access to your data** — every answer was generic advice, not reasoning
  over FinanceOS. This was the only code path actually wired to the chat UI.
- `lib/ai/context/context-builder.ts`, `lib/ai/context/copilot.ts`, and
  `lib/ai/context/orchestrator/copilot.ts` were **fully-built but never imported
  anywhere** — dead code with real logic in it.
- `lib/ai/context/tools/executor.ts` imported `getNetWorthBreakdown` from
  `lib/calculations/networth.ts`, which **does not export that function** — a
  dead import that (if `ignoreBuildErrors` were ever turned off) would fail
  compilation.
- `calendar_events` was queried by the executor and by `lib/notifications/engine.ts`
  but **the table was never declared in `types/database.ts` or created via
  migration.**

## New/rebuilt AI layer (`lib/ai/`)
```
lib/ai/
  types.ts                                 — shared vocabulary (FinancialContext, Recommendation,
                                              ExecutiveBrief, ProposedAction, forecast/trend/comparison types)
  services/
    context-builder.service.ts             — Context Builder: all 13 modules
    reasoning-engine.service.ts            — Financial Reasoning Engine: trends, period
                                              comparisons, cash-flow forecasts, subscription detection
    recommendation-engine.service.ts       — Recommendation Engine + Executive Brief generator
    action-generator.service.ts            — Action Generator: builds ProposedAction objects (never executes)
    prompt-orchestrator.service.ts         — Prompt Orchestrator: Groq tool-calling loop + system prompt
  tools/
    definitions.ts                         — provider-neutral tool schema (19 tools)
    executor.ts                            — tool execution against Supabase (bug fixed: dead import removed)
  actions/
    action-store.ts                        — Action Center persistence + guarded execution
  memory/
    conversation-store.ts                  — durable conversation memory (DB-backed)
```
`lib/ai/context/financialSnapshot.ts` and `dynamicSuggestions.ts` were **kept as-is**
(they power the existing `/api/copilot/suggestions` endpoint and weren't broken).
The dead files listed above were removed since their logic now lives, properly
wired, in `lib/ai/services/`.

## Database changes
- **`supabase/migrations/0001_ai_copilot_layer.sql`** — adds `calendar_events`
  (fixes the pre-existing gap), `copilot_conversations`, `copilot_messages`,
  `copilot_actions`, `automations`. All with RLS scoped to `auth.uid()`.
- **`types/database.ts`** — added matching Row/Insert/Update types and registered
  the new tables in `Database['public']['Tables']`.

Run `supabase db push` (or apply the SQL directly) before deploying.

## API routes
- `app/api/copilot/route.ts` — **rewired**. Same `{query, history} → {answer}`
  contract as before (nothing breaks for existing callers), plus new optional
  fields: `conversationId`, `toolsUsed`, `recommendations`, `proposedActions`.
- `app/api/copilot/brief/route.ts` — **new**. Executive Financial Brief.
- `app/api/copilot/actions/route.ts` — **new**. List/manually-propose actions.
- `app/api/copilot/actions/[id]/route.ts` — **new**. The only endpoint that can
  move an action past `proposed` — requires an explicit `PATCH {decision}` call.

## Frontend (`components/copilot/`)
- `AICopilotPage.tsx` — **rebuilt**. Same chat UX as before, now in a "Chat" tab
  alongside new "Executive Brief" and "Action Center" tabs. Also fixes hardcoded
  light-mode classes (`bg-white`, `text-gray-900`, `bg-blue-50`, etc.) that broke
  in your dark theme — everything now uses theme CSS variables (`bg-card`,
  `text-foreground`, `bg-primary`, etc.), matching the rest of the app.
- `ExecutiveBriefPanel.tsx` — **new**. Strengths / risks / opportunities /
  upcoming events / recommendations.
- `ActionCenterPanel.tsx` — **new**. Proposed actions with explicit Confirm/Reject.

## A pre-existing issue you should know about (not introduced by this change)
Running `tsc --noEmit` across the whole repo surfaces a large number of
`Property 'x' does not exist on type 'never'` errors — in files this rebuild
never touched (`lib/actions/automation.ts`, `components/settings/*`,
`components/insurance/*`, etc.). Root cause: `@supabase/supabase-js` resolved to
`2.108.1` while `@supabase/ssr` is pinned to `0.5.2`, and the two don't agree on
the `SupabaseClient<Database>` generic shape anymore. `next.config.ts` already
has `typescript: { ignoreBuildErrors: true }`, so this doesn't block your Vercel
builds — but it does mean your editor's type-checking is currently unreliable
app-wide. I typed the new AI-layer files against the real return type of your
`createClient()` so they're internally consistent with the rest of the app
either way, but the underlying version-skew is worth fixing (`npm install
@supabase/ssr@latest`) when you have a slot for it, ideally with a test pass
since it's a bigger, unrelated change.

## Also worth knowing
`.env.example` had what looked like **live Supabase and Anthropic keys checked
into git as "example" values**. I redacted them to placeholders and swapped the
AI section to `GROQ_API_KEY` / `GROQ_MODEL`. If those keys are real, rotate them.
