'use client'

import { TrendingUp, TrendingDown, Wallet, CreditCard, Shield, Target, AlertCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtINR } from '@/lib/utils/currency'

interface Props {
  accounts: any[]
  transactions: any[]
  income: any[]
  debts: any[]
  goals: any[]
  insurance: any[]
  receivables: any[]
  userName: string
  currentFY: string
}

export function DashboardModule({ accounts, transactions, income, debts, goals, insurance, receivables, userName, currentFY }: Props) {
  const LIQUID = ['savings', 'current', 'salary', 'wallet', 'cash']
  const liquidCash     = accounts.filter(a => LIQUID.includes(a.account_type)).reduce((s, a) => s + a.balance, 0)
  const totalDebt      = debts.reduce((s, d) => s + d.outstanding, 0)
  const monthlyIncome  = income.reduce((s, i) => s + i.net_amount, 0) / 12
  const monthlyExpenses = transactions.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const totalEMI       = debts.reduce((s, d) => s + (d.emi_amount ?? 0), 0)
  const netWorth       = liquidCash - totalDebt
  const overdueItems   = receivables.filter(r => r.status === 'overdue')

  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const renewalsSoon = insurance.filter(p => p.renewal_date && p.renewal_date <= in30Days)
  const nextEMI = debts.filter(d => d.next_emi_date).sort((a, b) => new Date(a.next_emi_date).getTime() - new Date(b.next_emi_date).getTime())[0]

  const totalGoalTarget  = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalGoalSaved   = goals.reduce((s, g) => s + g.current_amount, 0)
  const goalsProgress    = totalGoalTarget > 0 ? Math.round((totalGoalSaved / totalGoalTarget) * 100) : 0

  const expensesByCategory = transactions.filter(t => t.direction === 'debit').reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount
    return acc
  }, {})

  const topCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {userName.split(' ')[0]}. Here's your financial overview.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Net Worth',        value: fmtINR(netWorth),        icon: TrendingUp,  color: netWorth >= 0 ? 'text-green-600' : 'text-red-500',   bg: 'bg-green-50'  },
          { label: 'Liquid Cash',      value: fmtINR(liquidCash),      icon: Wallet,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Monthly Expenses', value: fmtINR(monthlyExpenses), icon: TrendingDown,color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Total Debt',       value: fmtINR(totalDebt),       icon: CreditCard,  color: 'text-red-600',    bg: 'bg-red-50'    },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', item.bg)}>
                <item.icon className={cn('h-3.5 w-3.5', item.color)} />
              </div>
            </div>
            <p className="text-xl font-bold tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Alerts & Reminders */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold">Upcoming & Alerts</h2>

          {overdueItems.length === 0 && renewalsSoon.length === 0 && !nextEMI && goals.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
              <p className="text-sm text-green-600 font-medium">✅ All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No urgent items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueItems.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-700 truncate">Overdue: {r.from_name}</p>
                    <p className="text-xs text-red-600">{fmtINR(r.balance_due)} pending</p>
                  </div>
                </div>
              ))}
              {renewalsSoon.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                  <Shield className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-yellow-800 truncate">{p.policy_name}</p>
                    <p className="text-xs text-yellow-700">Renews {new Date(p.renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              ))}
              {nextEMI && (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-800 truncate">EMI: {nextEMI.lender_name}</p>
                    <p className="text-xs text-blue-700">{fmtINR(nextEMI.emi_amount)} due {new Date(nextEMI.next_emi_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              )}
              {goals.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                  <Target className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-purple-800">{goals.length} Active Goal{goals.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-purple-700">{goalsProgress}% overall progress</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold">Top Expenses This Month</h2>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded yet</p>
            ) : topCategories.map(([cat, amount]) => {
              const pct = monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize font-medium">{cat}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtINR(amount)} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Summary */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold">Financial Summary</h2>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            {[
              { label: 'Monthly Income',  value: fmtINR(monthlyIncome),  color: 'text-green-600'  },
              { label: 'Monthly EMIs',    value: fmtINR(totalEMI),       color: 'text-red-500'    },
              { label: 'Accounts',        value: String(accounts.length),color: 'text-blue-600'   },
              { label: 'Active Loans',    value: String(debts.length),   color: 'text-orange-600' },
              { label: 'Insurance Policies', value: String(insurance.length), color: 'text-purple-600' },
              { label: 'Pending Receivables', value: fmtINR(receivables.reduce((s, r) => s + r.balance_due, 0)), color: 'text-yellow-600' },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={cn('font-semibold tabular-nums', item.color)}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}