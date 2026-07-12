// ============================================================================
// lib/ai/services/reasoning-engine.service.ts
//
// FINANCIAL REASONING ENGINE
// ----------------------------
// Where the Context Builder answers "what is true right now", the Reasoning
// Engine answers "what does it mean" — trends, period-over-period
// comparisons, cash-flow forecasts, and recurring-subscription detection.
// These are Requirement 6 capabilities and Requirement 5 ("reasoning across
// multiple modules instead of a single data source").
//
// Each function pulls whatever additional historical data it needs directly
// (a single FinancialContext snapshot only covers "now" + 45 days ahead —
// trends and forecasts need months of history the Context Builder doesn't
// carry by default, to keep it cheap to build on every chat turn).
// ============================================================================

import type { SupabaseServerClient } from '../types'
import type {
  FinancialContext, TrendExplanation, PeriodComparison,
  CashFlowForecast, CashFlowForecastMonth, RecurringSubscription,
} from '../types'

type Client = SupabaseServerClient

// ── Trend explanation (uses net_worth_snapshots + the already-built context) ─

export async function explainTrend(
  supabase: Client,
  userId: string,
  ctx: FinancialContext,
  metric: 'net_worth' | 'expenses' | 'savings_rate' | 'investments'
): Promise<TrendExplanation> {
  if (metric === 'expenses') {
    const changePct = ctx.lastMonthSpend > 0
      ? ((ctx.thisMonthSpend - ctx.lastMonthSpend) / ctx.lastMonthSpend) * 100 : 0
    return {
      metric: 'Monthly expenses',
      direction: changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'flat',
      changePct: Math.round(changePct * 10) / 10,
      why: `This month: ₹${ctx.thisMonthSpend.toLocaleString('en-IN')} vs last month: ₹${ctx.lastMonthSpend.toLocaleString('en-IN')}. ` +
        `Top driver: ${ctx.topCategories[0]?.category ?? 'n/a'} at ₹${(ctx.topCategories[0]?.amount ?? 0).toLocaleString('en-IN')} (${ctx.topCategories[0]?.pct ?? 0}% of spend).`,
      sources: ['Expenses'],
    }
  }

  if (metric === 'savings_rate') {
    return {
      metric: 'Savings rate',
      direction: ctx.savingsRate >= 20 ? 'up' : 'down',
      changePct: Math.round(ctx.savingsRate * 10) / 10,
      why: `Savings rate = (monthly income − monthly expenses) / monthly income = ${ctx.savingsRate.toFixed(1)}%. The recommended benchmark is 20%+.`,
      sources: ['Income', 'Expenses'],
    }
  }

  if (metric === 'investments') {
    return {
      metric: 'Investment portfolio',
      direction: ctx.portfolioGainPct > 0 ? 'up' : ctx.portfolioGainPct < 0 ? 'down' : 'flat',
      changePct: Math.round(ctx.portfolioGainPct * 10) / 10,
      why: `Invested ₹${ctx.totalInvested.toLocaleString('en-IN')}, now worth ₹${ctx.portfolioValue.toLocaleString('en-IN')} — a ${ctx.portfolioGainPct.toFixed(1)}% unrealized ${ctx.portfolioGain >= 0 ? 'gain' : 'loss'}.`,
      sources: ['Investments'],
    }
  }

  // net_worth — needs history
  const { data: history } = await supabase
    .from('net_worth_snapshots')
    .select('snapshot_date, net_worth')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(2)

  const rows = history ?? []
  if (rows.length < 2) {
    return {
      metric: 'Net worth', direction: 'flat', changePct: 0,
      why: `Current net worth is ₹${ctx.netWorth.toLocaleString('en-IN')}. Not enough historical snapshots yet to compute a trend.`,
      sources: ['Analytics'],
    }
  }
  const [latest, prior] = rows
  const changePct = prior.net_worth !== 0 ? ((latest.net_worth - prior.net_worth) / Math.abs(prior.net_worth)) * 100 : 0
  return {
    metric: 'Net worth',
    direction: changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'flat',
    changePct: Math.round(changePct * 10) / 10,
    why: `Net worth moved from ₹${prior.net_worth.toLocaleString('en-IN')} (${prior.snapshot_date}) to ₹${latest.net_worth.toLocaleString('en-IN')} (${latest.snapshot_date}).`,
    sources: ['Analytics', 'Accounts', 'Investments', 'Debt'],
  }
}

// ── Period comparison ────────────────────────────────────────────────────────

function resolvePeriodRange(period: string): { start: string; end: string; label: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (period) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: fmt(start), end: fmt(end), label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: fmt(start), end: fmt(end), label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      const start = new Date(now.getFullYear(), qStartMonth, 1)
      return { start: fmt(start), end: fmt(now), label: `Q${Math.floor(qStartMonth / 3) + 1} ${now.getFullYear()}` }
    }
    case 'last_quarter': {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3 - 3
      const start = new Date(now.getFullYear(), qStartMonth, 1)
      const end = new Date(now.getFullYear(), qStartMonth + 3, 0)
      return { start: fmt(start), end: fmt(end), label: `Q${Math.floor(((qStartMonth % 12) + 12) % 12 / 3) + 1}` }
    }
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: fmt(start), end: fmt(now), label: 'This month' }
    }
  }
}

export async function comparePeriods(
  supabase: Client,
  userId: string,
  metric: 'expenses' | 'income' | 'savings',
  periodA: string,
  periodB: string
): Promise<PeriodComparison> {
  const a = resolvePeriodRange(periodA)
  const b = resolvePeriodRange(periodB)

  async function totalFor(range: { start: string; end: string }, type: 'income' | 'expense') {
    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('txn_type', type)
      .gte('txn_date', range.start)
      .lte('txn_date', range.end)
    return (data ?? []).reduce((s, r) => s + r.amount, 0)
  }

  let valueA = 0; let valueB = 0; let label = ''
  if (metric === 'expenses') {
    valueA = await totalFor(a, 'expense'); valueB = await totalFor(b, 'expense'); label = 'Expenses'
  } else if (metric === 'income') {
    valueA = await totalFor(a, 'income'); valueB = await totalFor(b, 'income'); label = 'Income'
  } else {
    const [incA, expA, incB, expB] = await Promise.all([
      totalFor(a, 'income'), totalFor(a, 'expense'), totalFor(b, 'income'), totalFor(b, 'expense'),
    ])
    valueA = incA - expA; valueB = incB - expB; label = 'Net savings'
  }

  const changeAbs = valueA - valueB
  const changePct = valueB !== 0 ? (changeAbs / Math.abs(valueB)) * 100 : 0

  return {
    metric: label,
    periodALabel: a.label, periodBLabel: b.label,
    periodAValue: Math.round(valueA), periodBValue: Math.round(valueB),
    changeAbs: Math.round(changeAbs), changePct: Math.round(changePct * 10) / 10,
    narrative: `${label} in ${a.label} was ₹${Math.round(valueA).toLocaleString('en-IN')} vs ₹${Math.round(valueB).toLocaleString('en-IN')} in ${b.label} — a ${changeAbs >= 0 ? 'increase' : 'decrease'} of ₹${Math.abs(Math.round(changeAbs)).toLocaleString('en-IN')} (${Math.abs(changePct).toFixed(1)}%).`,
  }
}

// ── Cash-flow forecast ───────────────────────────────────────────────────────
// Simple, explainable moving-average projection: uses the last 3 months of
// actual income/expense to project N months forward from current liquid cash.
// Deliberately conservative and transparent rather than a black-box model —
// the Copilot always states the basis so the user can judge how much to trust it.

export async function forecastCashFlow(
  supabase: Client,
  userId: string,
  ctx: FinancialContext,
  monthsAhead: number = 3
): Promise<CashFlowForecast> {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, txn_type, txn_date')
    .eq('user_id', userId)
    .in('txn_type', ['income', 'expense'])
    .gte('txn_date', threeMonthsAgo)

  const rows = txns ?? []
  const byMonth: Record<string, { income: number; expense: number }> = {}
  rows.forEach(t => {
    const key = t.txn_date.slice(0, 7) // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 }
    if (t.txn_type === 'income') byMonth[key].income += t.amount
    else byMonth[key].expense += t.amount
  })
  const monthKeys = Object.keys(byMonth).sort()
  const sampleSize = monthKeys.length || 1
  const avgIncome  = monthKeys.reduce((s, k) => s + byMonth[k].income, 0) / sampleSize || ctx.monthlyIncome
  const avgExpense = monthKeys.reduce((s, k) => s + byMonth[k].expense, 0) / sampleSize || ctx.thisMonthSpend

  const months: CashFlowForecastMonth[] = []
  let runningBalance = ctx.liquidCash
  for (let i = 1; i <= monthsAhead; i++) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const projectedNet = avgIncome - avgExpense - ctx.totalEMI
    runningBalance += projectedNet
    months.push({
      month: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`,
      projectedIncome: Math.round(avgIncome),
      projectedExpense: Math.round(avgExpense + ctx.totalEMI),
      projectedNet: Math.round(projectedNet),
      runningBalance: Math.round(runningBalance),
    })
  }

  return {
    basis: `Projection uses the ${sampleSize}-month average income (₹${Math.round(avgIncome).toLocaleString('en-IN')}) and expenses (₹${Math.round(avgExpense).toLocaleString('en-IN')}), minus fixed monthly EMI (₹${ctx.totalEMI.toLocaleString('en-IN')}), applied forward from today's liquid cash of ₹${ctx.liquidCash.toLocaleString('en-IN')}. It does not account for one-off expenses, bonuses, or investment withdrawals.`,
    months,
    confidence: sampleSize >= 3 ? 'Medium' : 'Low',
  }
}

// ── Recurring subscription detection ─────────────────────────────────────────
// Groups debit transactions by (category, rounded amount) and flags groups
// that repeat on a roughly monthly cadence — a lightweight, explainable
// heuristic rather than ML, so the "why" stays inspectable.

export async function detectRecurringSubscriptions(
  supabase: Client,
  userId: string,
  lookbackMonths: number = 6
): Promise<RecurringSubscription[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - lookbackMonths)

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, category, txn_date, description')
    .eq('user_id', userId)
    .eq('direction', 'debit')
    .gte('txn_date', since.toISOString().split('T')[0])
    .order('txn_date', { ascending: true })

  const rows = txns ?? []
  type Row = { amount: number; category: string; txn_date: string; description: string | null }

  // Group by category + amount bucket (rounded to nearest 10 to absorb minor
  // fee variance between billing cycles).
  const groups = new Map<string, Row[]>()
  rows.forEach((t: Row) => {
    const bucket = Math.round(t.amount / 10) * 10
    const key = `${t.category}::${bucket}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  })

  const subscriptions: RecurringSubscription[] = []
  groups.forEach((group, key) => {
    if (group.length < 3) return // need at least 3 occurrences to call it "recurring"

    const dates = group.map(g => new Date(g.txn_date).getTime()).sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000)
    const avgGapDays = gaps.reduce((s, g) => s + g, 0) / gaps.length

    let cadence: RecurringSubscription['cadence'] = 'irregular'
    if (avgGapDays >= 25 && avgGapDays <= 35) cadence = 'monthly'
    else if (avgGapDays >= 5 && avgGapDays <= 9) cadence = 'weekly'
    if (cadence === 'irregular') return // only surface confident matches

    const category = key.split('::')[0]
    const avgAmount = group.reduce((s, g) => s + g.amount, 0) / group.length
    subscriptions.push({
      merchantOrCategory: group[0].description || category,
      averageAmount: Math.round(avgAmount),
      occurrences: group.length,
      cadence,
      lastSeen: group[group.length - 1].txn_date,
      annualCost: Math.round(cadence === 'monthly' ? avgAmount * 12 : avgAmount * 52),
    })
  })

  return subscriptions.sort((a, b) => b.annualCost - a.annualCost)
}
