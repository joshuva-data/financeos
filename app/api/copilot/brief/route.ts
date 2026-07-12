// ============================================================================
// app/api/copilot/brief/route.ts
//
// Executive Financial Brief — Requirement 4. A proactive summary (strengths,
// risks, opportunities, upcoming events) computed from the same
// FinancialContext the chat uses, so the brief and any chat answer about
// "how am I doing" are always consistent with each other.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFinancialContext } from '@/lib/ai/services/context-builder.service'
import { generateExecutiveBrief, generateRecommendations } from '@/lib/ai/services/recommendation-engine.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await buildFinancialContext(supabase, user.id)
    const brief = generateExecutiveBrief(ctx)
    const recommendations = generateRecommendations(ctx)

    return NextResponse.json({ brief, recommendations })
  } catch (err) {
    console.error('[Copilot Brief]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
