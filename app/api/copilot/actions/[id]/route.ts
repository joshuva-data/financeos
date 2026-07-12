// ============================================================================
// app/api/copilot/actions/[id]/route.ts
//
// The explicit-confirmation gate for the Action Center (Requirement 8).
// PATCH { decision: 'confirm' } is the ONLY path in the entire app that can
// move a proposed action forward — and it only runs in direct response to a
// user clicking "Confirm" in the UI, never automatically.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confirmAndExecuteAction, rejectAction } from '@/lib/ai/actions/action-store'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { decision } = await req.json() as { decision: 'confirm' | 'reject' }

  try {
    if (decision === 'reject') {
      await rejectAction(supabase, user.id, id)
      return NextResponse.json({ status: 'rejected' })
    }

    if (decision === 'confirm') {
      const result = await confirmAndExecuteAction(supabase, user.id, id)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'decision must be "confirm" or "reject"' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
