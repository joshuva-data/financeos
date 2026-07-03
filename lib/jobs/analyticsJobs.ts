import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { summarizeCashflow } from '@/lib/calculations/cashflowCalculator'

type Client = SupabaseClient<Database>

export async function computeMonthlyAnalytics(supabase: Client, userId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, direction, category')
    .eq('user_id', userId)
    .gte('txn_date', startDate)
    .lte('txn_date', endDate)

  if (!txns) return null

  const summary = summarizeCashflow(txns)

  return {
    period: { year, month, startDate, endDate },
    ...summary,
    generatedAt: new Date().toISOString(),
  }
}