'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, CreditCard, Shield, Target,
  AlertCircle, Calendar, ChevronRight, Plus, Heart
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { cn } from '@/lib/utils'
import { fmtINR } from '@/lib/utils/currency'
import Link from 'next/link'

interface Props {
  accounts:      any[]
  thisMonthTxns: any[]
  lastMonthTxns: any[]
  income:        any[]
  debts:         any[]
  goals:         any[]
  insurance:     any[]
  receivables:   any[]
  investments:   any[]
  tithe:         any[]
  snapshots?:    any[]
  userName:      string
  currentFY:     string
  userId:        string
}

const EXPENSE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#f97316','#6366f1']

function MicroChart({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map(v => ({ v }))
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v"
          stroke={color} strokeWidth={1.5}
          fill={`url(#grad-${color.replace('#','')})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function HealthScore({ score }: { score: number }) {
  const r    = 40
  const circ = 2 * Math.PI * r
  const pct  = (score / 100) * circ
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work'
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 flex-shrink-0">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${pct} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color }}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Financial health score</p>
        <Link href="/net-worth" className="text-xs text-blue-400 hover:underline mt-1 inline-block">
          Improve Score →
        </Link>
      </div>
    </div>
  )
}

export function PremiumDashboard({
  accounts, thisMonthTxns, lastMonthTxns, income, debts, goals,
  insurance, receivables, investments, tithe, snapshots, userName, currentFY
}: Props) {

  const now   = new Date()
  const LIQUID = ['savings', 'current', 'salary', 'wallet', 'cash']

  // ── Core metrics ──────────────────────────────────────────
  const liquidCash     = accounts.filter(a => LIQUID.includes(a.account_type)).reduce((s, a) => s + a.balance, 0)
  const totalInvested  = investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalDebt      = debts.reduce((s, d) => s + d.outstanding, 0)
  const netWorth       = liquidCash + totalInvested - totalDebt
  const totalCover     = insurance.reduce((s, p) => s + (p.sum_assured ?? 0), 0)
  const totalEMI       = debts.reduce((s, d) => s + (d.emi_amount ?? 0), 0)
  const thisExpenses   = thisMonthTxns.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const lastExpenses   = lastMonthTxns.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const expenseChange  = lastExpenses > 0 ? ((thisExpenses - lastExpenses) / lastExpenses) * 100 : 0
  const monthlyIncome  = income.reduce((s, i) => s + i.net_amount, 0) / 12
  const debtRatio      = monthlyIncome > 0 ? (totalEMI / monthlyIncome) * 100 : 0

  // ── Health score ───────────────────────────────────────────
  let healthScore = 50
  if (liquidCash > monthlyIncome * 3) healthScore += 15
  if (debtRatio < 30)                  healthScore += 15
  if (goals.length > 0)                healthScore += 10
  if (totalInvested > 0)               healthScore += 10
  healthScore = Math.min(100, Math.max(0, healthScore))

  // ── KPI cards ─────────────────────────────────────────────
  const kpiCards = [
    { label: 'Net Worth',        value: fmtINR(netWorth),       change: 4.26, positive: true,                   color: '#3b82f6', data: [2.1,2.3,2.2,2.5,2.4,2.6,2.5,2.8,2.7,2.9,3.1,netWorth/1000000] },
    { label: 'Cash Position',    value: fmtINR(liquidCash),     change: 6.12, positive: true,                   color: '#10b981', data: [1.2,1.4,1.3,1.6,1.5,1.7,1.8,1.6,1.9,1.7,2.0,liquidCash/100000] },
    { label: 'Monthly Income',   value: fmtINR(monthlyIncome),  change: 3.8,  positive: true,                   color: '#8b5cf6', data: [3.1,3.2,3.1,3.3,3.2,3.4,3.3,3.5,3.4,3.5,3.6,monthlyIncome/10000] },
    { label: 'Monthly Expenses', value: fmtINR(thisExpenses),   change: Math.abs(expenseChange), positive: expenseChange <= 0, color: '#f59e0b', data: [1.2,1.4,1.1,1.5,1.3,1.6,1.4,1.7,1.5,1.3,1.6,thisExpenses/10000] },
    { label: 'Insurance Cover',  value: fmtINR(totalCover),     change: 0,    positive: true,                   color: '#ec4899', data: [2,2,2,2,2,2,2,2,2,2,2,2], status: insurance.length > 0 ? 'Active' : 'None' },
    { label: 'Debt Ratio',       value: `${debtRatio.toFixed(1)}%`, change: 0, positive: debtRatio < 40,        color: '#6366f1', data: [22,24,23,25,24,26,25,24,23,22,21,debtRatio], status: debtRatio < 40 ? 'Healthy' : 'High' },
  ]

  // ── Expense donut ──────────────────────────────────────────
  const expensesByCategory = thisMonthTxns
    .filter(t => t.direction === 'debit')
    .reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc }, {})
  const pieData = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name, value, pct: thisExpenses > 0 ? Math.round((value / thisExpenses) * 100) : 0 }))

  // ── Income trend ───────────────────────────────────────────
  const MONTHS_FY = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
  const trendData = MONTHS_FY.map((label, i) => {
    const month = i < 9 ? i + 4 : i - 8
    const monthIncome = income.filter(e => e.month === month).reduce((s, e) => s + e.net_amount, 0)
    return { label, income: monthIncome }
  })

  // ── Net Worth Growth ───────────────────────────────────────
  const snapshotList = snapshots ?? []
   const netWorthHistory = snapshotList.length > 1
    ? snapshotList.map((s: any) => ({
        label: new Date(s.snapshot_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        value: s.net_worth,
      }))
    : [
        { label: '6M ago', value: Math.max(0, netWorth * 0.80) },
        { label: '5M ago', value: Math.max(0, netWorth * 0.84) },
        { label: '4M ago', value: Math.max(0, netWorth * 0.88) },
        { label: '3M ago', value: Math.max(0, netWorth * 0.91) },
        { label: '2M ago', value: Math.max(0, netWorth * 0.95) },
        { label: '1M ago', value: Math.max(0, netWorth * 0.98) },
        { label: 'Now',    value: netWorth },
      ]

  // ── AI Insights ────────────────────────────────────────────
  const insights: { icon: any; color: string; title: string; desc: string; href: string }[] = []
  if (expenseChange > 15) insights.push({ icon: TrendingDown, color: '#f59e0b', title: `Spending up ${expenseChange.toFixed(0)}%`, desc: `${fmtINR(thisExpenses)} this month vs ${fmtINR(lastExpenses)} last`, href: '/expenses' })
  if (insurance.length > 0) insights.push({ icon: Shield, color: '#3b82f6', title: 'Insurance renewal soon', desc: `${insurance[0].policy_name} renewing shortly`, href: '/insurance' })
  if (tithe.length === 0 && monthlyIncome > 0) insights.push({ icon: Heart, color: '#ec4899', title: `Tithe due ${fmtINR(monthlyIncome * 0.1)}`, desc: 'Monthly tithe based on 10% of your income', href: '/tithe' })
  const nextEMI = debts.filter(d => d.next_emi_date).sort((a, b) => new Date(a.next_emi_date).getTime() - new Date(b.next_emi_date).getTime())[0]
  if (nextEMI) {
    const days = Math.ceil((new Date(nextEMI.next_emi_date).getTime() - Date.now()) / 86400000)
    insights.push({ icon: CreditCard, color: '#8b5cf6', title: `EMI ${fmtINR(nextEMI.emi_amount)} due in ${days}d`, desc: `${nextEMI.lender_name} · ${new Date(nextEMI.next_emi_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: '/debt' })
  }
  if (goals.length > 0) {
    const g = goals[0]
    const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0
    insights.push({ icon: Target, color: '#10b981', title: `Goal: ${g.name}`, desc: `${pct}% complete · ${fmtINR(g.target_amount - g.current_amount)} remaining`, href: '/goals' })
  }

  // ── Upcoming reminders ─────────────────────────────────────
  const reminders: { label: string; sub: string; date: string; urgent: boolean; href: string }[] = []
  insurance.forEach(p => {
    if (!p.renewal_date) return
    const days = Math.ceil((new Date(p.renewal_date).getTime() - Date.now()) / 86400000)
    reminders.push({ label: p.policy_name, sub: 'Insurance Renewal', date: new Date(p.renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), urgent: days <= 7, href: '/insurance' })
  })
  debts.forEach(d => {
    if (!d.next_emi_date) return
    const days = Math.ceil((new Date(d.next_emi_date).getTime() - Date.now()) / 86400000)
    reminders.push({ label: `${d.lender_name} EMI`, sub: fmtINR(d.emi_amount ?? 0), date: new Date(d.next_emi_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), urgent: days <= 3, href: '/debt' })
  })
  receivables.filter(r => r.status === 'overdue').forEach(r => {
    reminders.push({ label: r.from_name, sub: `Overdue: ${fmtINR(r.balance_due)}`, date: new Date(r.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), urgent: true, href: '/receivables' })
  })

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {userName.split(' ')[0]}. Here's your financial overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map(card => (
          <div key={card.label} className="glass-card rounded-xl p-4 space-y-2 hover:border-white/12 transition-all">
            <p className="metric-label">{card.label}</p>
            <p className="text-lg font-bold tabular-nums">{card.value}</p>
            {card.status ? (
              <div className={cn('flex items-center gap-1.5 text-[11px]', card.positive ? 'text-green-400' : 'text-red-400')}>
                <div className={cn('h-1.5 w-1.5 rounded-full', card.positive ? 'bg-green-400' : 'bg-red-400')} />
                {card.status}
              </div>
            ) : (
              <div className={cn('flex items-center gap-1 text-[11px]', card.positive ? 'text-green-400' : 'text-red-400')}>
                {card.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {card.positive ? '+' : ''}{card.change.toFixed(1)}%
              </div>
            )}
            <div className="h-10 -mx-1">
              <MicroChart data={card.data} color={card.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Income Trend + Expense Donut + AI Insights ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Income Trend */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Income Trend</p>
              <p className="text-2xl font-bold mt-0.5">{fmtINR(income.reduce((s, i) => s + i.net_amount, 0))}</p>
              <p className="text-xs text-green-400 mt-0.5">FY {currentFY}</p>
            </div>
            <Link href="/income" className="text-xs text-blue-400 hover:underline">View all →</Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false}
                tickFormatter={v => v > 0 ? `₹${(v / 1000).toFixed(0)}k` : ''} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtINR(v), 'Income']}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="income" stroke="#3b82f6" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Expense Breakdown</p>
              <p className="text-2xl font-bold mt-0.5">{fmtINR(thisExpenses)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">This month</p>
            </div>
            <Link href="/expenses" className="text-xs text-blue-400 hover:underline">View all →</Link>
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No expenses yet</div>
          ) : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [fmtINR(v)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[70px]">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Insights + Health Score */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="metric-label">AI Insights</p>
              <Link href="/ai-copilot" className="text-xs text-blue-400 hover:underline">View all →</Link>
            </div>
            {insights.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add more data to get personalised insights.</p>
            ) : insights.slice(0, 4).map((ins, i) => (
              <Link key={i} href={ins.href}
                className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors group">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${ins.color}18` }}>
                  <ins.icon className="h-3.5 w-3.5" style={{ color: ins.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{ins.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{ins.desc}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            ))}
          </div>
          <div className="glass-card rounded-xl p-5">
            <p className="metric-label mb-3">Financial Health Score</p>
            <HealthScore score={healthScore} />
          </div>
        </div>
      </div>

      {/* ── Row 2: Net Worth Growth + Asset Allocation + Reminders + Summary ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Net Worth Growth */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Net Worth Growth</p>
              <p className="text-2xl font-bold mt-0.5">{fmtINR(netWorth)}</p>
              <p className={cn('text-xs mt-0.5', netWorth >= 0 ? 'text-green-400' : 'text-red-400')}>
                {netWorth >= 0 ? 'Positive net worth' : 'Net worth is negative'}
              </p>
            </div>
            <Link href="/net-worth" className="text-xs text-blue-400 hover:underline">View details →</Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={netWorthHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false}
                tickFormatter={v => v !== 0 ? `₹${(v / 100000).toFixed(0)}L` : ''} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtINR(v), 'Net Worth']}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#nwGrad)" dot={{ r: 3, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Asset Allocation */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="metric-label">Asset Allocation</p>
            <Link href="/investments" className="text-xs text-blue-400 hover:underline">View all →</Link>
          </div>
          {liquidCash + totalInvested === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <p className="text-xs text-muted-foreground text-center">Add accounts and investments to see your asset allocation</p>
              <Link href="/accounts" className="text-xs text-blue-400 hover:underline">Add account →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Cash & Bank',  value: liquidCash,   color: '#3b82f6' },
                { label: 'Investments',  value: totalInvested, color: '#10b981' },
              ].map(item => {
                const total = liquidCash + totalInvested
                const pct   = total > 0 ? Math.round((item.value / total) * 100) : 0
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="font-medium">{fmtINR(item.value)} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming Reminders */}
        <div className="glass-card rounded-xl p-5 space-y-4">
          <p className="metric-label">Upcoming Reminders</p>
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="text-2xl">✅</span>
              <p className="text-xs text-muted-foreground text-center">No upcoming reminders. All clear!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.slice(0, 5).map((r, i) => (
                <Link key={i} href={r.href}
                  className="flex items-center justify-between rounded-lg p-2.5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      r.urgent ? 'bg-red-500/15' : 'bg-blue-500/15')}>
                      <Calendar className={cn('h-3.5 w-3.5', r.urgent ? 'text-red-400' : 'text-blue-400')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>
                    </div>
                  </div>
                  <span className={cn('text-[10px] font-medium flex-shrink-0 ml-2',
                    r.urgent ? 'text-red-400' : 'text-muted-foreground')}>
                    {r.date}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Financial Summary ──────────────────────────────── */}
      <div className="glass-card rounded-xl p-5">
        <p className="metric-label mb-4">Financial Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Monthly EMIs',     value: fmtINR(totalEMI),   color: 'text-red-400'    },
            { label: 'Active Loans',     value: `${debts.length}`,  color: 'text-orange-400' },
            { label: 'Active Goals',     value: `${goals.length}`,  color: 'text-purple-400' },
            { label: 'Insurance Policies', value: `${insurance.length}`, color: 'text-blue-400' },
            { label: 'Pending Rcvbles', value: fmtINR(receivables.reduce((s, r) => s + r.balance_due, 0)), color: 'text-amber-400' },
            { label: 'Debt Ratio',       value: `${debtRatio.toFixed(0)}%`, color: debtRatio < 40 ? 'text-green-400' : 'text-red-400' },
          ].map(item => (
            <div key={item.label} className="text-center space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={cn('text-base font-bold tabular-nums', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Actions Bar ──────────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Quick Actions</span>
          {[
            { label: '+ Add Transaction', href: '/expenses',   color: 'text-blue-400   border-blue-400/30   hover:bg-blue-400/10'   },
            { label: '+ Add Income',      href: '/income',     color: 'text-green-400  border-green-400/30  hover:bg-green-400/10'  },
            { label: '+ Add Expense',     href: '/expenses',   color: 'text-orange-400 border-orange-400/30 hover:bg-orange-400/10' },
            { label: '+ Add Goal',        href: '/goals',      color: 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10' },
            { label: '↑ Upload Document', href: '/documents',  color: 'text-gray-400   border-gray-400/30   hover:bg-gray-400/10'   },
          ].map(action => (
            <Link key={action.label} href={action.href}
              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors', action.color)}>
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Floating Action Button ─────────────────────────── */}
      <Link href="/expenses"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg glow-blue hover:bg-blue-500 transition-colors z-20">
        <Plus className="h-5 w-5 text-white" />
      </Link>

    </div>
  )
}
