'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Wallet, CreditCard, TrendingUp, Building2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Account, Transaction } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface AccountsModuleProps {
  accounts: Account[]
  recentTxns: Transaction[]
}

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  savings: '🏦', current: '🏢', salary: '💰', fd: '📈', rd: '📊',
  ppf: '🏛️', nps: '🏛️', wallet: '👛', cash: '💵', credit_card: '💳',
  loan: '⚠️', demat: '📉', other: '💼',
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  savings: 'bg-blue-500/10 text-blue-500',
  current: 'bg-indigo-500/10 text-indigo-500',
  salary: 'bg-green-500/10 text-green-500',
  fd: 'bg-amber-500/10 text-amber-500',
  rd: 'bg-orange-500/10 text-orange-500',
  credit_card: 'bg-red-500/10 text-red-500',
  demat: 'bg-purple-500/10 text-purple-500',
  wallet: 'bg-pink-500/10 text-pink-500',
}

export function AccountsModule({ accounts, recentTxns }: AccountsModuleProps) {
  const [tab, setTab] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const totalBalance = accounts
    .filter(a => !['credit_card', 'loan'].includes(a.account_type))
    .reduce((s, a) => s + a.balance, 0)
  const totalCredit = accounts
    .filter(a => a.account_type === 'credit_card')
    .reduce((s, a) => s + (a.credit_limit ?? 0), 0)
  const totalDebt = accounts
    .filter(a => a.account_type === 'loan')
    .reduce((s, a) => s + a.balance, 0)

  const byType = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const group = ['savings', 'current', 'salary', 'cash', 'wallet'].includes(a.account_type) ? 'bank'
      : ['fd', 'rd', 'ppf', 'nps', 'demat'].includes(a.account_type) ? 'investments'
      : a.account_type === 'credit_card' ? 'credit'
      : 'loans'
    acc[group] = [...(acc[group] ?? []), a]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{accounts.length} linked accounts</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Account
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Balance', value: fmtINR(totalBalance), icon: Wallet, color: 'text-primary' },
          { label: 'Bank Accounts', value: String(byType.bank?.length ?? 0), icon: Building2, color: 'text-blue-500' },
          { label: 'Credit Limit', value: fmtINR(totalCredit), icon: CreditCard, color: 'text-amber-500' },
          { label: 'Active Loans', value: fmtINR(totalDebt), icon: TrendingUp, color: 'text-red-500' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="credit">Credit</TabsTrigger>
          <TabsTrigger value="recent">Recent Txns</TabsTrigger>
        </TabsList>

        {['all', 'bank', 'investments', 'credit', 'loans'].map(group => (
          <TabsContent key={group} value={group} className="mt-4 space-y-3">
            {(group === 'all' ? accounts : (byType[group] ?? [])).map(account => (
              <AccountCard key={account.id} account={account} />
            ))}
            {(group === 'all' ? accounts : (byType[group] ?? [])).length === 0 && (
              <EmptyAccounts onAdd={() => setShowAdd(true)} />
            )}
          </TabsContent>
        ))}

        <TabsContent value="recent" className="mt-4 space-y-2">
          {recentTxns.length === 0
            ? <p className="text-center py-10 text-muted-foreground text-sm">No recent transactions</p>
            : recentTxns.map(txn => (
              <div key={txn.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{txn.description ?? txn.category}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(txn.txn_date)} · {txn.category}</p>
                </div>
                <span className={cn('text-sm font-semibold tabular-nums',
                  txn.direction === 'credit' ? 'text-positive' : 'text-destructive')}>
                  {txn.direction === 'credit' ? '+' : '−'}{fmtINR(txn.amount)}
                </span>
              </div>
            ))
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AccountCard({ account }: { account: Account }) {
  const typeIcon = ACCOUNT_TYPE_ICONS[account.account_type] ?? '💼'
  const badgeClass = ACCOUNT_TYPE_COLORS[account.account_type] ?? 'bg-muted text-muted-foreground'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-5 py-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="text-2xl">{typeIcon}</div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{account.name}</p>
            {account.is_primary && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-xs px-2 py-0', badgeClass)}>
              {account.account_type.replace('_', ' ').toUpperCase()}
            </Badge>
            {account.bank_name && <span className="text-xs text-muted-foreground">{account.bank_name}</span>}
            {account.account_number && (
              <span className="text-xs text-muted-foreground">····{account.account_number.slice(-4)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('text-base font-bold tabular-nums',
          account.account_type === 'credit_card' ? 'text-destructive' : 'text-foreground')}>
          {fmtINR(account.balance)}
        </p>
        {account.account_type === 'credit_card' && account.credit_limit && (
          <p className="text-xs text-muted-foreground">of {fmtINR(account.credit_limit)} limit</p>
        )}
        {account.interest_rate && (
          <p className="text-xs text-muted-foreground">{account.interest_rate}% p.a.</p>
        )}
        <Badge variant="outline" className={cn('text-xs mt-1',
          account.status === 'active' ? 'text-positive border-positive/30' : 'text-muted-foreground')}>
          {account.status}
        </Badge>
      </div>
    </motion.div>
  )
}

function EmptyAccounts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="text-3xl">🏦</div>
      <p className="text-sm font-medium text-muted-foreground">No accounts yet</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
      </Button>
    </div>
  )
}