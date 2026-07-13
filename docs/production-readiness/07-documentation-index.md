# 7 — Documentation

## What already exists
- `docs/architecture/` (12 files) — audit, Financial Engine, Event Bus,
  Shared Services, AI Context Builder, Document Pipeline, Automation Engine,
  Design System, Performance & Security, Folder Structure, Database
  Recommendations, Implementation Roadmap.
- `docs/architecture/v2-feature1-financial-health-engine.md` — the
  Financial Health Engine's design and what's actually wired up vs. planned.
- `docs/production-readiness/` (this folder) — production audit, security,
  accessibility, UX/performance, testing plan, and this index.
- `CHANGES.md` (repo root) — the AI Copilot provider switch to Groq and the
  RLS `user_id` bugfix, from earlier in this project's work.

## Gaps against Part 13's specific list
| Requested | Status |
|---|---|
| Architecture | ✅ `docs/architecture/*` |
| Folder Structure | ✅ `docs/architecture/10-folder-structure-proposal.md` |
| Financial Engine | ✅ `docs/architecture/02-financial-engine-design.md` + inline comments in `lib/engine/financial-engine.ts` |
| Automation Engine | ✅ design only — `docs/architecture/07-automation-engine-design.md`; not yet built as code |
| AI Context Builder | ✅ `docs/architecture/05-ai-context-builder-design.md` + inline comments in `lib/ai/services/context-builder.service.ts` |
| Database | Partial — `docs/architecture/11-database-recommendations.md` covers *additions*; no full schema reference doc exists for the pre-existing schema |
| Events | ✅ design only — `docs/architecture/03-event-bus-design.md`; durable log not yet built |
| Shared Services | ✅ `docs/architecture/04-shared-services-plan.md` |
| Testing | ✅ `docs/production-readiness/06-testing-plan.md` |
| Deployment | ❌ Not written — no doc currently walks through the actual Vercel + Supabase deployment steps this project has been using in conversation (migration application, env var setup). Recommended as a genuinely new doc, not just a gap-fill, since it doesn't exist in any form yet. |

## Recommendation
Rather than write a "Deployment" doc speculatively, it should be written by
capturing the exact steps already used successfully in this project's
history — apply migrations via Supabase SQL Editor, `npm install
--legacy-peer-deps`, environment variable list, Vercel env var setup — as a
single `docs/DEPLOYMENT.md`. Not included in this pass; flagged as a
concrete, quick next addition since the steps already exist, just not in a
committed file.
