// ============================================================================
// lib/engine/health-score-engine.ts
//
// FINANCIAL HEALTH ENGINE (Feature 1 of the v2 Intelligent Finance layer)
// --------------------------------------------------------------------------
// A weighted, multi-category health score — deliberately a *second* file
// from lib/engine/financial-engine.ts rather than folded into it, because
// this one has an opinion (what "healthy" means, how categories are
// weighted) where financial-engine.ts stays purely arithmetic. Keeping the
// opinionated layer separate means the weights/benchmarks below can evolve
// without touching the underlying math everything else depends on.
//
// IMPORTANT — backward compatibility:
// FinancialEngine.calculateHealthScore() (in financial-engine.ts) already
// exists and is used by the AI Copilot's Context Builder and Recommendation
// Engine. That function's signature is UNCHANGED by this file — this is a
// new, richer function for the new Financial Health Score feature, not a
// replacement. Migrating the AI layer onto this richer version is a
// reasonable follow-up, not done here, to avoid an unnecessary breaking
// change to code that already works.
//
// Graceful degradation: "Budget Adherence" has no underlying data yet (no
// budgets table exists in the schema — confirmed during the Phase 2 audit).
// Rather than fabricate a number, that category is marked unavailable and
// excluded from the weighted score, with its weight redistributed
// proportionally across the categories that do have data. This is the
// honest choice over a fake score.
// ============================================================================

import { FinancialEngine } from './financial-engine'

export type HealthCategoryKey =
  | 'savingsRate' | 'emergencyFund' | 'debtToIncome' | 'investmentAllocation'
  | 'cashFlowStability' | 'budgetAdherence' | 'insuranceCoverage' | 'goalProgress'

export interface HealthCategoryInput {
  savingsRatePct: number | null              // (income - expenses) / income * 100
  emergencyFundMonths: number | null         // liquid cash / monthly expenses
  debtToIncomePct: number | null             // monthly EMI / monthly income * 100
  investmentAllocationPct: number | null     // investments / total assets * 100
  cashFlowVolatilityPct: number | null       // |this month spend - last month spend| / last month spend * 100 (lower is better)
  budgetAdherencePct: number | null          // % of budgeted categories within budget (null = no budgets configured yet)
  insuranceCoverageRatio: number | null      // total sum assured / (annual income * 10) — capped at 1
  goalProgressPct: number | null             // average % progress across active goals (null = no active goals)
}

export interface HealthCategoryResult {
  key: HealthCategoryKey
  label: string
  score: number | null        // 0-100, null if no data
  weight: number               // the weight actually applied (redistributed if some categories are unavailable)
  baseWeight: number           // the category's nominal weight out of 100
  dataAvailable: boolean
  rawValue: number | null
  benchmark: string            // human-readable description of what "good" looks like
}

export interface FinancialHealthScoreResult {
  score: number                 // 0-100, weighted across available categories
  band: 'needs attention' | 'stable' | 'strong'
  categories: HealthCategoryResult[]
  strengths: string[]           // categories scoring >= 75
  weaknesses: string[]          // categories scoring < 50
  recommendations: { category: HealthCategoryKey; text: string }[]
  computedAt: string
}

// Nominal weights, sum to 100. Redistributed proportionally over whatever
// categories actually have data for a given user.
const BASE_WEIGHTS: Record<HealthCategoryKey, number> = {
  savingsRate:           15,
  emergencyFund:          15,
  debtToIncome:            15,
  investmentAllocation:     10,
  cashFlowStability:         10,
  budgetAdherence:            10,
  insuranceCoverage:            15,
  goalProgress:                  10,
}

const LABELS: Record<HealthCategoryKey, string> = {
  savingsRate: 'Savings Rate',
  emergencyFund: 'Emergency Fund Coverage',
  debtToIncome: 'Debt-to-Income Ratio',
  investmentAllocation: 'Investment Allocation',
  cashFlowStability: 'Cash Flow Stability',
  budgetAdherence: 'Budget Adherence',
  insuranceCoverage: 'Insurance Coverage',
  goalProgress: 'Goal Progress',
}

// Each scorer maps a raw metric to a 0-100 sub-score against a benchmark.
// Kept as small, individually-testable pure functions.
function scoreSavingsRate(pct: number): number { return clamp((pct / 20) * 100) }                     // 20%+ = full marks
function scoreEmergencyFund(months: number): number { return clamp((months / 6) * 100) }               // 6 months = full marks
function scoreDebtToIncome(pct: number): number { return clamp(100 - (pct / 40) * 100) }                // 0% = 100, 40%+ = 0
function scoreInvestmentAllocation(pct: number): number { return clamp((pct / 40) * 100) }              // 40%+ of assets invested = full marks
function scoreCashFlowVolatility(pct: number): number { return clamp(100 - (pct / 50) * 100) }          // 0% swing = 100, 50%+ swing = 0
function scoreBudgetAdherence(pct: number): number { return clamp(pct) }                                 // directly the % within budget
function scoreInsuranceCoverage(ratio: number): number { return clamp(ratio * 100) }                      // ratio already 0-1
function scoreGoalProgress(pct: number): number { return clamp(pct) }                                       // directly the average % progress

function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))) }

const RECOMMENDATIONS: Record<HealthCategoryKey, string> = {
  savingsRate: 'Aim to save at least 20% of income — review recurring expenses for cuts.',
  emergencyFund: 'Build liquid savings toward 6 months of expenses before increasing investment contributions.',
  debtToIncome: 'Prioritize paying down the highest-interest debt to bring EMIs under 30% of income.',
  investmentAllocation: 'A larger share of assets in growth investments compounds faster than idle cash — consider a SIP increase.',
  cashFlowStability: 'Recent spending has swung significantly month to month — track large one-off expenses separately from recurring ones.',
  budgetAdherence: 'Set up category budgets to get a clear read on where spending drifts from plan.',
  insuranceCoverage: 'Coverage looks light relative to income — review term life and health insurance limits.',
  goalProgress: 'Active goals are behind pace — consider increasing monthly contributions or extending the target date.',
}

export function calculateFinancialHealthScore(input: HealthCategoryInput): FinancialHealthScoreResult {
  const raw: Record<HealthCategoryKey, { value: number | null; score: number | null; benchmark: string }> = {
    savingsRate: {
      value: input.savingsRatePct,
      score: input.savingsRatePct !== null ? scoreSavingsRate(input.savingsRatePct) : null,
      benchmark: '20%+ of income saved',
    },
    emergencyFund: {
      value: input.emergencyFundMonths,
      score: input.emergencyFundMonths !== null ? scoreEmergencyFund(input.emergencyFundMonths) : null,
      benchmark: '6 months of expenses in liquid cash',
    },
    debtToIncome: {
      value: input.debtToIncomePct,
      score: input.debtToIncomePct !== null ? scoreDebtToIncome(input.debtToIncomePct) : null,
      benchmark: 'EMIs under 30% of income',
    },
    investmentAllocation: {
      value: input.investmentAllocationPct,
      score: input.investmentAllocationPct !== null ? scoreInvestmentAllocation(input.investmentAllocationPct) : null,
      benchmark: '40%+ of assets in growth investments',
    },
    cashFlowStability: {
      value: input.cashFlowVolatilityPct,
      score: input.cashFlowVolatilityPct !== null ? scoreCashFlowVolatility(input.cashFlowVolatilityPct) : null,
      benchmark: 'Month-to-month spend swings under 15%',
    },
    budgetAdherence: {
      value: input.budgetAdherencePct,
      score: input.budgetAdherencePct !== null ? scoreBudgetAdherence(input.budgetAdherencePct) : null,
      benchmark: 'Spending stays within budgeted categories',
    },
    insuranceCoverage: {
      value: input.insuranceCoverageRatio,
      score: input.insuranceCoverageRatio !== null ? scoreInsuranceCoverage(input.insuranceCoverageRatio) : null,
      benchmark: 'Life cover ≥ 10× annual income',
    },
    goalProgress: {
      value: input.goalProgressPct,
      score: input.goalProgressPct !== null ? scoreGoalProgress(input.goalProgressPct) : null,
      benchmark: 'Active goals on pace for their target date',
    },
  }

  const availableKeys = (Object.keys(raw) as HealthCategoryKey[]).filter(k => raw[k].score !== null)
  const totalAvailableBaseWeight = availableKeys.reduce((s, k) => s + BASE_WEIGHTS[k], 0)

  const categories: HealthCategoryResult[] = (Object.keys(raw) as HealthCategoryKey[]).map(key => {
    const dataAvailable = raw[key].score !== null
    const weight = dataAvailable && totalAvailableBaseWeight > 0
      ? Math.round((BASE_WEIGHTS[key] / totalAvailableBaseWeight) * 100)
      : 0
    return {
      key, label: LABELS[key], score: raw[key].score, weight, baseWeight: BASE_WEIGHTS[key],
      dataAvailable, rawValue: raw[key].value, benchmark: raw[key].benchmark,
    }
  })

  const score = clamp(
    categories.reduce((s, c) => s + (c.dataAvailable ? (c.score! * c.weight) / 100 : 0), 0)
  )
  const band = score >= 75 ? 'strong' : score >= 50 ? 'stable' : 'needs attention'

  const strengths = categories.filter(c => c.dataAvailable && c.score! >= 75).map(c => c.label)
  const weaknesses = categories.filter(c => c.dataAvailable && c.score! < 50).map(c => c.label)
  const recommendations = categories
    .filter(c => c.dataAvailable && c.score! < 50)
    .sort((a, b) => b.weight - a.weight) // surface the highest-weighted weaknesses first
    .map(c => ({ category: c.key, text: RECOMMENDATIONS[c.key] }))

  return { score, band, categories, strengths, weaknesses, recommendations, computedAt: new Date().toISOString() }
}

// ── Input builder ─────────────────────────────────────────────────────────────
// Assembles HealthCategoryInput from the same raw row shapes the Financial
// Engine already uses (NetWorthInput's accounts/investments/debts, plus a
// bit more). Pure and framework-agnostic, so both a Server Component
// (dashboard page) and a background job (daily snapshot) can call it with
// whatever they've already fetched, without a third implementation
// appearing somewhere else.

export interface HealthScoreRawInputs {
  accounts: { balance: number; account_type: string }[]
  investments: { current_value: number | null; invested_amount: number }[]
  debts: { outstanding: number; emi_amount: number | null }[]
  receivables: { balance_due: number }[]
  insurance: { sum_assured: number | null }[]
  goals: { status: string; target_amount: number; current_amount: number }[]
  monthlyIncome: number
  thisMonthExpenses: number
  lastMonthExpenses: number
  annualIncome: number
  budgetAdherencePct?: number | null // omit entirely until a budgets feature exists
}

export function buildHealthCategoryInput(raw: HealthScoreRawInputs): HealthCategoryInput {
  const netWorth = FinancialEngine.calculateNetWorth({
    accounts: raw.accounts, investments: raw.investments,
    receivables: raw.receivables, debts: raw.debts,
  })
  const debtRatio = FinancialEngine.calculateDebtRatio({
    monthlyEMI: raw.debts.reduce((s, d) => s + (d.emi_amount ?? 0), 0),
    monthlyIncome: raw.monthlyIncome,
  })
  const emergencyFund = FinancialEngine.calculateEmergencyFundCoverage({
    liquidCash: netWorth.breakdown.liquidCash,
    monthlyExpenses: raw.thisMonthExpenses > 0 ? raw.thisMonthExpenses : raw.monthlyIncome,
  })

  const savingsRatePct = raw.monthlyIncome > 0
    ? Math.max(0, ((raw.monthlyIncome - raw.thisMonthExpenses) / raw.monthlyIncome) * 100)
    : null

  const investmentAllocationPct = netWorth.totalAssets > 0
    ? (netWorth.breakdown.investments / netWorth.totalAssets) * 100
    : null

  const cashFlowVolatilityPct = raw.lastMonthExpenses > 0
    ? (Math.abs(raw.thisMonthExpenses - raw.lastMonthExpenses) / raw.lastMonthExpenses) * 100
    : null

  const totalSumAssured = raw.insurance.reduce((s, p) => s + (p.sum_assured ?? 0), 0)
  const insuranceCoverageRatio = raw.annualIncome > 0
    ? Math.min(1, totalSumAssured / (raw.annualIncome * 10))
    : (raw.insurance.length > 0 ? 1 : null)

  const activeGoals = raw.goals.filter(g => g.status === 'active')
  const goalProgressPct = activeGoals.length > 0
    ? activeGoals.reduce((s, g) => s + (g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0), 0) / activeGoals.length
    : null

  return {
    savingsRatePct,
    emergencyFundMonths: emergencyFund.monthsCovered,
    debtToIncomePct: raw.monthlyIncome > 0 ? debtRatio.ratio : null,
    investmentAllocationPct,
    cashFlowVolatilityPct,
    budgetAdherencePct: raw.budgetAdherencePct ?? null,
    insuranceCoverageRatio,
    goalProgressPct,
  }
}
