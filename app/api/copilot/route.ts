// ============================================================================
// app/api/copilot/route.ts
//
// Main Copilot chat endpoint. Previously this called Groq directly with a
// generic system prompt and zero access to the user's actual data — every
// answer was generic advice, not reasoning over FinanceOS's modules. This
// version wires in the full AI layer:
//
//   Context Builder → Prompt Orchestrator (Groq tool-calling loop) → answer
//                            ↓
//                  Conversation memory (persisted)
//                            ↓
//                  Action Center proposals (persisted, unexecuted)
//
// Backward compatible: the request/response contract ({query, history} ->
// {answer}) that the existing chat UI already relies on is unchanged — new
// fields (conversationId, toolsUsed, recommendations, proposedActions) are
// additive, so older callers keep working untouched.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFinancialContext } from '@/lib/ai/services/context-builder.service'
import { generateRecommendations } from '@/lib/ai/services/recommendation-engine.service'
import { runCopilotTurn } from '@/lib/ai/services/prompt-orchestrator.service'
import { getOrCreateConversation, loadRecentTurns, appendTurn } from '@/lib/ai/memory/conversation-store'
import { persistProposedAction } from '@/lib/ai/actions/action-store'
import type { CopilotTurn } from '@/lib/ai/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query, history = [], conversationId: incomingConversationId } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'No query' }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        answer: '⚠️ Groq API key not set. Get a free key at console.groq.com → API Keys, then add GROQ_API_KEY to your .env.local (and Vercel env vars).',
      })
    }

    // 1. Context Builder — pull a fresh cross-module snapshot for this turn.
    const ctx = await buildFinancialContext(supabase, user.id)

    // 2. Conversation memory — resume a thread if given one, else start one,
    //    and load its persisted history so follow-ups work even if the
    //    client didn't resend everything (Requirement 9).
    const conversationId = await getOrCreateConversation(supabase, user.id, incomingConversationId)
    const persistedHistory = await loadRecentTurns(supabase, conversationId)
    const clientHistory: CopilotTurn[] = Array.isArray(history)
      ? history.map((h: { role: string; content: string }) => ({ role: h.role as 'user' | 'assistant', content: h.content }))
      : []
    // Prefer persisted history (source of truth); fall back to client-sent
    // history for a brand-new conversation the DB round-trip hasn't caught yet.
    const effectiveHistory = persistedHistory.length > 0 ? persistedHistory : clientHistory

    // 3. Prompt Orchestrator — the Groq tool-calling loop, reasoning across
    //    modules rather than the single generic system prompt used before.
    const result = await runCopilotTurn(supabase, user.id, ctx, effectiveHistory, query)

    // 4. Persist this turn (both sides) for durable conversation memory.
    await appendTurn(supabase, user.id, conversationId, 'user', query)
    await appendTurn(supabase, user.id, conversationId, 'assistant', result.answer, result.toolsUsed)

    // 5. Persist any proposed actions to the Action Center — proposed only,
    //    never executed here (Requirement 8).
    const persistedActionIds: string[] = []
    for (const action of result.proposedActions) {
      const id = await persistProposedAction(supabase, user.id, action, conversationId)
      persistedActionIds.push(id)
    }

    return NextResponse.json({
      answer: result.answer,
      conversationId,
      toolsUsed: result.toolsUsed,
      turnCount: result.turnCount,
      recommendations: generateRecommendations(ctx).slice(0, 3),
      proposedActions: result.proposedActions.map((a, i) => ({ ...a, id: persistedActionIds[i] })),
    })
  } catch (err) {
    console.error('[Copilot]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ answer: `Sorry, something went wrong (${message}). Please try again.` })
  }
}
