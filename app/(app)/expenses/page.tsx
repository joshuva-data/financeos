import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ExpensesModule } from '@/components/expenses/ExpensesModule'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now            = new Date()
  const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLast    = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLast      = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const [{ data: thisMonth }, { data: lastMonth }, { data: accounts }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user.id)
      .eq('direction', 'debit').gte('txn_date', startOfMonth)
      .order('txn_date', { ascending: false }),
    supabase.from('transactions').select('amount, direction, category').eq('user_id', user.id)
      .eq('direction', 'debit').gte('txn_date', startOfLast).lte('txn_date', endOfLast),
    supabase.from('accounts').select('id, name').eq('user_id', user.id).eq('status', 'active'),
  ])

  return (
    <ExpensesModule
      thisMonth={thisMonth ?? []}
      lastMonth={lastMonth ?? []}
      accounts={accounts ?? []}
    />
  )
}
