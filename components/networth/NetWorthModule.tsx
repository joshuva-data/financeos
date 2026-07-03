'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NetWorthSnapshot } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface NetWorthModuleProps {
  snapshots: NetWorthSnapshot[]
  accounts:    { id: string; name: string; account_type: string; balance: number }[]
  investments: { id: string; name: string; investment_type: string; current_value: number | null; invested_amount: number }[]
  debts:       { id: string; lender_name: string; debt_type: string; outstanding: number }[]
}

export function NetWorthModule({ snapshots, accounts, investments, debts }: NetWorthModuleProps) {
  const [tab, setTab] = useState('summary')

  const totalLiquid   = accounts
    .filter(a => ['savings','current','salary','cash','wallet'].includes(a.account_type))
    .reduce((s, a) => s + a.balance, 0)
  const totalInvested = investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalDebt     = debts.reduce((s, d) => s + d.outstanding, 0)
  const totalAssets   = totalLiquid + totalInvested
  const netWorth      = totalAssets - totalDebt

  const latest    = snapshots[snapshots.length - 1]
  const previous  = snapshots[snapshots.length - 2]
  const change    = latest && previous ? latest.net_worth - previous.net_worth : 0
  const changePct = previous?.net_worth ? (change / previous.net_worth) * 100 : 0
  const maxNW     = Math.max(...snapshots.map(s => s.net_worth), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Net Worth</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last updated: {latest ? fmtDate(latest.snapshot_date) : 'Never'}
          </p>
        </div>
        {change !== 0 && (
          <div className={cn('flex items-center gap-1 text-sm font-medium',
            change > 0 ? 'text-positive' : 'text-destructive')}>
            {change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {change > 0 ? '+' : ''}{fmtINR(change)} ({changePct.toFixed(1)}%)
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Current Net Worth</p>
        <p className="text-4xl font-bold tabular-nums tracking-tight">{fmtINR(netWorth)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Assets', value: fmtINR(totalAssets), icon: TrendingUp,   color: 'text-positive'    },
          { label: 'Total Debt',   value: fmtINR(totalDebt),   icon: TrendingDown,  color: 'text-destructive' },
          { label: 'Liquid Cash',  value: fmtINR(totalLiquid), icon: Wallet,        color: 'text-blue-500'    },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-lg font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Asset Allocation</h3>
            {[
              { label: 'Liquid Cash',   value: totalLiquid,   pct: totalAssets > 0 ? (totalLiquid / totalAssets) * 100   : 0, color: 'bg-blue-500'  },
              { label: 'Investments',   value: totalInvested, pct: totalAssets > 0 ? (totalInvested / totalAssets) * 100 : 0, color: 'bg-primary'   },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {fmtINR(item.value)} <span className="text-muted-foreground">({item.pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <motion.div className={cn('h-full rounded-full', item.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Net Worth Over Time</h3>
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No snapshot history yet. Snapshots are generated monthly.
              </p>
            ) : snapshots.map(s => (
              <div key={s.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{fmtDate(s.snapshot_date)}</span>
                  <span className="font-medium tabular-nums">{fmtINR(s.net_worth)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.net_worth / maxNW) * 100}%` }}
                    transition={{ duration: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Investments</h3>
            {investments.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{i.investment_type.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{fmtINR(i.current_value ?? i.invested_amount)}</p>
                  {i.current_value && (
                    <p className={cn('text-xs', i.current_value >= i.invested_amount ? 'text-positive' : 'text-destructive')}>
                      {i.current_value >= i.invested_amount ? '+' : ''}{fmtINR(i.current_value - i.invested_amount)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Liabilities</h3>
            {debts.map(d => (
              <div key={d.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{d.lender_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{d.debt_type.replace(/_/g, ' ')}</p>
                </div>
                <p className="text-destructive font-bold tabular-nums">{fmtINR(d.outstanding)}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}