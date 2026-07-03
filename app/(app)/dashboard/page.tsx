import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PremiumDashboard } from '@/components/dashboard/PremiumDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const in30Days     = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentFY    = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const [
    { data: accounts },
    { data: thisMonthTxns },
    { data: lastMonthTxns },
    { data: income },
    { data: debts },
    { data: goals },
    { data: insurance },
    { data: receivables },
    { data: investments },
    { data: profile },
    { data: tithe },
    { data: snapshots },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('transactions').select('*').eq('user_id', user.id).gte('txn_date', startOfMonth),
    supabase.from('transactions').select('amount, direction, category').eq('user_id', user.id)
      .gte('txn_date', startOfLast).lte('txn_date', endOfLast),
    supabase.from('income_entries').select('*').eq('user_id', user.id).eq('financial_year', currentFY),
    supabase.from('debt_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('financial_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('insurance_policies').select('*').eq('user_id', user.id).eq('status', 'active').lte('renewal_date', in30Days),
    supabase.from('receivables').select('*').eq('user_id', user.id).neq('status', 'received'),
    supabase.from('investments').select('*').eq('user_id', user.id),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('tithe_entries').select('amount, giving_date').eq('user_id', user.id)
      .gte('giving_date', startOfMonth),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date').limit(24),
  ])

  return (
    <PremiumDashboard
      accounts={accounts ?? []}
      thisMonthTxns={thisMonthTxns ?? []}
      lastMonthTxns={lastMonthTxns ?? []}
      income={income ?? []}
      debts={debts ?? []}
      goals={goals ?? []}
      insurance={insurance ?? []}
      receivables={receivables ?? []}
      investments={investments ?? []}
      tithe={tithe ?? []}
      userName={profile?.full_name ?? user.email ?? 'there'}
      currentFY={currentFY}
      userId={user.id}
      snapshots={snapshots ?? []}
    />
  )
}
