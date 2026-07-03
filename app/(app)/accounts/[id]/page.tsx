import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function AccountDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!account) notFound()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', params.id)
    .order('txn_date', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#f5f7fa' }}>
          {account.name}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#8b97a7' }}>
          {account.bank_name} · {account.account_type}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
          <p className="text-xs" style={{ color: '#8b97a7' }}>Balance</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#f5f7fa' }}>
            ₹{account.balance.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
          <p className="text-xs" style={{ color: '#8b97a7' }}>Account Type</p>
          <p className="text-sm font-semibold mt-1 capitalize" style={{ color: '#f5f7fa' }}>
            {account.account_type.replace('_', ' ')}
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>Recent Transactions</h2>
        {(transactions ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: '#8b97a7' }}>No transactions yet</p>
        ) : (transactions ?? []).map(txn => (
          <div key={txn.id} className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: '#1e252d' }}>
            <div>
              <p className="text-sm" style={{ color: '#f5f7fa' }}>
                {txn.description ?? txn.category}
              </p>
              <p className="text-xs" style={{ color: '#8b97a7' }}>{txn.txn_date}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums"
              style={{ color: txn.direction === 'credit' ? '#00C896' : '#ef4444' }}>
              {txn.direction === 'credit' ? '+' : '−'}₹{txn.amount.toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}