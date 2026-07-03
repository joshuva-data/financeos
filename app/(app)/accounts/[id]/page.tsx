import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountDetailModule } from '@/components/accounts/AccountDetailModule'

export const metadata: Metadata = { title: 'Account Detail' }

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: account }, { data: txns }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('transactions').select('*').eq('account_id', params.id)
      .order('txn_date', { ascending: false }).limit(50),
  ])

  if (!account) notFound()
  return <AccountDetailModule account={account} transactions={txns ?? []} />
}