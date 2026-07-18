// ============================================================================
// lib/engine/financial-engine.ts
//
// SHARED FINANCIAL ENGINE
// -------------------------
// The single place responsible for calculating net worth, cash flow,
// savings rate, financial health score, budget utilization, portfolio
// allocation, emergency fund coverage, debt ratio, and investment
// performance. Every page, API route, Server Action, and the AI Copilot
// call these functions instead of computing their own version.
//
// Design principles (see docs/architecture/02-financial-engine-design.md):
//   - Pure: takes already-fetched rows in, returns typed results out.
//     Never touches Supabase itself — callers fetch, the engine computes.
//   - Explainable: every result carries the inputs that produced it, not
//     just the number, so the AI Copilot can state *why* without
//     re-deriving anything (this is what Part 5 / the AI Context Builder
//     depends on).
//   - Delegates to lib/calculations/* where a correct implementation
//     already exists there (cashflowCalculator, networth, debtCalculator,
//     investmentCalculator) rather than re-implementing — this phase's job
//     was to make the *existing* good pattern mandatory, not replace it.
// ============================================================================

import { summarizeCashflow } from '@/lib/calculations/cashflowCalculator'
import { computeNetWorth } from '@/lib/calculations/networth'
import { simpleReturn } from '@/lib/calculations/investmentCalculator'

const LIQUID_ACCOUNT_TYPES = ['savings', 'current', 'salary', 'wallet', 'cash']

// ── Net Worth ────────────────────────────────────────────────────────────────

export interface NetWorthInput {
  accounts: { balance: number; account_type: string }[]
  investments: { current_value: number | null; invested_amount: number }[]
  receivables: { balance_due: number }[]
  debts: { outstanding: number }[]
  realEstateValue?: number
}

export interface NetWorthResult {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  breakdown: { liquidCash: number; investments: number; receivables: number; realEstate: number }
  inputsUsed: string[] // for AI explainability
}

function calculateNetWorth(input: NetWorthInput): NetWorthResult {
  const liquidCash = input.accounts
    .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.account_type))
    .reduce((s, a) => s + a.balance, 0)
  const investmentValue = input.investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const receivablesTotal = input.receivables.reduce((s, r) => s + r.balance_due, 0)
  const realEstateValue = input.realEstateValue ?? 0
  const totalLiabilities = input.debts.reduce((s, d) => s + d.outstanding, 0)

  const computed = computeNetWorth({
    bankBalances: liquidCash, walletBalances: 0, investmentValue,
    receivables: receivablesTotal, propertyValue: realEstateValue,
    vehicleValue: 0, goldValue: 0, loans: totalLiabilities, creditCardDues: 0,
  })

  return {
    netWorth: computed.netWorth,
    totalAssets: computed.totalAssets,
    totalLiabilities: computed.totalLiabilities,
    breakdown: { liquidCash, investments: investmentValue, receivables: receivablesTotal, realEstate: realEstateValue },
    inputsUsed: ['Accounts', 'Investments', 'Receivables', 'Debt'],
  }
}

// ── Cash Flow / Savings Rate ─────────────────────────────────────────────────

export interface CashFlowInput {
  transactions: { amount: number; direction: 'credit' | 'debit'; category: string }[]
}

export interface CashFlowResult {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  expenseRatio: number
  byCategory: { category: string; amount: number; pct: number }[]
  inputsUsed: string[]
}

function calculateCashFlow(input: CashFlowInput): CashFlowResult {
  const summary = summarizeCashflow(input.transactions)
  return { ...summary, inputsUsed: ['Transactions'] }
}

function calculateSavingsRate(input: CashFlowInput): number {
  return calculateCashFlow(input).savingsRate
}

// ── Debt Ratio ────────────────────────────────────────────────────────────────

export interface DebtRatioInput {
  monthlyEMI: number
  monthlyIncome: number
}

export interface DebtRatioResult {
  ratio: number // percentage
  band: 'healthy' | 'elevated' | 'high'
  inputsUsed: string[]
}

function calculateDebtRatio(input: DebtRatioInput): DebtRatioResult {
  const ratio = input.monthlyIncome > 0 ? Math.round((input.monthlyEMI / input.monthlyIncome) * 100) : 0
  const band = ratio < 30 ? 'healthy' : ratio <= 40 ? 'elevated' : 'high'
  return { ratio, band, inputsUsed: ['Debt', 'Income'] }
}

// ── Emergency Fund Coverage ──────────────────────────────────────────────────

export interface EmergencyFundInput {
  liquidCash: number
  monthlyExpenses: number
}

export interface EmergencyFundResult {
  monthsCovered: number
  band: 'critical' | 'building' | 'healthy'
  inputsUsed: string[]
}

function calculateEmergencyFundCoverage(input: EmergencyFundInput): EmergencyFundResult {
  const monthsCovered = input.monthlyExpenses > 0 ? input.liquidCash / input.monthlyExpenses : 0
  const band = monthsCovered < 1.5 ? 'critical' : monthsCovered < 3 ? 'building' : 'healthy'
  return { monthsCovered: Math.round(monthsCovered * 10) / 10, band, inputsUsed: ['Accounts', 'Expenses'] }
}

// ── Budget Utilization ───────────────────────────────────────────────────────

export interface BudgetInput {
  categoryBudgets: { category: string; budgeted: number }[]
  actualSpend: { category: string; amount: number }[]
}

export interface BudgetResult {
  overall: { budgeted: number; spent: number; utilizationPct: number }
  byCategory: { category: string; budgeted: number; spent: number; utilizationPct: number; overBudget: boolean }[]
  inputsUsed: string[]
}

function calculateBudgetUtilization(input: BudgetInput): BudgetResult {
  const spendByCategory = new Map(input.actualSpend.map(s => [s.category, s.amount]))
  const byCategory = input.categoryBudgets.map(b => {
    const spent = spendByCategory.get(b.category) ?? 0
    const utilizationPct = b.budgeted > 0 ? Math.round((spent / b.budgeted) * 100) : 0
    return { category: b.category, budgeted: b.budgeted, spent, utilizationPct, overBudget: spent > b.budgeted }
  })
  const totalBudgeted = input.categoryBudgets.reduce((s, b) => s + b.budgeted, 0)
  const totalSpent = input.actualSpend.reduce((s, a) => s + a.amount, 0)

  return {
    overall: {
      budgeted: totalBudgeted, spent: totalSpent,
      utilizationPct: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0,
    },
    byCategory,
    inputsUsed: ['Expenses', 'Budgets'],
  }
}

// ── Portfolio Allocation ─────────────────────────────────────────────────────

export interface PortfolioInput {
  investments: { name: string; investment_type: string; invested_amount: number; current_value: number | null }[]
}

export interface PortfolioResult {
  totalInvested: number
  totalCurrentValue: number
  totalGain: number
  totalGainPct: number
  allocation: { type: string; currentValue: number; sharePct: number }[]
  inputsUsed: string[]
}

function calculatePortfolioAllocation(input: PortfolioInput): PortfolioResult {
  const totalInvested = input.investments.reduce((s, i) => s + i.invested_amount, 0)
  const totalCurrentValue = input.investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalGain = totalCurrentValue - totalInvested

  const byType = new Map<string, number>()
  input.investments.forEach(i => {
    const value = i.current_value ?? i.invested_amount
    byType.set(i.investment_type, (byType.get(i.investment_type) ?? 0) + value)
  })

  return {
    totalInvested, totalCurrentValue, totalGain,
    totalGainPct: simpleReturn(totalInvested, totalCurrentValue),
    allocation: Array.from(byType.entries()).map(([type, currentValue]) => ({
      type, currentValue, sharePct: totalCurrentValue > 0 ? Math.round((currentValue / totalCurrentValue) * 100) : 0,
    })),
    inputsUsed: ['Investments'],
  }
}

// ── Investment Performance (per-holding) ─────────────────────────────────────

export interface InvestmentInput {
  investments: { name: string; invested_amount: number; current_value: number | null }[]
}

export interface InvestmentPerformanceResult {
  holdings: { name: string; invested: number; currentValue: number; gain: number; gainPct: number }[]
  inputsUsed: string[]
}

function calculateInvestmentPerformance(input: InvestmentInput): InvestmentPerformanceResult {
  return {
    holdings: input.investments.map(i => {
      const currentValue = i.current_value ?? i.invested_amount
      return {
        name: i.name, invested: i.invested_amount, currentValue,
        gain: currentValue - i.invested_amount,
        gainPct: simpleReturn(i.invested_amount, currentValue),
      }
    }),
    inputsUsed: ['Investments'],
  }
}

// ── Financial Health Score ───────────────────────────────────────────────────
// The one composite metric — deliberately built from the other engine
// outputs rather than raw data, so any future change to (say) what counts
// as a "healthy" debt ratio automatically flows into the health score too.

export interface HealthScoreInput {
  emergencyFund: EmergencyFundResult
  debtRatio: DebtRatioResult
  hasActiveGoals: boolean
  hasInvestments: boolean
  hasNoOverdueReceivables: boolean
  hasInsurance: boolean
}

export interface HealthScoreResult {
  score: number // 0-100
  band: 'needs attention' | 'stable' | 'strong'
  contributors: { label: string; points: number; met: boolean }[]
  inputsUsed: string[]
}

function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const contributors = [
    { label: 'Base', points: 40, met: true },
    { label: 'Emergency fund ≥ 3 months', points: 15, met: input.emergencyFund.band === 'healthy' },
    { label: 'Debt ratio < 30%', points: 15, met: input.debtRatio.band === 'healthy' },
    { label: 'Has an active goal', points: 10, met: input.hasActiveGoals },
    { label: 'Has investments', points: 10, met: input.hasInvestments },
    { label: 'No overdue receivables', points: 5, met: input.hasNoOverdueReceivables },
    { label: 'Has insurance', points: 5, met: input.hasInsurance },
  ]
  const score = Math.min(100, contributors.filter(c => c.met).reduce((s, c) => s + c.points, 0))
  const band = score >= 75 ? 'strong' : score >= 50 ? 'stable' : 'needs attention'

  return {
    score, band, contributors,
    inputsUsed: ['Analytics', 'Accounts', 'Debt', 'Goals', 'Investments', 'Receivables', 'Insurance'],
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const FinancialEngine = {
  calculateNetWorth,
  calculateCashFlow,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateEmergencyFundCoverage,
  calculateBudgetUtilization,
  calculatePortfolioAllocation,
  calculateInvestmentPerformance,
  calculateHealthScore,
}
