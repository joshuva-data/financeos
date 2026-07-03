import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DashboardSummary } from '@/types/database'

type Client = SupabaseClient<Database>

export async function getDashboardSummary(
  supabase: Client,
  userId: string,
  financialYear: string
): Promise<DashboardSummary> {
  const [
    accountsRes,
    investmentsRes,
    receivablesRes,
    debtRes,
    incomeRes,
    expensesRes,
    insuranceRes,
    netWorthHistoryRes,
    aiInsightsRes,
  ] = await Promise.all([
    supabase.from('accounts').select('balance, account_type').eq('user_id', userId).eq('status', 'active'),
    supabase.from('investments').select('current_value, invested_amount').eq('user_id', userId),
    supabase.from('receivables').select('balance_due, status').eq('user_id', userId).not('status', 'in', '("received","written_off")'),
    supabase.from('debt_accounts').select('outstanding, emi_amount, next_emi_date, lender_name, debt_type').eq('user_id', userId).eq('is_active', true),
    supabase.from('income_entries').select('net_amount').eq('user_id', userId).eq('financial_year', financialYear),
    supabase.from('transactions').select('amount, category').eq('user_id', userId).eq('txn_type', 'expense').gte('txn_date', `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`),
    supabase.from('insurance_policies').select('*').eq('user_id', userId).eq('status', 'active').lte('renewal_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(12),
    supabase.from('ai_insights').select('*').eq('user_id', userId).eq('is_dismissed', false).order('created_at', { ascending: false }).limit(5),
  ])

  const accounts = accountsRes.data ?? []
  const investments = investmentsRes.data ?? []
  const receivables = receivablesRes.data ?? []
  const debts = debtRes.data ?? []
  const income = incomeRes.data ?? []
  const expenses = expensesRes.data ?? []

  const LIQUID_TYPES = ['savings', 'current', 'salary', 'wallet', 'cash']
  const liquidCash = accounts.filter(a => LIQUID_TYPES.includes(a.account_type)).reduce((s, a) => s + (a.balance ?? 0), 0)
  const investedValue = investments.reduce((s, i) => s + (i.current_value ?? 0), 0)
  const receivablesTotal = receivables.reduce((s, r) => s + (r.balance_due ?? 0), 0)
  const debtTotal = debts.reduce((s, d) => s + (d.outstanding ?? 0), 0)
  const monthlyIncome = income.reduce((s, i) => s + (i.net_amount ?? 0), 0)
  const monthlyExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  const totalAssets = liquidCash + investedValue + receivablesTotal
  const netWorth = totalAssets - debtTotal
  const prevSnapshot = (netWorthHistoryRes.data ?? [])[1]
  const netWorthChange = prevSnapshot ? netWorth - prevSnapshot.net_worth : 0
  const netWorthChangePct = prevSnapshot && prevSnapshot.net_worth > 0
    ? ((netWorthChange / prevSnapshot.net_worth) * 100)
    : 0

  // Expense category breakdown
  const catMap: Record<string, number> = {}
  expenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] ?? 0) + e.amount
  })
  const topExpenseCategories = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
    }))

  return {
    netWorth,
    netWorthChange,
    netWorthChangePct,
    liquidCash,
    investedValue,
    receivablesTotal,
    debtTotal,
    monthlyIncome,
    monthlyExpenses,
    savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0,
    insuranceRenewalsNext30Days: (insuranceRes.data ?? []) as any,
    emisDueThisMonth: debts as any,
    overdueReceivables: receivables.filter(r => r.status === 'overdue') as any,
    overdueRentals: [],
    topExpenseCategories,
    netWorthHistory: (netWorthHistoryRes.data ?? []).reverse() as any,
    aiInsights: (aiInsightsRes.data ?? []) as any,
  }
}