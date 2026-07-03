'use client'

import { useState } from 'react'
import { Plus, TrendingUp, Banknote, Percent, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddIncomeForm } from '@/components/forms/AddIncomeForm'
import { fmtINR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary', freelance: 'Freelance', rental: 'Rental', dividend: 'Dividend',
  interest: 'Interest', bonus: 'Bonus', capital_gains: 'Capital Gains',
  business: 'Business', gift: 'Gift', other: 'Other',
}

interface IncomeEntry {
  id: string
  source_name: string
  income_type: string
  gross_amount: number
  tds_deducted: number
  net_amount: number
  month: number
  financial_year: string
}

interface IncomeModuleProps {
  entries: IncomeEntry[]
  accounts: { id: string; name: string; account_type: string }[]
  financialYear: string
}

export function IncomeModule({ entries, accounts, financialYear }: IncomeModuleProps) {
  const [tab, setTab]       = useState('overview')
  const [showAdd, setShowAdd] = useState(false)

  const totalGross = entries.reduce((s, e) => s + e.gross_amount, 0)
  const totalTDS   = entries.reduce((s, e) => s + e.tds_deducted, 0)
  const totalNet   = entries.reduce((s, e) => s + e.net_amount, 0)
  const avgMonthly = totalNet / 12

  const byType = entries.reduce<Record<string, IncomeEntry[]>>((acc, e) => {
    acc[e.income_type] = [...(acc[e.income_type] ?? []), e]
    return acc
  }, {})

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const month = i < 9 ? i + 4 : i - 8
    const me    = entries.filter(e => e.month === month)
    return { label: MONTHS[i], gross: me.reduce((s, e) => s + e.gross_amount, 0) }
  })
  const maxMonthly = Math.max(...monthlyTotals.map(m => m.gross), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Income</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {financialYear} · {entries.length} entries</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Income
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Income', value: fmtINR(totalGross), icon: TrendingUp, color: 'text-green-600' },
          { label: 'TDS Deducted', value: fmtINR(totalTDS),   icon: Percent,    color: 'text-yellow-600' },
          { label: 'Net Income',   value: fmtINR(totalNet),   icon: Banknote,   color: 'text-blue-600'  },
          { label: 'Avg Monthly',  value: fmtINR(avgMonthly), icon: Calendar,   color: 'text-gray-500'  },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Monthly</TabsTrigger>
          <TabsTrigger value="sources">By Source</TabsTrigger>
          <TabsTrigger value="entries">All Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Monthly Breakdown — FY {financialYear}</h3>
            <div className="space-y-3">
              {monthlyTotals.map(m => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-medium tabular-nums">{m.gross > 0 ? fmtINR(m.gross) : '—'}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(m.gross / maxMonthly) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-4 space-y-3">
          {Object.keys(byType).length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No income entries yet</div>
          ) : Object.entries(byType).map(([type, typeEntries]) => {
            const typeTotal = typeEntries.reduce((s, e) => s + e.gross_amount, 0)
            const pct = totalGross > 0 ? Math.round((typeTotal / totalGross) * 100) : 0
            return (
              <div key={type} className="rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{INCOME_TYPE_LABELS[type] ?? type}</p>
                    <p className="text-xs text-muted-foreground">{typeEntries.length} entries</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{fmtINR(typeTotal)}</p>
                    <p className="text-xs text-muted-foreground">{pct}% of total</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="entries" className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No income entries yet</div>
          ) : entries.map(e => (
            <div key={e.id}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{e.source_name}</p>
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary" className="text-xs">
                    {INCOME_TYPE_LABELS[e.income_type] ?? e.income_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {MONTHS[(e.month - 4 + 12) % 12]} · FY {e.financial_year}
                  </span>
                  {e.tds_deducted > 0 && (
                    <span className="text-xs text-yellow-600">TDS: {fmtINR(e.tds_deducted)}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-green-600">+{fmtINR(e.gross_amount)}</p>
                <p className="text-xs text-muted-foreground">Net: {fmtINR(e.net_amount)}</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <AddIncomeForm
        open={showAdd}
        onClose={() => setShowAdd(false)}
        accounts={accounts}
        financialYear={financialYear}
      />
    </div>
  )
}