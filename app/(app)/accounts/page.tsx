import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AccountsModule } from '@/components/accounts/AccountsModule'

export const revalidate = 0
export const metadata: Metadata = { title: 'Accounts' }

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: accounts }, { data: recentTxns }] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('balance', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', user.id)
      .order('txn_date', { ascending: false }).limit(10),
  ])

  return <AccountsModule accounts={accounts ?? []} recentTxns={recentTxns ?? []} />
}