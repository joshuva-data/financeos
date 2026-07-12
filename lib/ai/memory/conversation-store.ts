// ============================================================================
// lib/ai/memory/conversation-store.ts
//
// CONVERSATION MEMORY
// ----------------------
// Backs Requirement 9: follow-up questions should reuse previously discussed
// financial context without the user repeating themselves. In-session this
// already happens because the client sends the running `history` array on
// every request — this store adds durability across reloads/devices by
// persisting each turn to `copilot_conversations` / `copilot_messages`.
//
// The Prompt Orchestrator loads the last N turns of a conversation before
// building the Claude request, so long-running threads don't need the client
// to resend everything, and a conversation resumed later still has context.
// ============================================================================

import type { SupabaseServerClient } from '../types'
import type { CopilotTurn } from '../types'

type Client = SupabaseServerClient

const MAX_TURNS_LOADED = 20

export async function getOrCreateConversation(
  supabase: Client,
  userId: string,
  conversationId?: string | null
): Promise<string> {
  if (conversationId) {
    const { data } = await supabase
      .from('copilot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) return data.id
  }

  const { data, error } = await supabase
    .from('copilot_conversations')
    .insert({ title: 'New conversation' })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return data.id
}

export async function loadRecentTurns(
  supabase: Client,
  conversationId: string
): Promise<CopilotTurn[]> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_TURNS_LOADED)
  if (error) throw new Error(error.message)
  return (data ?? []).reverse().map(m => ({ role: m.role, content: m.content }))
}

export async function appendTurn(
  supabase: Client,
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolsUsed: string[] = [],
  recommendationIds: string[] = []
) {
  const { error } = await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role,
    content,
    tools_used: toolsUsed,
    recommendation_ids: recommendationIds,
  })
  if (error) throw new Error(error.message)

  // Keep the conversation's title fresh on the first user message, and bump
  // last_message_at so the conversation list sorts correctly.
  const updates: Record<string, unknown> = { last_message_at: new Date().toISOString() }
  if (role === 'user') {
    const { count } = await supabase
      .from('copilot_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
    if ((count ?? 0) <= 1) updates.title = content.slice(0, 60)
  }
  await supabase.from('copilot_conversations').update(updates).eq('id', conversationId).eq('user_id', userId)
}

export async function listConversations(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('copilot_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(error.message)
  return data ?? []
}
