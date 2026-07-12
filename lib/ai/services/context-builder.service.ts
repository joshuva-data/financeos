// ============================================================================
// lib/ai/services/context-builder.service.ts
//
// CONTEXT BUILDER
// ----------------
// Collects structured data from every FinanceOS module — Accounts, Income,
// Expenses, Investments, Debt, Insurance, Taxes, Goals, Documents, Analytics,
// Calendar, Notifications, Automation — and normalizes it into a single
// FinancialContext object (lib/ai/types.ts).
//
// This is the ONLY place that talks to Supabase for the purpose of AI
// reasoning. Every other AI service (Reasoning Engine, Recommendation Engine,
// Action Generator, Prompt Orchestrator) consumes the FinancialContext this
// produces rather than querying the database directly — that separation is
// what keeps the AI layer testable and swappable.
//
// All fetches run in parallel (Promise.all) to keep context-build latency low
// even though 13 modules are involved.
// ============================================================================

import type { SupabaseServerClient } from '../types'
import type {
  FinancialContext, AccountSummary, IncomeSummary, ExpenseSummary,
  DebtSummary, GoalSummary, InsuranceSummary, InvestmentSummary,
  DocumentSummary, CalendarEventSummary, NotificationSummary, AutomationSummary,
} from '../types'

type Client = SupabaseServerClient

const LIQUID_ACCOUNT_TYPES = ['savings', 'current', 'salary', 'wallet', 'cash']

export async function buildFinancialContext(
  supabase: Client,
  userId:   string
): Promise<FinancialContext> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLast   = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLast      = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const in45Days        = new Date(now.getTime() + 45 * 86400000).toISOString().split('T')[0]
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  // ── Fetch every module in parallel ─────────────────────────────────────────
  const [
    { data: accounts },
    { data: income },
    { data: thisMonthTxns },
    { data: lastMonthTxns },
    { data: debts },
    { data: investments },
    { data: goals },
    { data: insurance },
    { data: tithe },
    { data: receivables },
    { data: documents },
    { data: calendarEvents },
    { data: notifications },
    { data: automations },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).eq('status', 'active'),
    supabase.from('income_entries').select('*').eq('user_id', userId).eq('financial_year', currentFY),
    supabase.from('transactions').select('*').eq('user_id', userId).gte('txn_date', startOfMonth),
    supabase.from('transactions').select('amount, direction, category').eq('user_id', userId)
      .gte('txn_date', startOfLast).lte('txn_date', endOfLast),
    supabase.from('debt_accounts').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('investments').select('*').eq('user_id', userId),
    supabase.from('financial_goals').select('*').eq('user_id', userId),
    supabase.from('insurance_policies').select('*').eq('user_id', userId).eq('status', 'active'),
    supabase.from('tithe_entries').select('amount').eq('user_id', userId).gte('giving_date', startOfMonth),
    supabase.from('receivables').select('*').eq('user_id', userId).neq('status', 'received'),
    supabase.from('documents').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }).limit(50),
    supabase.from('calendar_events').select('*').eq('user_id', userId).eq('is_completed', false).lte('event_date', in45Days),
    supabase.from('ai_insights').select('*').eq('user_id', userId).eq('is_dismissed', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('automations').select('*').eq('user_id', userId),
  ])

  const acc = accounts ?? []; const inc = income ?? []; const txns = thisMonthTxns ?? []; const last = lastMonthTxns ?? []
  const dbt = debts ?? []; const inv = investments ?? []; const gls = goals ?? []; const ins = insurance ?? []
  const tth = tithe ?? []; const rcv = receivables ?? []; const docs = documents ?? []
  const cal = calendarEvents ?? []; const notif = notifications ?? []; const auto = automations ?? []

  // ── 1. Accounts ─────────────────────────────────────────────────────────────
  const accountSummaries: AccountSummary[] = acc.map(a => ({
    id: a.id, name: a.name, type: a.account_type, bank: a.bank_name, balance: a.balance,
  }))
  const liquidCash  = acc.filter(a => LIQUID_ACCOUNT_TYPES.includes(a.account_type)).reduce((s, a) => s + a.balance, 0)
  const totalInvAmt = inv.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalAssets = liquidCash + totalInvAmt

  // ── 2. Income ───────────────────────────────────────────────────────────────
  const incomeSummaries: IncomeSummary[] = inc.map(i => ({
    source: i.source_name, type: i.income_type, gross: i.gross_amount,
    net: i.net_amount, tds: i.tds_deducted, month: i.month, fy: i.financial_year,
  }))
  const annualIncome  = inc.reduce((s, i) => s + i.net_amount, 0)
  const annualGross   = inc.reduce((s, i) => s + i.gross_amount, 0)
  const annualTDS     = inc.reduce((s, i) => s + i.tds_deducted, 0)
  const monthlyIncome = annualIncome / 12

  // ── 3. Expenses ─────────────────────────────────────────────────────────────
  const expenseSummaries: ExpenseSummary[] = txns.map(t => ({
    category: t.category, amount: t.amount, month: now.getMonth() + 1, direction: t.direction, date: t.txn_date,
  }))
  const thisMonthSpend = txns.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const lastMonthSpend = last.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
  const byCat: Record<string, number> = {}
  txns.filter(t => t.direction === 'debit').forEach(t => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount })
  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([category, amount]) => ({ category, amount, pct: thisMonthSpend > 0 ? Math.round((amount / thisMonthSpend) * 100) : 0 }))

  // ── 4. Investments ──────────────────────────────────────────────────────────
  const investmentSummaries: InvestmentSummary[] = inv.map(i => {
    const cur = i.current_value ?? i.invested_amount
    const gain = cur - i.invested_amount
    return {
      name: i.name, type: i.investment_type, invested: i.invested_amount,
      currentValue: cur, gain, gainPct: i.invested_amount > 0 ? (gain / i.invested_amount) * 100 : 0,
    }
  })
  const totalInvested    = inv.reduce((s, i) => s + i.invested_amount, 0)
  const portfolioValue   = inv.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const portfolioGain    = portfolioValue - totalInvested
  const portfolioGainPct = totalInvested > 0 ? (portfolioGain / totalInvested) * 100 : 0

  // ── 5. Debt ─────────────────────────────────────────────────────────────────
  const debtSummaries: DebtSummary[] = dbt.map(d => ({
    lender: d.lender_name, type: d.debt_type, outstanding: d.outstanding,
    emi: d.emi_amount ?? 0, rate: d.interest_rate, nextEmiDate: d.next_emi_date,
  }))
  const totalDebt = dbt.reduce((s, d) => s + d.outstanding, 0)
  const totalEMI  = dbt.reduce((s, d) => s + (d.emi_amount ?? 0), 0)
  const debtRatio = monthlyIncome > 0 ? Math.round((totalEMI / monthlyIncome) * 100) : 0

  // ── 6. Insurance ────────────────────────────────────────────────────────────
  const insuranceSummaries: InsuranceSummary[] = ins.map(p => ({
    name: p.policy_name, type: p.insurance_type, premium: p.annual_premium ?? 0,
    coverage: p.sum_assured ?? 0, renewalDate: p.renewal_date,
  }))
  const totalCoverage = ins.reduce((s, p) => s + (p.sum_assured ?? 0), 0)
  const totalPremium  = ins.reduce((s, p) => s + (p.annual_premium ?? 0), 0)

  // ── 7. Taxes (computed) ─────────────────────────────────────────────────────
  const sec80C = inv.filter(i => ['ppf', 'elss', 'nps'].includes(i.investment_type)).reduce((s, i) => s + i.invested_amount, 0)
  const sec80G = 0 // reserved: from tithe tax-deductible entries once that flag exists
  const standardDeduction = 50000
  const taxableIncome = Math.max(0, annualGross - Math.min(sec80C, 150000) - sec80G - standardDeduction)
  let estimatedTax = 0
  if (taxableIncome > 1500000)      estimatedTax = 150000 + (taxableIncome - 1500000) * 0.30
  else if (taxableIncome > 1200000) estimatedTax =  90000 + (taxableIncome - 1200000) * 0.20
  else if (taxableIncome > 900000)  estimatedTax =  45000 + (taxableIncome - 900000)  * 0.15
  else if (taxableIncome > 600000)  estimatedTax =  15000 + (taxableIncome - 600000)  * 0.10
  else if (taxableIncome > 300000)  estimatedTax =           (taxableIncome - 300000) * 0.05
  const taxDue = Math.max(0, estimatedTax - annualTDS)

  // ── 8. Goals ────────────────────────────────────────────────────────────────
  const goalSummaries: GoalSummary[] = gls.map(g => ({
    name: g.name, target: g.target_amount, current: g.current_amount,
    pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
    targetDate: g.target_date, status: g.status,
  }))
  const activeGoals    = gls.filter(g => g.status === 'active').length
  const completedGoals = gls.filter(g => g.status === 'completed').length

  // ── 9. Documents ────────────────────────────────────────────────────────────
  const documentSummaries: DocumentSummary[] = docs.map(d => ({
    id: d.id, title: d.title, type: d.doc_type, uploadedAt: d.uploaded_at,
    expiryDate: d.expiry_date, linkedType: d.linked_type,
  }))
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
  const expiringDocuments = documentSummaries.filter(d => d.expiryDate && d.expiryDate <= in30Days)

  // ── 11. Calendar (next 45 days) ─────────────────────────────────────────────
  // Combine the explicit calendar_events table with derived events (EMI due
  // dates, insurance renewals) so the Calendar module is complete even before
  // the user has manually logged anything.
  const upcomingEvents: CalendarEventSummary[] = []
  cal.forEach(e => {
    const days = Math.ceil((new Date(e.event_date).getTime() - Date.now()) / 86400000)
    upcomingEvents.push({ id: e.id, label: e.title, date: e.event_date, amount: e.amount ?? undefined, type: e.event_type, daysLeft: days })
  })
  dbt.forEach(d => {
    if (d.next_emi_date) {
      const days = Math.ceil((new Date(d.next_emi_date).getTime() - Date.now()) / 86400000)
      if (days >= 0 && days <= 45) upcomingEvents.push({ id: `emi-${d.id}`, label: `${d.lender_name} EMI`, date: d.next_emi_date, amount: d.emi_amount, type: 'emi', daysLeft: days })
    }
  })
  ins.forEach(p => {
    if (p.renewal_date) {
      const days = Math.ceil((new Date(p.renewal_date).getTime() - Date.now()) / 86400000)
      if (days >= 0 && days <= 45) upcomingEvents.push({ id: `ins-${p.id}`, label: `${p.policy_name} renewal`, date: p.renewal_date, amount: p.annual_premium, type: 'renewal', daysLeft: days })
    }
  })
  // De-dupe (a calendar_events row and a derived EMI/renewal row can describe the same thing)
  const seen = new Set<string>()
  const dedupedEvents = upcomingEvents
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .filter(e => {
      const key = `${e.label}-${e.date}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  // ── 10. Analytics (derived cross-module metrics) ────────────────────────────
  const netWorth = liquidCash + portfolioValue - totalDebt
  const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - thisMonthSpend) / monthlyIncome) * 100 : 0
  const emergencyFundMonths = monthlyIncome > 0 ? liquidCash / monthlyIncome : 0
  let healthScore = 40
  if (liquidCash >= monthlyIncome * 3) healthScore += 15
  if (debtRatio < 30)                  healthScore += 15
  if (gls.length > 0)                  healthScore += 10
  if (totalInvested > 0)               healthScore += 10
  if (rcv.filter(r => r.status === 'overdue').length === 0) healthScore += 5
  if (ins.length > 0)                  healthScore += 5
  healthScore = Math.min(100, healthScore)

  // ── 12. Notifications ────────────────────────────────────────────────────────
  const notificationSummaries: NotificationSummary[] = notif.map(n => ({
    id: n.id, title: n.title, body: n.body, severity: n.severity, isRead: n.is_read, createdAt: n.created_at,
  }))

  // ── 13. Automation ───────────────────────────────────────────────────────────
  const automationSummaries: AutomationSummary[] = auto.map(a => ({
    id: a.id, name: a.name, category: a.category, status: a.status,
    runCount: a.run_count, lastRunAt: a.last_run_at,
  }))

  // ── Tithe / Receivables (kept from prior context builder) ──────────────────
  const titheThisMonth = tth.reduce((s, t) => s + t.amount, 0)
  const titheTarget    = monthlyIncome * 0.1
  const pendingReceivables = rcv.map(r => ({ from: r.from_name, amount: r.balance_due, status: r.status }))

  return {
    builtAt: now.toISOString(), userId, currentFY,
    accounts: accountSummaries, liquidCash, totalAssets,
    income: incomeSummaries, annualIncome, monthlyIncome, annualTDS,
    expenses: expenseSummaries, thisMonthSpend, lastMonthSpend, topCategories,
    investments: investmentSummaries, totalInvested, portfolioValue, portfolioGain, portfolioGainPct,
    debts: debtSummaries, totalDebt, totalEMI, debtRatio,
    insurance: insuranceSummaries, totalCoverage, totalPremium,
    grossIncome: annualGross, taxableIncome, estimatedTax, taxPaid: annualTDS, taxDue, sec80C, sec80G,
    goals: goalSummaries, activeGoals, completedGoals,
    documents: documentSummaries, expiringDocuments,
    netWorth, healthScore, savingsRate, emergencyFundMonths,
    upcomingEvents: dedupedEvents,
    notifications: notificationSummaries, unreadNotificationCount: notif.filter(n => !n.is_read).length,
    automations: automationSummaries, activeAutomationCount: auto.filter(a => a.status === 'active').length,
    titheThisMonth, titheTarget, pendingReceivables,
  }
}
