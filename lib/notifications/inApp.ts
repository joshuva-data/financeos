import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>
type InsightInsert = Database['public']['Tables']['ai_insights']['Insert']

export async function generateAIInsights(supabase: Client, userId: string): Promise<void> {
  const [insurance, debts, receivables, snapshots] = await Promise.all([
    supabase.from('insurance_policies').select('policy_name, renewal_date').eq('user_id', userId).eq('status', 'active').lte('renewal_date', in30Days()),
    supabase.from('debt_accounts').select('debt_to_income: emi_amount, lender_name, next_emi_date').eq('user_id', userId).eq('is_active', true),
    supabase.from('receivables').select('from_name, balance_due, status').eq('user_id', userId).eq('status', 'overdue'),
    supabase.from('net_worth_snapshots').select('net_worth, snapshot_date').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(2),
  ])

  const insights: InsightInsert[] = []

  // Insurance renewal alerts
  for (const policy of insurance.data ?? []) {
    const days = daysUntil(policy.renewal_date)
    insights.push({
      user_id: userId,
      insight_type: 'alert',
      title: `${policy.policy_name} renews in ${days} days`,
      body: `Review your ${policy.policy_name} policy. Consider comparing quotes before renewal.`,
      severity: days <= 7 ? 'critical' : 'warning',
      linked_module: 'insurance',
    })
  }

  // Overdue receivables
  if ((receivables.data ?? []).length > 0) {
    const total = (receivables.data ?? []).reduce((s, r) => s + r.balance_due, 0)
    insights.push({
      user_id: userId,
      insight_type: 'alert',
      title: `${receivables.data!.length} overdue receivable${receivables.data!.length > 1 ? 's' : ''}`,
      body: `₹${total.toLocaleString('en-IN')} is overdue. Follow up with ${receivables.data![0].from_name}${receivables.data!.length > 1 ? ` and ${receivables.data!.length - 1} others` : ''}.`,
      severity: 'warning',
      linked_module: 'receivables',
    })
  }

  // Net worth trend
  const nwData = snapshots.data ?? []
  if (nwData.length >= 2) {
    const growth = nwData[0].net_worth - nwData[1].net_worth
    if (growth > 0) {
      insights.push({
        user_id: userId,
        insight_type: 'recommendation',
        title: `Net worth grew by ₹${growth.toLocaleString('en-IN')}`,
        body: 'Your net worth is trending positively. Consider channelling surplus into your investment portfolio.',
        severity: 'info',
        linked_module: 'net-worth',
      })
    }
  }

  if (insights.length > 0) {
    await supabase.from('ai_insights').insert(insights)
  }
}

function in30Days(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}