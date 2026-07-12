// ============================================================================
// lib/ai/services/recommendation-engine.service.ts
//
// RECOMMENDATION ENGINE
// ----------------------
// Turns a FinancialContext (built by the Context Builder) into proactive,
// ranked recommendations, and rolls those up into the Executive Financial
// Brief shown on the Copilot's landing view.
//
// Every recommendation satisfies Requirement 7: it states WHY (the specific
// numbers behind it), which SOURCES (modules) were used, a CONFIDENCE level,
// and a concrete NEXT ACTION.
// ============================================================================

import type { FinancialContext, Recommendation, ExecutiveBrief } from '../types'

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export function generateRecommendations(ctx: FinancialContext): Recommendation[] {
  const recs: Recommendation[] = []
  const expenseChange = ctx.lastMonthSpend > 0
    ? ((ctx.thisMonthSpend - ctx.lastMonthSpend) / ctx.lastMonthSpend) * 100 : 0

  // 1. Emergency fund
  if (ctx.emergencyFundMonths < 3) recs.push({
    id: 'emg', category: 'Security', color: '#f59e0b',
    title: `Emergency fund covers only ${ctx.emergencyFundMonths.toFixed(1)} months`,
    why: `Liquid cash (${fmt(ctx.liquidCash)}) ÷ monthly income (${fmt(ctx.monthlyIncome)}) = ${ctx.emergencyFundMonths.toFixed(1)} months. Safe minimum is 3–6 months.`,
    sources: ['Accounts', 'Income'],
    confidence: 'High', impact: 'High',
    nextAction: `Move ${fmt(Math.max(0, ctx.monthlyIncome * 3 - ctx.liquidCash))} into a high-yield savings account to reach a 3-month buffer.`,
    href: '/accounts',
  })

  // 2. High debt ratio
  if (ctx.debtRatio > 40) recs.push({
    id: 'debt', category: 'Debt', color: '#ff5a5f',
    title: `EMIs consume ${ctx.debtRatio}% of income — above the safe limit`,
    why: `Monthly EMI (${fmt(ctx.totalEMI)}) ÷ monthly income (${fmt(ctx.monthlyIncome)}) = ${ctx.debtRatio}%. Above 40% stresses cash flow.`,
    sources: ['Debt', 'Income'],
    confidence: 'High', impact: 'High',
    nextAction: 'Prepay the highest-interest loan first; check for part-prepayment without penalty.',
    href: '/debt',
  })

  // 3. 80C optimisation
  const remaining80C = Math.max(0, 150000 - ctx.sec80C)
  if (remaining80C > 0 && ctx.annualIncome > 300000) recs.push({
    id: '80c', category: 'Tax', color: '#c9a227',
    title: `Save ~${fmt(Math.round(remaining80C * 0.2))} in tax via 80C`,
    why: `${fmt(ctx.sec80C)} of the ₹1.5L 80C limit is used. Investing ${fmt(remaining80C)} more in ELSS/PPF/NPS reduces taxable income by that amount.`,
    sources: ['Investments', 'Taxes', 'Income'],
    confidence: 'High', impact: 'Medium',
    nextAction: `Invest ${fmt(remaining80C)} in ELSS before 31 March to claim the 80C deduction.`,
    href: '/investments',
  })

  // 4. Spending spike
  if (expenseChange > 20) recs.push({
    id: 'spend', category: 'Expenses', color: '#f97316',
    title: `Spending up ${expenseChange.toFixed(0)}% vs last month`,
    why: `This month: ${fmt(ctx.thisMonthSpend)} vs last month: ${fmt(ctx.lastMonthSpend)}. Top category: ${ctx.topCategories[0]?.category ?? 'unknown'} at ${fmt(ctx.topCategories[0]?.amount ?? 0)}.`,
    sources: ['Expenses'],
    confidence: 'High', impact: 'Medium',
    nextAction: `Review ${ctx.topCategories[0]?.category ?? 'top spending'} transactions and identify what changed.`,
    href: '/expenses',
  })

  // 5. Insurance gap
  if (ctx.insurance.length === 0) recs.push({
    id: 'ins', category: 'Insurance', color: '#8b5cf6',
    title: 'No insurance policies tracked',
    why: `With net worth of ${fmt(ctx.netWorth)} and income of ${fmt(ctx.annualIncome)}, an uninsured event could wipe out years of savings.`,
    sources: ['Insurance', 'Analytics'],
    confidence: 'High', impact: 'High',
    nextAction: `Add at minimum: term life (10× annual income ≈ ${fmt(ctx.annualIncome * 10)}) and ₹5L+ health cover.`,
    href: '/insurance',
  })

  // 6. Portfolio under-invested
  const invPct = ctx.totalAssets > 0 ? (ctx.portfolioValue / ctx.totalAssets) * 100 : 0
  if (invPct < 20 && ctx.monthlyIncome > 0) recs.push({
    id: 'inv', category: 'Investments', color: '#00C896',
    title: `Only ${invPct.toFixed(0)}% of assets are invested`,
    why: `Investments (${fmt(ctx.portfolioValue)}) are ${invPct.toFixed(0)}% of total assets (${fmt(ctx.totalAssets)}). 30–70% in growth assets is typical depending on age.`,
    sources: ['Investments', 'Accounts'],
    confidence: 'Medium', impact: 'High',
    nextAction: `Start a monthly SIP of ${fmt(Math.round(ctx.monthlyIncome * 0.15))} (15% of income) in diversified equity funds.`,
    href: '/investments',
  })

  // 7. Upcoming EMI/renewal within 5 days
  const urgent = ctx.upcomingEvents.find(e => e.daysLeft <= 5)
  if (urgent) recs.push({
    id: 'urgent-event', category: urgent.type === 'emi' ? 'Debt' : 'Calendar', color: '#ff5a5f',
    title: `${urgent.label} due in ${urgent.daysLeft} day${urgent.daysLeft !== 1 ? 's' : ''}`,
    why: `${urgent.label} of ${urgent.amount ? fmt(urgent.amount) : 'an amount'} is due on ${new Date(urgent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
    sources: ['Calendar', urgent.type === 'emi' ? 'Debt' : 'Insurance'],
    confidence: 'High', impact: 'High',
    nextAction: `Ensure ${urgent.amount ? fmt(urgent.amount) : 'sufficient funds'} are available before the due date.`,
    href: urgent.type === 'emi' ? '/debt' : '/calendar',
  })

  // 8. Tax due warning
  if (ctx.taxDue > 0) recs.push({
    id: 'tax', category: 'Taxes', color: '#c9a227',
    title: `Estimated tax due: ${fmt(ctx.taxDue)}`,
    why: `Estimated tax (${fmt(ctx.estimatedTax)}) minus TDS paid (${fmt(ctx.taxPaid)}) leaves ${fmt(ctx.taxDue)} to pay before July 31.`,
    sources: ['Taxes', 'Income'],
    confidence: 'Medium', impact: 'Medium',
    nextAction: 'Pay advance tax or file ITR early to avoid interest under Section 234B/234C.',
    href: '/taxes',
  })

  // 9. Expiring documents
  if (ctx.expiringDocuments.length > 0) recs.push({
    id: 'docs', category: 'Documents', color: '#0ea5e9',
    title: `${ctx.expiringDocuments.length} document${ctx.expiringDocuments.length > 1 ? 's' : ''} expiring within 30 days`,
    why: `${ctx.expiringDocuments.map(d => d.title).slice(0, 3).join(', ')} ${ctx.expiringDocuments.length > 3 ? 'and others ' : ''}expire soon.`,
    sources: ['Documents'],
    confidence: 'High', impact: 'Medium',
    nextAction: 'Renew or replace expiring documents before their expiry date.',
    href: '/documents',
  })

  // 10. Unused automation opportunity
  if (ctx.activeAutomationCount === 0 && (ctx.debts.length > 0 || ctx.insurance.length > 0)) recs.push({
    id: 'automation', category: 'Automation', color: '#a855f7',
    title: 'No automations active yet',
    why: `You have ${ctx.debts.length} loan(s) and ${ctx.insurance.length} polic${ctx.insurance.length === 1 ? 'y' : 'ies'} with recurring due dates but no reminders automated.`,
    sources: ['Automation', 'Debt', 'Insurance'],
    confidence: 'Medium', impact: 'Low',
    nextAction: 'Ask the Copilot to set up a reminder automation for upcoming EMIs and renewals.',
    href: '/automation',
  })

  return recs.sort((a, b) => {
    const priority = { High: 0, Medium: 1, Low: 2 }
    return priority[a.impact] - priority[b.impact]
  }).slice(0, 8)
}

export function generateExecutiveBrief(ctx: FinancialContext): ExecutiveBrief {
  const headline = ctx.healthScore >= 75
    ? `Strong financial position — Net Worth ${fmt(ctx.netWorth)}`
    : ctx.healthScore >= 50
    ? `Stable finances with room to improve — ${ctx.debtRatio > 40 ? 'high debt ratio needs attention' : 'focus on building emergency fund'}`
    : `Financial health needs attention — action required on ${ctx.debtRatio > 40 ? 'debt' : 'savings'}`

  const strengths: string[] = []
  if (ctx.emergencyFundMonths >= 3) strengths.push(`Emergency fund covers ${ctx.emergencyFundMonths.toFixed(1)} months`)
  if (ctx.debtRatio < 30)            strengths.push(`Healthy debt ratio at ${ctx.debtRatio}%`)
  if (ctx.portfolioGainPct > 0)      strengths.push(`Investment portfolio up ${ctx.portfolioGainPct.toFixed(1)}%`)
  if (ctx.activeGoals > 0)           strengths.push(`${ctx.activeGoals} active financial goal${ctx.activeGoals > 1 ? 's' : ''} on track`)
  if (ctx.savingsRate > 20)          strengths.push(`Savings rate of ${ctx.savingsRate.toFixed(0)}% — above the 20% benchmark`)
  if (ctx.insurance.length > 0)      strengths.push(`${ctx.insurance.length} insurance polic${ctx.insurance.length > 1 ? 'ies' : 'y'} in place`)
  if (ctx.activeAutomationCount > 0) strengths.push(`${ctx.activeAutomationCount} automation${ctx.activeAutomationCount > 1 ? 's' : ''} actively saving you manual work`)

  const risks: string[] = []
  if (ctx.emergencyFundMonths < 3) risks.push(`Emergency fund only ${ctx.emergencyFundMonths.toFixed(1)} months (need 3–6)`)
  if (ctx.debtRatio > 40)          risks.push(`EMIs at ${ctx.debtRatio}% of income — above the 40% danger zone`)
  if (ctx.insurance.length === 0)  risks.push('No insurance — one event could wipe out savings')
  if (ctx.taxDue > 5000)           risks.push(`Tax due of ${fmt(ctx.taxDue)} — file/pay before July 31`)
  const overdue = ctx.pendingReceivables.filter(r => r.status === 'overdue')
  if (overdue.length > 0)          risks.push(`${overdue.length} overdue receivable${overdue.length > 1 ? 's' : ''}`)
  if (ctx.expiringDocuments.length > 0) risks.push(`${ctx.expiringDocuments.length} document(s) expiring within 30 days`)

  const opportunities: string[] = []
  const rem80C = Math.max(0, 150000 - ctx.sec80C)
  if (rem80C > 0) opportunities.push(`Save ~${fmt(Math.round(rem80C * 0.2))} in tax by maximising 80C (${fmt(rem80C)} remaining)`)
  const invPct = ctx.totalAssets > 0 ? (ctx.portfolioValue / ctx.totalAssets) * 100 : 0
  if (invPct < 30) opportunities.push(`Increase investments — only ${invPct.toFixed(0)}% of assets are in growth instruments`)
  if (ctx.monthlyIncome > 0 && ctx.totalEMI === 0) opportunities.push('Zero debt — ideal time to invest aggressively and build wealth')
  if (ctx.goals.length === 0) opportunities.push('Set a financial goal to direct your savings purposefully')
  if (ctx.activeAutomationCount === 0) opportunities.push('Automate recurring reminders (EMIs, renewals) to reduce manual tracking')

  return {
    headline, strengths, risks, opportunities,
    upcomingEvents: ctx.upcomingEvents.slice(0, 5),
    healthScore: ctx.healthScore,
    netWorth: ctx.netWorth,
    generatedAt: ctx.builtAt,
    summary: `Net worth is ${fmt(ctx.netWorth)} with a health score of ${ctx.healthScore}/100. ${
      strengths.length > 0 ? `Strength: ${strengths[0]}. ` : ''
    }${risks.length > 0 ? `Key risk: ${risks[0]}.` : 'No major risks detected.'}`,
  }
}
