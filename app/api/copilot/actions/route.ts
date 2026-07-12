// ============================================================================
// app/api/copilot/actions/route.ts
//
// Action Center — list endpoint. Returns the user's proposed/confirmed/
// executed actions (Requirement 8). Creation happens as a side effect of
// the chat route when the Prompt Orchestrator detects an actionable intent;
// this route is read-only plus a manual-propose escape hatch for the UI's
// "quick action" buttons (e.g. "Generate this month's report").
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listActions, persistProposedAction } from '@/lib/ai/actions/action-store'
import { proposeReport } from '@/lib/ai/services/action-generator.service'
import { buildFinancialContext } from '@/lib/ai/services/context-builder.service'
import type { ProposedActionType } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') as
    | 'proposed' | 'confirmed' | 'rejected' | 'executed' | 'failed' | null

  try {
    const actions = await listActions(supabase, user.id, status ?? undefined)
    return NextResponse.json({ actions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Manual propose, used by UI quick-action buttons rather than chat intent
// detection. Still only ever creates a 'proposed' row — confirmation is a
// separate, explicit step via /api/copilot/actions/[id].
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { actionType } = await req.json() as { actionType: ProposedActionType }

    if (actionType !== 'generate_report') {
      return NextResponse.json({ error: 'Only generate_report supports manual propose currently' }, { status: 400 })
    }

    const ctx = await buildFinancialContext(supabase, user.id)
    const action = proposeReport('monthly_summary', ctx)
    const id = await persistProposedAction(supabase, user.id, action, null)

    return NextResponse.json({ action: { ...action, id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
