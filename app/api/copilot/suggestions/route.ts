import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadFinancialSnapshot } from '@/lib/ai/context/financialSnapshot'
import { generateSuggestions } from '@/lib/ai/context/dynamicSuggestions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snapshot  = await loadFinancialSnapshot(supabase, user.id)
    const questions = generateSuggestions(snapshot)
    return NextResponse.json({ questions, snapshot: {
      netWorth:       snapshot.netWorth,
      liquidCash:     snapshot.liquidCash,
      monthlyIncome:  snapshot.monthlyIncome,
      overdueAmount:  snapshot.overdueReceivables,
      upcomingRenewals: snapshot.upcomingRenewals.length,
    }})
  } catch (err) {
    console.error('[Suggestions API]', err)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}