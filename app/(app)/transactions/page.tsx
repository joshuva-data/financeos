import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TransactionsModule } from '@/components/transactions/TransactionsModule'

export const metadata: Metadata = { title: 'Transactions' }

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; type?: string; q?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const page = Math.max(1, Number(params.page ?? 1))
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('txn_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (params.category) query = query.eq('category', params.category)
  if (params.type) query = query.eq('txn_type', params.type as any)
  if (params.from) query = query.gte('txn_date', params.from)
  if (params.to) query = query.lte('txn_date', params.to)
  if (params.q) query = query.ilike('description', `%${params.q}%`)

  const { data: transactions, count } = await query
  const { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', user.id)

  return (
    <TransactionsModule
      transactions={transactions ?? []}
      accounts={accounts ?? []}
      total={count ?? 0}
      page={page}
      pageSize={pageSize}
      filters={{ category: params.category, type: params.type, q: params.q, from: params.from, to: params.to }}
    />
  )
}