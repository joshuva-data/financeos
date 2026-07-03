'use client'

import { useState } from 'react'
import { Plus, ArrowDown, Tag, TrendingDown, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddTransactionForm } from '@/components/forms/AddTransactionForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#6366f1', food: '#f59e0b', transport: '#0ea5e9',
  utilities: '#10b981', insurance: '#8b5cf6', health: '#ec4899',
  entertainment: '#f97316', shopping: '#14b8a6', education: '#3b82f6',
  investment: '#22c55e', other: '#94a3b8',
}

interface Transaction {
  id: string; description?: string; merchant?: string; category: string
  amount: number; txn_date: string; direction: string; status?: string
}

interface Props {
  thisMonth: Transaction[]
  lastMonth: Transaction[]
  accounts:  { id: string; name: string }[]
}

export function ExpensesModule({ thisMonth: initialThis, lastMonth, accounts }: Props) {
  const [thisMonth, setThisMonth] = useState(initialThis)
  const [tab, setTab]             = useState('overview')
  const [showAdd, setShowAdd]     = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setThisMonth(prev => prev.filter(t => t.id !== id)); toast.success('Expense deleted') }
    setDeleting(null)
  }

  const totalThis  = thisMonth.reduce((s, t) => s + t.amount, 0)
  const totalLast  = lastMonth.reduce((s, t) => s + t.amount, 0)
  const change     = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : 0
  const isOver     = change > 0

  const byCategory = thisMonth.reduce<Record<string, { total: number; count: number }>>((acc, t) => {
    const cat = (t.category ?? 'other').toLowerCase()
    acc[cat] = { total: (acc[cat]?.total ?? 0) + t.amount, count: (acc[cat]?.count ?? 0) + 1 }
    return acc
  }, {})
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
  const maxCategory      = Math.max(...sortedCategories.map(([, v]) => v.total), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{thisMonth.length} transactions this month</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'This Month',  value: fmtINR(totalThis), icon: ArrowDown,    color: 'text-red-400'            },
          { label: 'Last Month',  value: fmtINR(totalLast), icon: TrendingDown, color: 'text-muted-foreground'   },
          { label: 'MoM Change',  value: `${isOver ? '+' : ''}${change.toFixed(1)}%`, icon: AlertCircle, color: isOver ? 'text-red-400' : 'text-green-400' },
          { label: 'Categories',  value: String(Object.keys(byCategory).length), icon: Tag, color: 'text-blue-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      {isOver && change > 15 && (
        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium text-red-400">Spending is up {change.toFixed(0)}%</span>
            <span className="text-muted-foreground"> vs last month ({fmtINR(totalLast)})</span>
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">By Category</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-3">
          {sortedCategories.length === 0 ? (
            <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-3xl">💸</span>
              <p className="text-sm text-muted-foreground">No expenses this month</p>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense
              </Button>
            </div>
          ) : sortedCategories.map(([cat, data]) => (
            <div key={cat} className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#94a3b8' }} />
                  <p className="text-sm font-medium capitalize">{cat}</p>
                  <span className="text-xs text-muted-foreground">({data.count})</span>
                </div>
                <p className="text-sm font-bold tabular-nums">{fmtINR(data.total)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#94a3b8', width: `${(data.total / maxCategory) * 100}%` }} />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-2">
          {thisMonth.length === 0 ? (
            <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-3xl">💸</span>
              <p className="text-sm text-muted-foreground">No expenses this month</p>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense
              </Button>
            </div>
          ) : thisMonth.map(t => (
            <div key={t.id} className="glass-card rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description ?? t.merchant ?? t.category}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] capitalize">{t.category}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(t.txn_date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="text-sm font-bold tabular-nums text-red-400">−{fmtINR(t.amount)}</p>
                <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <AddTransactionForm
        open={showAdd}
        onClose={() => setShowAdd(false)}
        accounts={accounts}
        defaultType="expense"
      />
    </div>
  )
}
