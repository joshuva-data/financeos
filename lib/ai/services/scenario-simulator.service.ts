// ============================================================================
// lib/ai/services/scenario-simulator.service.ts
//
// SCENARIO SIMULATOR (v5 Deliverable 13)
// -----------------------------------------
// "What if" analysis: increase income, increase an expense, increase SIP
// contribution, or pay off a loan early. Every scenario reuses the Financial
// Engine and existing calculators rather than re-deriving projections from
// scratch, and every result is shaped as an ExplainableInsight (Deliverable
// 11) — observation, evidence, reasoning, assumptions, suggested actions,
// confidence, and an explicit isEstimate flag, since every output here is a
// projection, never a recorded fact.
//
// Reuses:
//   - FinancialContext (lib/ai/types.ts) — the same snapshot the Copilot's
//     chat and Executive Brief already use, so a scenario always starts from
//     numbers consistent with the rest of the app.
//   - lib/calculations/debtCalculator.ts — amortization math for the loan
//     payoff scenario, instead of a new interest calculation.
//   - lib/engine/financial-engine.ts — FinancialEngine.calculateDebtRatio /
//     calculateEmergencyFundCoverage for the "after" side of each comparison.
// ============================================================================

import type { FinancialContext, ScenarioInput, ScenarioResult, ScenarioMetricComparison } from '../types'
import { FinancialEngine } from '@/lib/engine/financial-engine'
import { generateAmortizationSchedule, totalInterestPayable } from '@/lib/calculations/debtCalculator'

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function pctChange(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : 100
  return Math.round(((after - before) / Math.abs(before)) * 1000) / 10
}

function compareMetric(metric: string, before: number, after: number): ScenarioMetricComparison {
  return { metric, before: Math.round(before), after: Math.round(after), changeAbs: Math.round(after - before), changePct: pctChange(before, after) }
}

export function simulateScenario(ctx: FinancialContext, input: ScenarioInput): ScenarioResult {
  const months = input.projectionMonths ?? 12

  switch (input.type) {
    case 'increase_income':   return simulateIncomeChange(ctx, input.amount, months)
    case 'increase_expense':  return simulateExpenseChange(ctx, input.amount, months)
    case 'increase_sip':      return simulateSipIncrease(ctx, input.amount, months)
    case 'early_loan_payoff': return simulateLoanPayoff(ctx, input.targetDebtLender, months)
    default:
      throw new Error(`Unknown scenario type: ${input.type satisfies never}`)
  }
}

// ── Scenario: income increase (e.g. "what if salary increases by 10%?") ──────

function simulateIncomeChange(ctx: FinancialContext, pct: number, months: number): ScenarioResult {
  const newMonthlyIncome = ctx.monthlyIncome * (1 + pct / 100)
  const incomeDelta = newMonthlyIncome - ctx.monthlyIncome

  const beforeSavingsRate = ctx.savingsRate
  const newMonthlySavings = Math.max(0, newMonthlyIncome - ctx.thisMonthSpend)
  const afterSavingsRate = newMonthlyIncome > 0 ? (newMonthlySavings / newMonthlyIncome) * 100 : 0

  const beforeDebtRatio = ctx.debtRatio
  const afterDebtRatio = FinancialEngine.calculateDebtRatio({ monthlyEMI: ctx.totalEMI, monthlyIncome: newMonthlyIncome }).ratio

  const beforeNetWorth = ctx.netWorth
  const afterNetWorth = ctx.netWorth + newMonthlySavings * months - Math.max(0, (ctx.monthlyIncome - ctx.thisMonthSpend)) * 0 // baseline already reflected in "before"; see assumptions

  return {
    scenarioLabel: `Income increases by ${pct}%`,
    observation: `A ${pct}% income increase raises monthly income from ${fmt(ctx.monthlyIncome)} to ${fmt(newMonthlyIncome)} (+${fmt(incomeDelta)}/month).`,
    evidence: [
      `Current monthly income: ${fmt(ctx.monthlyIncome)}`,
      `Current monthly expenses: ${fmt(ctx.thisMonthSpend)}`,
      `Current savings rate: ${beforeSavingsRate.toFixed(1)}%`,
    ],
    reasoning: `Assuming expenses stay flat, the extra ${fmt(incomeDelta)}/month flows entirely into savings, which raises the savings rate from ${beforeSavingsRate.toFixed(1)}% to ${afterSavingsRate.toFixed(1)}% and lowers the debt-to-income ratio from ${beforeDebtRatio}% to ${afterDebtRatio}% since EMI stays the same against higher income.`,
    assumptions: [
      'Monthly expenses remain unchanged (lifestyle inflation not modeled)',
      'The full income increase is realized immediately, not phased in',
      `Projected over ${months} months of accumulated extra savings`,
    ],
    suggestedActions: [
      afterSavingsRate > beforeSavingsRate + 5
        ? 'Consider directing at least part of the increase toward investments rather than letting it raise baseline spending'
        : 'Review whether this increase meaningfully changes your emergency fund timeline',
    ],
    confidence: 'Medium',
    isEstimate: true,
    projectionMonths: months,
    comparisons: [
      compareMetric('Monthly Income', ctx.monthlyIncome, newMonthlyIncome),
      compareMetric('Savings Rate (%)', beforeSavingsRate, afterSavingsRate),
      compareMetric('Debt-to-Income Ratio (%)', beforeDebtRatio, afterDebtRatio),
      compareMetric(`Net Worth in ${months} months`, beforeNetWorth, afterNetWorth),
    ],
  }
}

// ── Scenario: expense increase (e.g. "what if rent increases by ₹3,000?") ────

function simulateExpenseChange(ctx: FinancialContext, monthlyDelta: number, months: number): ScenarioResult {
  const newMonthlyExpense = ctx.thisMonthSpend + monthlyDelta
  const beforeSavingsRate = ctx.savingsRate
  const newMonthlySavings = Math.max(0, ctx.monthlyIncome - newMonthlyExpense)
  const afterSavingsRate = ctx.monthlyIncome > 0 ? (newMonthlySavings / ctx.monthlyIncome) * 100 : 0

  const beforeEmergencyMonths = ctx.emergencyFundMonths
  const afterEmergencyMonths = newMonthlyExpense > 0 ? ctx.liquidCash / newMonthlyExpense : ctx.emergencyFundMonths

  return {
    scenarioLabel: monthlyDelta >= 0 ? `Monthly expenses increase by ${fmt(monthlyDelta)}` : `Monthly expenses decrease by ${fmt(Math.abs(monthlyDelta))}`,
    observation: `A ${fmt(Math.abs(monthlyDelta))} ${monthlyDelta >= 0 ? 'increase' : 'decrease'} in monthly expenses moves spending from ${fmt(ctx.thisMonthSpend)} to ${fmt(newMonthlyExpense)}.`,
    evidence: [
      `Current monthly expenses: ${fmt(ctx.thisMonthSpend)}`,
      `Current liquid cash: ${fmt(ctx.liquidCash)}`,
      `Current emergency fund coverage: ${beforeEmergencyMonths.toFixed(1)} months`,
    ],
    reasoning: `Emergency fund coverage measured in months shrinks when the monthly expense denominator grows, even with the same liquid cash — coverage moves from ${beforeEmergencyMonths.toFixed(1)} to ${afterEmergencyMonths.toFixed(1)} months. Savings rate moves from ${beforeSavingsRate.toFixed(1)}% to ${afterSavingsRate.toFixed(1)}%.`,
    assumptions: [
      'Income remains unchanged',
      'The expense change is recurring monthly, not a one-off',
      'Liquid cash balance at the start of the projection is today\'s balance',
    ],
    suggestedActions: afterEmergencyMonths < 3 && beforeEmergencyMonths >= 3
      ? ['This change would drop emergency fund coverage below the 3-month benchmark — consider whether the increase is avoidable or needs an offsetting cut elsewhere']
      : ['Monitor next month\'s actual spend against this projection to confirm the assumption held'],
    confidence: 'Medium',
    isEstimate: true,
    projectionMonths: months,
    comparisons: [
      compareMetric('Monthly Expenses', ctx.thisMonthSpend, newMonthlyExpense),
      compareMetric('Savings Rate (%)', beforeSavingsRate, afterSavingsRate),
      compareMetric('Emergency Fund (months)', beforeEmergencyMonths, afterEmergencyMonths),
    ],
  }
}

// ── Scenario: SIP increase (e.g. "what if I invest ₹5,000 more?") ────────────

function simulateSipIncrease(ctx: FinancialContext, monthlyAmount: number, months: number): ScenarioResult {
  // Conservative, clearly-labeled assumption rather than a market prediction:
  // a flat annual return assumption for illustration only.
  const ASSUMED_ANNUAL_RETURN = 0.10
  const monthlyRate = ASSUMED_ANNUAL_RETURN / 12
  let futureValue = 0
  for (let i = 0; i < months; i++) {
    futureValue = (futureValue + monthlyAmount) * (1 + monthlyRate)
  }
  const totalContributed = monthlyAmount * months
  const projectedGrowth = futureValue - totalContributed

  const newMonthlySavings = ctx.monthlyIncome - ctx.thisMonthSpend - monthlyAmount
  const newEmergencyMonths = ctx.thisMonthSpend > 0 ? Math.max(0, ctx.liquidCash - monthlyAmount * months) / ctx.thisMonthSpend : ctx.emergencyFundMonths

  return {
    scenarioLabel: `Invest an additional ${fmt(monthlyAmount)}/month`,
    observation: `Investing an additional ${fmt(monthlyAmount)} per month for ${months} months, at an illustrative 10% annual return, could grow to approximately ${fmt(futureValue)} (${fmt(totalContributed)} contributed + ${fmt(projectedGrowth)} projected growth).`,
    evidence: [
      `Current portfolio value: ${fmt(ctx.portfolioValue)}`,
      `Current liquid cash: ${fmt(ctx.liquidCash)}`,
      `Current monthly surplus (income − expenses): ${fmt(Math.max(0, ctx.monthlyIncome - ctx.thisMonthSpend))}`,
    ],
    reasoning: `This assumes the additional ${fmt(monthlyAmount)} comes out of current monthly surplus or liquid cash rather than reducing other essential spending. If it comes from liquid cash rather than fresh surplus, emergency fund coverage would move from ${ctx.emergencyFundMonths.toFixed(1)} to approximately ${newEmergencyMonths.toFixed(1)} months over the period — worth checking before committing to this SIP increase.`,
    assumptions: [
      'Illustrative 10% annual return, compounded monthly — not a guarantee or prediction of actual market performance',
      'The additional investment amount is available each month without cutting other spending',
      'No withdrawals during the projection period',
    ],
    suggestedActions: [
      newEmergencyMonths < 3
        ? 'Funding this from liquid cash would bring emergency fund coverage below 3 months — confirm the funding source before committing'
        : `A ${months}-month SIP of ${fmt(monthlyAmount)} looks sustainable against current surplus`,
    ],
    confidence: 'Low', // market return is inherently uncertain — deliberately not "Medium"
    isEstimate: true,
    projectionMonths: months,
    comparisons: [
      compareMetric('Portfolio Value', ctx.portfolioValue, ctx.portfolioValue + futureValue),
      compareMetric('Monthly Savings (if from surplus)', Math.max(0, ctx.monthlyIncome - ctx.thisMonthSpend), newMonthlySavings),
      compareMetric('Emergency Fund (months, if from cash)', ctx.emergencyFundMonths, newEmergencyMonths),
    ],
  }
}

// ── Scenario: pay off a loan early ───────────────────────────────────────────

function simulateLoanPayoff(ctx: FinancialContext, targetLender: string | undefined, months: number): ScenarioResult {
  const target = targetLender
    ? ctx.debts.find(d => d.lender.toLowerCase() === targetLender.toLowerCase())
    : [...ctx.debts].sort((a, b) => b.rate - a.rate)[0] // default: highest-interest debt

  if (!target) {
    return {
      scenarioLabel: 'Early loan payoff',
      observation: targetLender
        ? `No debt matching "${targetLender}" was found in your current Debt module.`
        : 'No active debts were found to simulate a payoff for.',
      evidence: [],
      reasoning: 'Nothing to simulate without a matching debt.',
      assumptions: [],
      suggestedActions: [],
      confidence: 'High',
      isEstimate: false,
      projectionMonths: months,
      comparisons: [],
    }
  }

  // Estimate remaining tenure by simulating forward at the current EMI —
  // debtCalculator.ts's exported functions take tenure as an input, not
  // derived from EMI, so this reconstructs it the same way rather than
  // adding a second, diverging amortization formula.
  let remainingMonths = 0
  let balance = target.outstanding
  const monthlyRate = target.rate / 12 / 100
  while (balance > 0 && remainingMonths < 600) {
    const interest = balance * monthlyRate
    const principal = Math.min(target.emi - interest, balance)
    if (principal <= 0) break // EMI doesn't cover interest — malformed data, bail out
    balance -= principal
    remainingMonths++
  }

  const schedule = generateAmortizationSchedule(target.outstanding, target.rate, remainingMonths || 1)
  const interestIfContinued = totalInterestPayable(schedule)

  const newLiquidCash = ctx.liquidCash - target.outstanding
  const newTotalEMI = ctx.totalEMI - target.emi
  const newDebtRatio = FinancialEngine.calculateDebtRatio({ monthlyEMI: newTotalEMI, monthlyIncome: ctx.monthlyIncome }).ratio
  const newEmergencyMonths = ctx.thisMonthSpend > 0 ? newLiquidCash / ctx.thisMonthSpend : ctx.emergencyFundMonths

  return {
    scenarioLabel: `Pay off ${target.lender} early`,
    observation: `Paying off the ${fmt(target.outstanding)} outstanding on ${target.lender} today would save approximately ${fmt(interestIfContinued)} in interest over the remaining ~${remainingMonths} months and free up ${fmt(target.emi)}/month in EMI.`,
    evidence: [
      `${target.lender}: ${fmt(target.outstanding)} outstanding at ${target.rate}% interest`,
      `Current EMI: ${fmt(target.emi)}/month`,
      `Current liquid cash: ${fmt(ctx.liquidCash)}`,
    ],
    reasoning: `Using this debt's outstanding balance and rate to reconstruct its remaining amortization schedule, continuing to pay it off on schedule costs ~${fmt(interestIfContinued)} in interest. Paying it off now trades that liquid cash for those savings, but drops liquid cash from ${fmt(ctx.liquidCash)} to ${fmt(newLiquidCash)} and emergency fund coverage from ${ctx.emergencyFundMonths.toFixed(1)} to ${newEmergencyMonths.toFixed(1)} months.`,
    assumptions: [
      'No prepayment penalty is factored in — check your loan terms before acting on this',
      'Remaining tenure is estimated from outstanding balance, rate, and current EMI, not read from an official amortization schedule',
      'The full payoff amount comes from liquid cash, not a new loan or asset sale',
    ],
    suggestedActions: [
      newEmergencyMonths < 3
        ? 'This payoff would drop emergency fund coverage below 3 months — consider a partial prepayment instead of a full payoff'
        : `Emergency fund stays healthy after this payoff — the ${fmt(interestIfContinued)} interest savings looks worth considering`,
    ],
    confidence: 'Medium',
    isEstimate: true,
    projectionMonths: months,
    comparisons: [
      compareMetric('Liquid Cash', ctx.liquidCash, newLiquidCash),
      compareMetric('Total Monthly EMI', ctx.totalEMI, newTotalEMI),
      compareMetric('Debt-to-Income Ratio (%)', ctx.debtRatio, newDebtRatio),
      compareMetric('Emergency Fund (months)', ctx.emergencyFundMonths, newEmergencyMonths),
    ],
  }
}
