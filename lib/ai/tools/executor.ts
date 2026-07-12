// ============================================================================
// lib/ai/tools/executor.ts
//
// Executes a single tool call against Supabase. This is the ONLY place tool
// calls touch the database (mirrors the Context Builder's role for the
// system-prompt snapshot) — keeping tool execution centralized here makes it
// easy to audit exactly what the AI can read.
//
// Note: this file previously lived at lib/ai/context/tools/executor.ts and
// imported a `getNetWorthBreakdown` helper from lib/calculations/networth
// that was never defined there — a dead import that would have failed
// TypeScript compilation. It's been removed; get_net_worth computes its
// breakdown inline, as it always did.
// ============================================================================

import type { SupabaseServerClient } from '../types'
import { calculateTax } from '@/lib/calculations/taxCalculator'
import {
  comparePeriods, forecastCashFlow, detectRecurringSubscriptions, explainTrend,
} from '../services/reasoning-engine.service'
import { buildFinancialContext } from '../services/context-builder.service'

type Client = SupabaseServerClient

export type ToolName =
  | 'get_net_worth' | 'get_insurance_coverage' | 'get_upcoming_renewals' | 'calculate_tax_estimate'
  | 'get_debt_summary' | 'get_receivables' | 'get_expense_analysis' | 'calculate_tithe'
  | 'get_corporate_benefits' | 'get_investment_portfolio' | 'get_cash_flow' | 'get_rental_status'
  | 'get_documents' | 'get_calendar' | 'get_notifications' | 'get_automations'
  | 'compare_periods' | 'forecast_cash_flow' | 'detect_subscriptions' | 'explain_trend'

export type ToolInput = Record<string, unknown>
export type ToolResult = Record<string, unknown>

export async function executeTool(
  toolName: ToolName,
  input: ToolInput,
  supabase: Client,
  userId: string
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_net_worth':            return executeGetNetWorth(supabase, userId, input)
    case 'get_insurance_coverage':   return executeGetInsurance(supabase, userId, input)
    case 'get_upcoming_renewals':    return executeGetRenewals(supabase, userId, input)
    case 'calculate_tax_estimate':   return executeCalculateTax(supabase, userId, input)
    case 'get_debt_summary':         return executeGetDebt(supabase, userId)
    case 'get_receivables':          return executeGetReceivables(supabase, userId, input)
    case 'get_expense_analysis':     return executeGetExpenses(supabase, userId, input)
    case 'calculate_tithe':          return executeCalculateTithe(supabase, userId, input)
    case 'get_corporate_benefits':   return executeGetBenefits(supabase, userId)
    case 'get_investment_portfolio': return executeGetInvestments(supabase, userId, input)
    case 'get_cash_flow':            return executeGetCashFlow(supabase, userId, input)
    case 'get_rental_status':        return executeGetRental(supabase, userId)
    case 'get_documents':            return executeGetDocuments(supabase, userId, input)
    case 'get_calendar':             return executeGetCalendar(supabase, userId, input)
    case 'get_notifications':        return executeGetNotifications(supabase, userId, input)
    case 'get_automations':          return executeGetAutomations(supabase, userId)
    case 'compare_periods':          return executeComparePeriods(supabase, userId, input)
    case 'forecast_cash_flow':       return executeForecastCashFlow(supabase, userId, input)
    case 'detect_subscriptions':     return executeDetectSubscriptions(supabase, userId, input)
    case 'explain_trend':            return executeExplainTrend(supabase, userId, input)
    default:
      throw new Error(`Unknown tool: ${toolName satisfies never}`)
  }
}

// ─── Original tool implementations ─────────────────────────────────────────────

async function executeGetNetWorth(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const [accounts, investments, receivables, debt, properties] = await Promise.all([
    supabase.from('accounts').select('name, account_type, balance, status').eq('user_id', userId).eq('status', 'active'),
    supabase.from('investments').select('name, investment_type, current_value, invested_amount, unrealized_pnl').eq('user_id', userId),
    supabase.from('receivables').select('from_name, balance_due, status').eq('user_id', userId).not('status', 'in', '("received","written_off")'),
    supabase.from('debt_accounts').select('lender_name, debt_type, outstanding, emi_amount').eq('user_id', userId).eq('is_active', true),
    supabase.from('rental_properties').select('property_name, current_value').eq('user_id', userId),
  ])

  const LIQUID = ['savings', 'current', 'salary', 'wallet', 'cash']
  const liquidCash = (accounts.data ?? []).filter(a => LIQUID.includes(a.account_type)).reduce((s, a) => s + a.balance, 0)
  const investedValue = (investments.data ?? []).reduce((s, i) => s + (i.current_value ?? 0), 0)
  const receivablesTotal = (receivables.data ?? []).reduce((s, r) => s + r.balance_due, 0)
  const realEstateValue = (properties.data ?? []).reduce((s, p) => s + (p.current_value ?? 0), 0)
  const totalDebt = (debt.data ?? []).reduce((s, d) => s + d.outstanding, 0)

  const totalAssets = liquidCash + investedValue + receivablesTotal + realEstateValue
  const netWorth = totalAssets - totalDebt

  const result: ToolResult = {
    net_worth: netWorth,
    total_assets: totalAssets,
    total_liabilities: totalDebt,
    breakdown: { liquid_cash: liquidCash, investments: investedValue, receivables: receivablesTotal, real_estate: realEstateValue },
    liabilities: { total_debt: totalDebt, accounts: (debt.data ?? []).map(d => ({ name: d.lender_name, type: d.debt_type, outstanding: d.outstanding })) },
  }

  if (input.include_history) {
    const { data: history } = await supabase
      .from('net_worth_snapshots')
      .select('snapshot_date, net_worth, total_assets, total_liabilities')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(12)
    result.history = (history ?? []).reverse()
  }

  return result
}

async function executeGetInsurance(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  let query = supabase
    .from('insurance_policies')
    .select('policy_name, insurer_name, insurance_type, status, sum_insured, annual_premium, renewal_date, end_date')
    .eq('user_id', userId)

  if (input.type_filter && input.type_filter !== 'all') query = query.eq('insurance_type', input.type_filter as string)

  const { data, error } = await query.order('renewal_date')
  if (error) throw new Error(error.message)

  const policies = data ?? []
  const totalPremium = policies.reduce((s, p) => s + p.annual_premium, 0)
  const totalCoverage = policies.reduce((s, p) => s + p.sum_insured, 0)
  const in30Days = new Date(Date.now() + 30 * 86400000)

  return {
    total_policies: policies.length,
    total_annual_premium: totalPremium,
    total_coverage: totalCoverage,
    policies,
    renewals_due_soon: policies.filter(p => new Date(p.renewal_date) <= in30Days),
  }
}

async function executeGetRenewals(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const daysAhead = (input.days_ahead as number) ?? 30
  const cutoff = new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

  const [insurance, debts, events] = await Promise.all([
    supabase.from('insurance_policies').select('policy_name, insurer_name, renewal_date, annual_premium, insurance_type')
      .eq('user_id', userId).eq('status', 'active').lte('renewal_date', cutoff),
    supabase.from('debt_accounts').select('lender_name, debt_type, emi_amount, next_emi_date')
      .eq('user_id', userId).eq('is_active', true).lte('next_emi_date', cutoff),
    supabase.from('calendar_events').select('title, event_type, event_date, amount')
      .eq('user_id', userId).eq('is_completed', false).lte('event_date', cutoff),
  ])

  return {
    days_ahead: daysAhead,
    insurance_renewals: insurance.data ?? [],
    emi_due: debts.data ?? [],
    calendar_events: events.data ?? [],
    total_items: (insurance.data?.length ?? 0) + (debts.data?.length ?? 0) + (events.data?.length ?? 0),
  }
}

async function executeCalculateTax(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const currentFY = getCurrentFY()

  const [taxProfile, deductions, income] = await Promise.all([
    supabase.from('tax_profiles').select('*').eq('user_id', userId).eq('financial_year', currentFY).maybeSingle(),
    supabase.from('tax_deductions').select('section, instrument, amount_claimed').eq('user_id', userId),
    supabase.from('income_entries').select('gross_amount, income_type, is_taxable').eq('user_id', userId).eq('financial_year', currentFY),
  ])

  const profile = taxProfile.data
  const grossSalary = profile?.gross_salary ?? (income.data ?? []).filter(i => i.is_taxable).reduce((s, i) => s + i.gross_amount, 0)
  const totalTDS = profile?.total_tds ?? 0
  const total80C = (deductions.data ?? []).filter(d => d.section === '80C').reduce((s, d) => s + d.amount_claimed, 0)
  const total80D = (deductions.data ?? []).filter(d => d.section === '80D').reduce((s, d) => s + d.amount_claimed, 0)
  const hraExemption = profile?.hra_exemption ?? 0

  const oldRegimeDeductions = Math.min(total80C, 150000) + Math.min(total80D, 25000) + hraExemption + 50000
  const newRegimeDeductions = 75000

  const oldResult = calculateTax(grossSalary, oldRegimeDeductions, 'old')
  const newResult = calculateTax(grossSalary, newRegimeDeductions, 'new')

  const regime = (input.regime as string) ?? profile?.regime ?? 'new'

  if (regime === 'compare') {
    return {
      financial_year: currentFY,
      gross_salary: grossSalary,
      old_regime: { ...oldResult, balance_due: Math.max(0, oldResult.totalTax - totalTDS), refund: Math.max(0, totalTDS - oldResult.totalTax) },
      new_regime: { ...newResult, balance_due: Math.max(0, newResult.totalTax - totalTDS), refund: Math.max(0, totalTDS - newResult.totalTax) },
      recommended: oldResult.totalTax < newResult.totalTax ? 'old' : 'new',
      tds_paid: totalTDS,
      deductions_claimed: { '80C': Math.min(total80C, 150000), '80D': total80D, hra: hraExemption },
    }
  }

  const result = regime === 'old' ? oldResult : newResult
  return {
    financial_year: currentFY, regime, gross_salary: grossSalary, ...result,
    tds_paid: totalTDS,
    balance_due: Math.max(0, result.totalTax - totalTDS),
    refund_due: Math.max(0, totalTDS - result.totalTax),
  }
}

async function executeGetDebt(supabase: Client, userId: string): Promise<ToolResult> {
  const { data: debts, error } = await supabase
    .from('debt_accounts').select('*').eq('user_id', userId).eq('is_active', true).order('outstanding', { ascending: false })
  if (error) throw new Error(error.message)

  const list = debts ?? []
  const totalOutstanding = list.reduce((s, d) => s + d.outstanding, 0)
  const totalEMI = list.reduce((s, d) => s + (d.emi_amount ?? 0), 0)

  const { data: income } = await supabase.from('income_entries').select('net_amount').eq('user_id', userId).eq('financial_year', getCurrentFY())
  const monthlyIncome = (income ?? []).reduce((s, i) => s + i.net_amount, 0) / 12

  return {
    total_outstanding: totalOutstanding,
    total_monthly_emi: totalEMI,
    debt_to_income_ratio: monthlyIncome > 0 ? Math.round((totalEMI / monthlyIncome) * 100) : null,
    debts: list.map(d => ({
      name: d.lender_name, type: d.debt_type, outstanding: d.outstanding, emi: d.emi_amount,
      rate: d.interest_rate, next_due: d.next_emi_date, remaining_months: d.remaining_months,
    })),
  }
}

async function executeGetReceivables(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  let query = supabase.from('receivables').select('from_name, from_type, amount, balance_due, due_date, reason, status').eq('user_id', userId)
  if (input.status_filter && input.status_filter !== 'all') query = query.eq('status', input.status_filter as string)

  const { data, error } = await query.order('due_date')
  if (error) throw new Error(error.message)

  const list = data ?? []
  return {
    total_receivable: list.reduce((s, r) => s + r.balance_due, 0),
    overdue_amount: list.filter(r => r.status === 'overdue').reduce((s, r) => s + r.balance_due, 0),
    count: list.length,
    overdue_count: list.filter(r => r.status === 'overdue').length,
    receivables: list,
  }
}

async function executeGetExpenses(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const { startDate, endDate, label } = getPeriodDates(input.period as string)

  let query = supabase.from('transactions').select('amount, category, subcategory, txn_date, description')
    .eq('user_id', userId).eq('txn_type', 'expense').gte('txn_date', startDate).lte('txn_date', endDate)
  if (input.category) query = query.eq('category', input.category as string)

  const { data, error } = await query.order('amount', { ascending: false })
  if (error) throw new Error(error.message)

  const txns = data ?? []
  const total = txns.reduce((s, t) => s + t.amount, 0)
  const byCat: Record<string, number> = {}
  txns.forEach(t => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount })

  const categories = Object.entries(byCat).sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => ({ category: cat, amount: amt, percentage: total > 0 ? Math.round((amt / total) * 100) : 0 }))

  return {
    period: label, start_date: startDate, end_date: endDate, total_expenses: total,
    transaction_count: txns.length, categories, top_category: categories[0] ?? null,
  }
}

async function executeCalculateTithe(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const pct = (input.percentage as number) ?? 10
  const period = (input.period as string) ?? 'this_month'
  const { startDate, endDate, label } = getPeriodDates(period)

  const [income, given] = await Promise.all([
    supabase.from('income_entries').select('net_amount').eq('user_id', userId).gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('tithe_entries').select('amount').eq('user_id', userId).gte('giving_date', startDate).lte('giving_date', endDate),
  ])

  const totalIncome = (income.data ?? []).reduce((s, i) => s + i.net_amount, 0)
  const totalGiven = (given.data ?? []).reduce((s, t) => s + t.amount, 0)
  const titheDue = totalIncome * (pct / 100)
  const balance = titheDue - totalGiven

  return { period: label, income: totalIncome, tithe_percentage: pct, tithe_due: titheDue, already_given: totalGiven, balance_to_give: balance, is_current: balance <= 0 }
}

async function executeGetBenefits(supabase: Client, userId: string): Promise<ToolResult> {
  const { data, error } = await supabase.from('corporate_benefits').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { message: 'No corporate benefits data found. Please add your employer details.' }

  return {
    employer: data.employer_name, financial_year: data.financial_year,
    epf: { employee_contrib: data.epf_employee_contrib, employer_contrib: data.epf_employer_contrib, balance: data.epf_balance, uan: data.uan_number },
    gratuity: { eligible: data.gratuity_eligible, years_of_service: data.years_of_service, estimated: data.estimated_gratuity },
    insurance: { health_cover: data.corporate_health_cover, life_cover: data.corporate_life_cover },
    bonuses: { annual: data.annual_bonus, joining: data.joining_bonus, retention: data.retention_bonus, variable: data.variable_pay },
    benefits: {
      lta_balance: data.lta_balance, medical_reimbursement: data.medical_reimbursement,
      learning_budget: data.learning_budget, learning_used: data.learning_used, learning_remaining: data.learning_budget - data.learning_used,
    },
    leave: { total: data.total_leaves, taken: data.leaves_taken, remaining: (data.total_leaves ?? 0) - (data.leaves_taken ?? 0) },
  }
}

async function executeGetInvestments(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const { data, error } = await supabase.from('investments')
    .select('name, investment_type, invested_amount, current_value, unrealized_pnl, xirr, broker, is_tax_saving').eq('user_id', userId)
  if (error) throw new Error(error.message)

  const list = data ?? []
  const totalInvested = list.reduce((s, i) => s + i.invested_amount, 0)
  const totalCurrent = list.reduce((s, i) => s + (i.current_value ?? 0), 0)
  const totalPnL = totalCurrent - totalInvested

  const grouped: Record<string, { invested: number; current: number; count: number }> = {}
  const groupKey = (input.group_by as string) ?? 'type'
  list.forEach(inv => {
    const key = groupKey === 'broker' ? (inv.broker ?? 'Unknown')
      : groupKey === 'tax_saving' ? (inv.is_tax_saving ? 'Tax Saving' : 'Non Tax Saving')
      : inv.investment_type
    if (!grouped[key]) grouped[key] = { invested: 0, current: 0, count: 0 }
    grouped[key].invested += inv.invested_amount
    grouped[key].current += inv.current_value ?? 0
    grouped[key].count += 1
  })

  return {
    total_invested: totalInvested, total_current_value: totalCurrent, total_pnl: totalPnL,
    total_return_pct: totalInvested > 0 ? Math.round((totalPnL / totalInvested) * 10000) / 100 : 0,
    tax_saving_invested: list.filter(i => i.is_tax_saving).reduce((s, i) => s + i.invested_amount, 0),
    allocation: Object.entries(grouped).map(([name, vals]) => ({
      name, invested: vals.invested, current_value: vals.current, pnl: vals.current - vals.invested,
      count: vals.count, share_pct: totalCurrent > 0 ? Math.round((vals.current / totalCurrent) * 100) : 0,
    })),
    holdings: list,
  }
}

async function executeGetCashFlow(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const { startDate, endDate, label } = getPeriodDates(input.period as string)
  const [income, expenses] = await Promise.all([
    supabase.from('transactions').select('amount, category').eq('user_id', userId).eq('txn_type', 'income').gte('txn_date', startDate).lte('txn_date', endDate),
    supabase.from('transactions').select('amount, category').eq('user_id', userId).eq('txn_type', 'expense').gte('txn_date', startDate).lte('txn_date', endDate),
  ])
  const totalIncome = (income.data ?? []).reduce((s, i) => s + i.amount, 0)
  const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + e.amount, 0)
  const netSavings = totalIncome - totalExpenses

  return {
    period: label, total_income: totalIncome, total_expenses: totalExpenses, net_savings: netSavings,
    savings_rate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0,
    expense_ratio: totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0,
  }
}

async function executeGetRental(supabase: Client, userId: string): Promise<ToolResult> {
  const [properties, payments] = await Promise.all([
    supabase.from('rental_properties').select('*, tenants(*)').eq('user_id', userId),
    supabase.from('rental_payments').select('amount_due, amount_paid, status, tenant_id, month, year').eq('user_id', userId).in('status', ['pending', 'overdue', 'partial']),
  ])
  const props = (properties.data ?? []) as any[]
  const pending = payments.data ?? []

  return {
    total_properties: props.length,
    occupied: props.filter(p => p.is_occupied).length,
    monthly_rent_roll: props.reduce((s, p) => s + p.monthly_rent, 0),
    pending_payments: pending.length,
    total_pending_amount: pending.reduce((s, p) => s + (p.amount_due - p.amount_paid), 0),
    properties: props.map(p => ({ name: p.property_name, unit: p.unit_label, monthly_rent: p.monthly_rent, is_occupied: p.is_occupied, tenant_count: (p.tenants ?? []).length })),
    overdue_payments: pending.filter(p => p.status === 'overdue'),
  }
}

// ─── New tool implementations ────────────────────────────────────────────────

async function executeGetDocuments(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  let query = supabase.from('documents').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false })
  if (input.doc_type) query = query.eq('doc_type', input.doc_type as string)

  const { data, error } = await query.limit(50)
  if (error) throw new Error(error.message)

  let docs = data ?? []
  if (input.expiring_only) {
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    docs = docs.filter(d => d.expiry_date && d.expiry_date <= in30Days)
  }

  return {
    total_documents: docs.length,
    documents: docs.map(d => ({
      title: d.title, type: d.doc_type, uploaded: d.uploaded_at, expiry: d.expiry_date,
      linked_module: d.linked_type, tags: d.tags, financial_year: d.financial_year,
    })),
  }
}

async function executeGetCalendar(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const daysAhead = (input.days_ahead as number) ?? 45
  const cutoff = new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

  const { data, error } = await supabase.from('calendar_events').select('*')
    .eq('user_id', userId).eq('is_completed', false).lte('event_date', cutoff).order('event_date')
  if (error) throw new Error(error.message)

  const events = data ?? []
  return {
    days_ahead: daysAhead,
    total_events: events.length,
    events: events.map(e => ({
      title: e.title, type: e.event_type, date: e.event_date, amount: e.amount,
      days_left: Math.ceil((new Date(e.event_date).getTime() - Date.now()) / 86400000),
    })),
  }
}

async function executeGetNotifications(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  let query = supabase.from('ai_insights').select('*').eq('user_id', userId).eq('is_dismissed', false).order('created_at', { ascending: false }).limit(30)
  if (input.unread_only !== false) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const insights = data ?? []
  return {
    total: insights.length,
    critical_count: insights.filter(i => i.severity === 'critical').length,
    notifications: insights.map(i => ({ title: i.title, body: i.body, severity: i.severity, module: i.linked_module, created: i.created_at })),
  }
}

async function executeGetAutomations(supabase: Client, userId: string): Promise<ToolResult> {
  const { data, error } = await supabase.from('automations').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const automations = data ?? []
  return {
    total: automations.length,
    active_count: automations.filter(a => a.status === 'active').length,
    automations: automations.map(a => ({
      name: a.name, category: a.category, status: a.status, run_count: a.run_count,
      success_count: a.success_count, last_run: a.last_run_at, created_via_copilot: a.created_via_copilot,
    })),
  }
}

// ─── Reasoning Engine-backed tools ───────────────────────────────────────────

async function executeComparePeriods(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const result = await comparePeriods(
    supabase, userId,
    input.metric as 'expenses' | 'income' | 'savings',
    input.period_a as string,
    input.period_b as string
  )
  return { ...result }
}

async function executeForecastCashFlow(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const ctx = await buildFinancialContext(supabase, userId)
  const months = Math.min(12, (input.months_ahead as number) ?? 3)
  const result = await forecastCashFlow(supabase, userId, ctx, months)
  return { ...result }
}

async function executeDetectSubscriptions(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const lookback = (input.lookback_months as number) ?? 6
  const subscriptions = await detectRecurringSubscriptions(supabase, userId, lookback)
  return {
    count: subscriptions.length,
    total_annual_cost: subscriptions.reduce((s, sub) => s + sub.annualCost, 0),
    subscriptions,
  }
}

async function executeExplainTrend(supabase: Client, userId: string, input: ToolInput): Promise<ToolResult> {
  const ctx = await buildFinancialContext(supabase, userId)
  const result = await explainTrend(supabase, userId, ctx, input.metric as 'net_worth' | 'expenses' | 'savings_rate' | 'investments')
  return { ...result }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function getCurrentFY(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${String(year + 1).slice(2)}`
}

function getPeriodDates(period: string): { startDate: string; endDate: string; label: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (period) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: fmt(start), endDate: fmt(end), label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: fmt(start), endDate: fmt(end), label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
    }
    case 'last_3_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return { startDate: fmt(start), endDate: fmt(now), label: 'Last 3 months' }
    }
    case 'this_fy': {
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return { startDate: `${fyStart}-04-01`, endDate: `${fyStart + 1}-03-31`, label: `FY ${fyStart}-${fyStart + 1}` }
    }
    default:
      return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now), label: 'This month' }
  }
}
