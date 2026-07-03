'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Transaction, Account } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

const CATEGORIES = ['Housing', 'Food & Dining', 'Transport', 'Healthcare', 'Insurance', 'Investments', 'Education', 'Entertainment', 'Utilities', 'Shopping', 'Tithe / Giving', 'EMI / Debt', 'Other']

const TXN_ICONS = {
  income: { icon: ArrowUpRight, color: 'text-positive bg-positive/10' },
  expense: { icon: ArrowDownLeft, color: 'text-negative bg-negative/10' },
  transfer: { icon: ArrowLeftRight, color: 'text-primary bg-primary/10' },
  investment: { icon: ArrowUpRight, color: 'text-sky-500 bg-sky-500/10' },
  loan_payment: { icon: ArrowDownLeft, color: 'text-warning bg-warning/10' },
  other: { icon: ArrowLeftRight, color: 'text-muted-foreground bg-muted' },
}

interface TransactionsModuleProps {
  transactions: Transaction[]
  accounts: Pick<Account, 'id' | 'name'>[]
  total: number
  page: number
  pageSize: number
  filters: { category?: string; type?: string; q?: string; from?: string; to?: string }
}

export function TransactionsModule({ transactions, accounts, total, page, pageSize, filters }: TransactionsModuleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.q ?? '')

  const totalPages = Math.ceil(total / pageSize)
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams()
    Object.entries({ ...filters, [key]: value, page: '1' }).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const income = transactions.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total.toLocaleString('en-IN')} total records</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1.5" /> Export</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Add</Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Income', value: fmtINR(income), color: 'text-positive' },
          { label: 'Total Expenses', value: fmtINR(expenses), color: 'text-negative' },
          { label: 'Net', value: fmtINR(income - expenses), color: income - expenses >= 0 ? 'text-positive' : 'text-negative' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="metric-label">{s.label}</p>
            <p className={cn('text-lg font-semibold tabular-nums tracking-tight mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && updateFilter('q', search || undefined)}
            placeholder="Search description, merchant..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filters.type ?? 'all'} onValueChange={v => updateFilter('type', v === 'all' ? undefined : v)}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
            <SelectItem value="loan_payment">Loan Payment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category ?? 'all'} onValueChange={v => updateFilter('category', v === 'all' ? undefined : v)}>
          <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {Object.values(filters).some(Boolean) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => router.push(pathname)}>Clear filters</Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-muted/20">
              <tr>
                {['Date', 'Description', 'Category', 'Account', 'Amount', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No transactions found</td></tr>
              ) : (
                transactions.map(txn => {
                  const iconCfg = TXN_ICONS[txn.txn_type] ?? TXN_ICONS.other
                  const Icon = iconCfg.icon
                  return (
                    <motion.tr
                      key={txn.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(txn.txn_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0', iconCfg.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-medium truncate max-w-[180px]">{txn.description ?? txn.merchant ?? 'Transaction'}</p>
                            {txn.merchant && txn.description && <p className="text-xs text-muted-foreground">{txn.merchant}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] font-normal">{txn.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{accountMap[txn.account_id] ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">
                        <span className={txn.direction === 'credit' ? 'text-positive' : 'text-foreground'}>
                          {txn.direction === 'credit' ? '+' : '-'}{fmtINR(txn.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={txn.status === 'cleared' ? 'outline' : 'secondary'} className="text-[10px] capitalize">{txn.status}</Badge>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString('en-IN')}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))}>Previous</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => updateFilter('page', String(page + 1))}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}