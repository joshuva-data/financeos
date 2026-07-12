// ============================================================================
// lib/ai/actions/action-store.ts
//
// ACTION CENTER — persistence & (guarded) execution
// -----------------------------------------------------------------------
// `persistProposedAction` stores an AI-generated ProposedAction in status
// 'proposed'. Nothing else in this file — or anywhere in the AI reasoning
// path — is allowed to move an action past 'proposed' on its own.
//
// `confirmAction` / `rejectAction` are the only functions that flip status,
// and they are only ever called from the Action Center API route in
// response to an explicit user click (Requirement 8).
//
// `executeConfirmedAction` performs the actual side effect (writing a
// category, creating a calendar_events row, etc.) and is only invoked
// immediately after confirmAction succeeds, from the same request — never
// from the chat/reasoning path.
// ============================================================================

import type { Database } from '@/types/database'
import type { SupabaseServerClient, ProposedAction } from '../types'

type Client = SupabaseServerClient

export async function persistProposedAction(
  supabase: Client,
  userId: string,
  action: ProposedAction,
  conversationId: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from('copilot_actions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      action_type: action.actionType,
      title: action.title,
      description: action.description,
      why: action.why,
      sources: action.sources,
      confidence: action.confidence,
      payload: action.payload as Database['public']['Tables']['copilot_actions']['Insert']['payload'],
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to persist proposed action: ${error.message}`)
  return data.id
}

export async function listActions(
  supabase: Client,
  userId: string,
  status?: 'proposed' | 'confirmed' | 'rejected' | 'executed' | 'failed'
) {
  let query = supabase.from('copilot_actions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function rejectAction(supabase: Client, userId: string, actionId: string) {
  const { error } = await supabase
    .from('copilot_actions')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Confirms an action and immediately executes its side effect. Both steps
 * happen in one call so an action can never sit in a "confirmed but
 * mysteriously not executed" limbo — but the confirmation step (the status
 * write) always happens first and is what the UI treats as the "point of no
 * return" the user consented to.
 */
export async function confirmAndExecuteAction(supabase: Client, userId: string, actionId: string) {
  const { data: action, error: fetchErr } = await supabase
    .from('copilot_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .single()
  if (fetchErr || !action) throw new Error('Action not found')
  if (action.status !== 'proposed') throw new Error(`Action is already ${action.status}`)

  await supabase.from('copilot_actions').update({ status: 'confirmed' }).eq('id', actionId)

  try {
    const result = await executeAction(supabase, userId, action)
    await supabase.from('copilot_actions').update({
      status: 'executed', result: result as Database['public']['Tables']['copilot_actions']['Update']['result'], resolved_at: new Date().toISOString(),
    }).eq('id', actionId)
    return { status: 'executed' as const, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed'
    await supabase.from('copilot_actions').update({
      status: 'failed', result: { error: message }, resolved_at: new Date().toISOString(),
    }).eq('id', actionId)
    throw err
  }
}

// ── Execution — the only place any confirmed action actually does something ──

async function executeAction(
  supabase: Client,
  userId: string,
  action: Database['public']['Tables']['copilot_actions']['Row']
): Promise<Record<string, unknown>> {
  switch (action.action_type) {
    case 'create_reminder': {
      const payload = action.payload as { label: string; dueDate: string; amount?: number }
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: payload.label,
          event_type: 'custom',
          event_date: payload.dueDate,
          amount: payload.amount ?? null,
          linked_id: null,
          linked_type: null,
          is_completed: false,
          notes: 'Created by AI Copilot Action Center',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { calendarEventId: data.id }
    }

    case 'suggest_automation': {
      const payload = action.payload as { subscriptions?: unknown[] }
      const { data, error } = await supabase
        .from('automations')
        .insert({
          user_id: userId,
          name: 'Subscription watch',
          description: 'Flags new recurring charges detected in transactions for review.',
          category: 'expenses',
          status: 'draft',
          trigger: { type: 'schedule', schedule: 'monthly' },
          conditions: [],
          actions: [{ type: 'flag_review', label: 'Flag new recurring charge' }],
          created_via_copilot: true,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { automationId: data.id, subscriptionCount: payload.subscriptions?.length ?? 0 }
    }

    case 'update_goal': {
      const payload = action.payload as { goalName: string; suggestedContribution: number }
      const { data: goal, error: findErr } = await supabase
        .from('financial_goals')
        .select('id, current_amount')
        .eq('user_id', userId)
        .eq('name', payload.goalName)
        .maybeSingle()
      if (findErr) throw new Error(findErr.message)
      if (!goal) throw new Error(`Goal "${payload.goalName}" not found`)
      const { error: updateErr } = await supabase
        .from('financial_goals')
        .update({ current_amount: goal.current_amount + payload.suggestedContribution })
        .eq('id', goal.id)
      if (updateErr) throw new Error(updateErr.message)
      return { goalId: goal.id, newAmount: goal.current_amount + payload.suggestedContribution }
    }

    case 'flag_for_review': {
      const payload = action.payload as { itemLabel: string }
      const { data, error } = await supabase
        .from('ai_insights')
        .insert({
          user_id: userId,
          insight_type: 'alert',
          title: `Flagged for review: ${payload.itemLabel}`,
          body: action.why,
          severity: 'info',
          is_read: false,
          is_dismissed: false,
          data_context: {},
          linked_module: action.sources[0] ?? null,
          expires_at: null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { insightId: data.id }
    }

    case 'categorize_transactions': {
      // A real bulk-categorization pass belongs in its own service (it needs
      // the full merchant-pattern matcher used by lib/parsers). Here we
      // record the request as an insight so it surfaces in Expenses and
      // return a clear, honest result rather than silently doing nothing.
      const { data, error } = await supabase
        .from('ai_insights')
        .insert({
          user_id: userId,
          insight_type: 'recommendation',
          title: 'Categorize uncategorized transactions',
          body: 'Requested via AI Copilot Action Center — open Expenses to review suggested categories.',
          severity: 'info',
          is_read: false,
          is_dismissed: false,
          data_context: action.payload,
          linked_module: 'Expenses',
          expires_at: null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { insightId: data.id, note: 'Queued for review in Expenses' }
    }

    case 'generate_report': {
      // Report generation renders client-side (existing docx/pdf tooling);
      // executing this action here just marks intent + returns the
      // parameters the UI needs to trigger that render.
      return { ready: true, reportType: (action.payload as { reportType?: string }).reportType ?? 'monthly_summary' }
    }

    default:
      throw new Error(`Unknown action type: ${action.action_type}`)
  }
}
