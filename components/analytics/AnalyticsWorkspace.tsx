'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer } from '@/components/charts/ChartContainer'
import type { DashboardSummary } from '@/types/database'
import { fmtINRCompact } from '@/lib/utils/currency'
import { tokens } from '@/styles/tokens'

// Mock monthly data (replace with real DB queries)
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
const genSeries = (base: number, variance = 0.1) => MONTHS.map(m => ({ month: m, value: Math.round(base * (1 + (Math.random() - 0.5) * variance)) }))

interface AnalyticsWorkspaceProps { summary: DashboardSummary }

export function AnalyticsWorkspace({ summary }: AnalyticsWorkspaceProps) {
  const incomeData = genSeries(summary.monthlyIncome, 0.15)
  const expenseData = genSeries(summary.monthlyExpenses, 0.2)
  const combined = MONTHS.map((m, i) => ({ month: m, income: incomeData[i].value, expense: expenseData[i].value, savings: incomeData[i].value - expenseData[i].value }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">12-month trend analysis · FY 2025–26</p>
      </div>

      <Tabs defaultValue="income">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          {['income', 'expenses', 'cashflow', 'insurance', 'investments', 'debt'].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="income" className="mt-4 space-y-4">
          <ChartContainer title="Monthly Income Trend" subtitle="Net income after TDS" height={220}>
            <AreaChart data={incomeData}>
              <defs><linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Income']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <ChartContainer title="Monthly Expense Trend" subtitle="Total spend per month" height={220}>
            <BarChart data={expenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Expenses']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#ef4444" opacity={0.8} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChartContainer title="By Category" height={160} legend={summary.topExpenseCategories.map((c, i) => ({ color: tokens.chart[i], label: c.category }))}>
              <PieChart>
                <Pie data={summary.topExpenseCategories} dataKey="amount" cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={0}>
                  {summary.topExpenseCategories.map((_, i) => <Cell key={i} fill={tokens.chart[i % tokens.chart.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ChartContainer>
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4 space-y-4">
          <ChartContainer title="Income vs Expenses vs Savings" subtitle="Monthly comparison" height={240}
            legend={[{ color: '#10b981', label: 'Income' }, { color: '#ef4444', label: 'Expenses' }, { color: '#6366f1', label: 'Savings' }]}>
            <AreaChart data={combined}>
              <defs>
                {[['income', '#10b981'], ['expense', '#ef4444'], ['savings', '#6366f1']].map(([k, c]) => (
                  <linearGradient key={k} id={`${k}Grad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.15} /><stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v: number, n: string) => [`₹${v.toLocaleString('en-IN')}`, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="savings" stroke="#6366f1" fill="url(#savingsGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <p className="text-sm font-medium">Insurance Analytics</p>
            <p className="text-xs text-muted-foreground">Portfolio health, renewal schedule, and premium trends. Connect your insurance data for detailed analytics.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Total Premium', '₹98,300/yr'], ['Policies', '4 active'], ['Health Cover', '₹50 Lakhs'], ['Life Cover', '₹1 Crore']].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border/40 p-3 space-y-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k}</p><p className="text-base font-semibold">{v}</p></div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <ChartContainer title="Portfolio Growth" subtitle="Estimated value over time" height={200}>
            <AreaChart data={genSeries(summary.investedValue, 0.08)}>
              <defs><linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Portfolio']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#portGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="debt" className="mt-4">
          <ChartContainer title="Debt Reduction Trend" subtitle="Outstanding balance over time" height={200}>
            <AreaChart data={MONTHS.map((m, i) => ({ month: m, value: Math.round(summary.debtTotal * (1 - i * 0.015)) }))}>
              <defs><linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtINRCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Outstanding']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#debtGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        </TabsContent>
      </Tabs>
    </div>
  )
}