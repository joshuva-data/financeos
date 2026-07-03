'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Account, Transaction } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface AccountDetailModuleProps { account: Account; transactions: Transaction[] }

export function AccountDetailModule({ account, transactions }: AccountDetailModuleProps) {
  const router = useRouter()
  const credits = transactions.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
  const debits  = transactions.filter(t => t.direction === 'debit').reduce((s, t)  => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="page-title">{account.name}</h1>
          <p className="text-xs text-muted-foreground">{account.bank_name} · {account.account_type.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Balance',       value: fmtINR(account.balance), icon: Activity,    color: 'text-primary' },
          { label: 'Total Credits', value: fmtINR(credits),          icon: TrendingUp,  color: 'text-positive' },
          { label: 'Total Debits',  value: fmtINR(debits),           icon: TrendingDown, color: 'text-destructive' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Transaction History</h2>
        {transactions.map(txn => (
          <div key={txn.id}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{txn.description ?? txn.category}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(txn.txn_date)} · {txn.status}</p>
            </div>
            <span className={cn('text-sm font-semibold tabular-nums',
              txn.direction === 'credit' ? 'text-positive' : 'text-destructive')}>
              {txn.direction === 'credit' ? '+' : '−'}{fmtINR(txn.amount)}
            </span>
          </div>
        ))}
        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
        )}
      </div>
    </div>
  )
}