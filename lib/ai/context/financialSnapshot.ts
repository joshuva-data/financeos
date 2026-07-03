import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export interface FinancialSnapshot {
  userName: string
  currentFY: string
  netWorth: number
  liquidCash: number
  monthlyIncome: number
  monthlyExpenses: number
  totalDebt: number
  totalEMI: number
  totalReceivable: number
  overdueReceivables: number
  upcomingRenewals: Array<{ name: string; date: string; amount: number; type: string }>
  upcomingEMIs: Array<{ name: string; date: string; amount: number }>
  recentExpenses: Array<{ category: string; amount: number }>
  activeLoanCount: number
  insurancePolicyCount: number
  goalsCount: number
  goalsProgress: number   // overall % complete
}

export async function loadFinancialSnapshot(
  supabase: Client,
  userId: string
): Promise<FinancialSnapshot> {
  const now = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const in30Days     = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    profileRes, accountsRes, incomeRes, expensesRes,
    debtRes, receivablesRes, insuranceRes, goalsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('accounts').select('account_type, balance, status').eq('user_id', userId).eq('status', 'active'),
    supabase.from('income_entries').select('net_amount').eq('user_id', userId).eq('financial_year', currentFY),
    supabase.from('transactions').select('amount, category').eq('user_id', userId).eq('txn_type', 'expense').gte('txn_date', startOfMonth),
    supabase.from('debt_accounts').select('outstanding, emi_amount, lender_name, next_emi_date').eq('user_id', userId).eq('is_active', true),
    supabase.from('receivables').select('balance_due, status, from_name, due_date').eq('user_id', userId).neq('status', 'received'),
    supabase.from('insurance_policies').select('policy_name, renewal_date, annual_premium, insurance_type').eq('user_id', userId).eq('status', 'active').lte('renewal_date', in30Days),
    supabase.from('financial_goals').select('current_amount, target_amount, status').eq('user_id', userId).eq('status', 'active'),
  ])

  const LIQUID = ['savings', 'current', 'salary', 'wallet', 'cash']
  const accounts = accountsRes.data ?? []
  const liquidCash = accounts.filter(a => LIQUID.includes(a.account_type)).reduce((s, a) => s + a.balance, 0)

  const income   = incomeRes.data ?? []
  const monthlyIncome = income.reduce((s, i) => s + i.net_amount, 0) / 12

  const expenses = expensesRes.data ?? []
  const monthlyExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})
  const recentExpenses = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))

  const debts        = debtRes.data ?? []
  const totalDebt    = debts.reduce((s, d) => s + d.outstanding, 0)
  const totalEMI     = debts.reduce((s, d) => s + (d.emi_amount ?? 0), 0)
  const upcomingEMIs = debts
    .filter(d => d.next_emi_date)
    .sort((a, b) => new Date(a.next_emi_date!).getTime() - new Date(b.next_emi_date!).getTime())
    .slice(0, 3)
    .map(d => ({ name: d.lender_name, date: d.next_emi_date!, amount: d.emi_amount ?? 0 }))

  const receivables       = receivablesRes.data ?? []
  const totalReceivable   = receivables.reduce((s, r) => s + r.balance_due, 0)
  const overdueReceivables = receivables.filter(r => r.status === 'overdue').reduce((s, r) => s + r.balance_due, 0)

  const upcomingRenewals = (insuranceRes.data ?? []).map(p => ({
    name: p.policy_name, date: p.renewal_date, amount: p.annual_premium, type: p.insurance_type,
  }))

  const goals           = goalsRes.data ?? []
  const goalsCount      = goals.length
  const totalTarget     = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalSaved      = goals.reduce((s, g) => s + g.current_amount, 0)
  const goalsProgress   = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0
  const netWorth        = liquidCash + totalSaved - totalDebt  // simplified

  return {
    userName: profileRes.data?.full_name ?? 'there',
    currentFY,
    netWorth,
    liquidCash,
    monthlyIncome,
    monthlyExpenses,
    totalDebt,
    totalEMI,
    totalReceivable,
    overdueReceivables,
    upcomingRenewals,
    upcomingEMIs,
    recentExpenses,
    activeLoanCount:      debts.length,
    insurancePolicyCount: (insuranceRes.data ?? []).length,
    goalsCount,
    goalsProgress,
  }
}

export function buildSystemPromptWithSnapshot(snapshot: FinancialSnapshot): string {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const renewalLines = snapshot.upcomingRenewals.length > 0
    ? snapshot.upcomingRenewals.map(r => `  - ${r.name} (${r.type}): ${fmt(r.amount)}/yr due ${fmtDate(r.date)}`).join('\n')
    : '  - None in next 30 days'

  const emiLines = snapshot.upcomingEMIs.length > 0
    ? snapshot.upcomingEMIs.map(e => `  - ${e.name}: ${fmt(e.amount)} due ${fmtDate(e.date)}`).join('\n')
    : '  - None upcoming'

  const expenseLines = snapshot.recentExpenses.length > 0
    ? snapshot.recentExpenses.map(e => `  - ${e.category}: ${fmt(e.amount)}`).join('\n')
    : '  - No data'

  return `You are the AI Financial Copilot for FinanceOS — a personal finance OS for ${snapshot.userName}, an Indian user.

## Your Role
Answer financial questions accurately using the provided tools. NEVER guess or hallucinate figures. ALWAYS use tools to get precise data before answering. Supplement tool results with the snapshot below for context.

## ${snapshot.userName}'s Financial Snapshot (FY ${snapshot.currentFY})
- Net Worth (approx): ${fmt(snapshot.netWorth)}
- Liquid Cash: ${fmt(snapshot.liquidCash)}
- Monthly Income (avg): ${fmt(snapshot.monthlyIncome)}
- Monthly Expenses (this month): ${fmt(snapshot.monthlyExpenses)}
- Total Debt Outstanding: ${fmt(snapshot.totalDebt)} across ${snapshot.activeLoanCount} loan(s)
- Total Monthly EMIs: ${fmt(snapshot.totalEMI)}
- Money owed to user: ${fmt(snapshot.totalReceivable)}${snapshot.overdueReceivables > 0 ? ` (⚠ ${fmt(snapshot.overdueReceivables)} overdue)` : ''}
- Active goals: ${snapshot.goalsCount} (${snapshot.goalsProgress}% overall progress)
- Active insurance policies (renewing in 30 days): ${snapshot.insurancePolicyCount}

## Upcoming (next 30 days)
Insurance renewals:
${renewalLines}
EMIs due:
${emiLines}

## Top expense categories (this month)
${expenseLines}

## Response Rules
- Use ₹ symbol and Indian number formatting (₹8,47,320 not ₹847320)
- Use "lakhs" for 1,00,000 and "crores" for 1,00,00,000 in spoken text
- Be concise and direct. You are a trusted financial assistant, not a chatbot.
- For net worth → call get_net_worth for precise breakdown
- For insurance → call get_insurance_coverage or get_upcoming_renewals
- For tax → call calculate_tax_estimate
- For debt/EMI → call get_debt_summary
- For money owed → call get_receivables
- For expenses → call get_expense_analysis
- For tithe → call calculate_tithe
- For investments → call get_investment_portfolio
- For corporate benefits → call get_corporate_benefits
- If a question needs multiple data sources, call multiple tools before responding.
- After tool results: give a structured, actionable answer.
`
}