import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccountSummary {
  id: string; name: string; type: string; bank?: string; balance: number
}

export interface IncomeSummary {
  source: string; type: string; gross: number; net: number; tds: number; month: number; fy: string
}

export interface ExpenseSummary {
  category: string; amount: number; month: number; direction: string
}

export interface DebtSummary {
  lender: string; type: string; outstanding: number; emi: number; rate: number; nextEmiDate?: string
}

export interface GoalSummary {
  name: string; target: number; current: number; pct: number; targetDate?: string; status: string
}

export interface InsuranceSummary {
  name: string; type: string; premium: number; coverage: number; renewalDate?: string
}

export interface InvestmentSummary {
  name: string; type: string; invested: number; currentValue: number; gain: number; gainPct: number
}

export interface UpcomingEvent {
  label: string; date: string; amount?: number; type: string; daysLeft: number
}

export interface FinancialContext {
  // Snapshot metadata
  builtAt:   string
  userId:    string
  currentFY: string

  // Accounts
  accounts:        AccountSummary[]
  liquidCash:      number
  totalAssets:     number

  // Income
  income:          IncomeSummary[]
  annualIncome:    number
  monthlyIncome:   number
  annualTDS:       number

  // Expenses
  expenses:        ExpenseSummary[]
  thisMonthSpend:  number
  lastMonthSpend:  number
  topCategories:   { category: string; amount: number; pct: number }[]

  // Debt
  debts:           DebtSummary[]
  totalDebt:       number
  totalEMI:        number
  debtRatio:       number   // EMI / monthly income %

  // Investments
  investments:     InvestmentSummary[]
  totalInvested:   number
  portfolioValue:  number
  portfolioGain:   number
  portfolioGainPct:number

  // Goals
  goals:           GoalSummary[]
  activeGoals:     number
  completedGoals:  number

  // Insurance
  insurance:       InsuranceSummary[]
  totalCoverage:   number
  totalPremium:    number

  // Taxes (computed)
  grossIncome:     number
  taxableIncome:   number
  estimatedTax:    number
  taxPaid:         number
  taxDue:          number
  sec80C:          number
  sec80G:          number

  // Net worth
  netWorth:        number
  healthScore:     number

  // Upcoming events (next 45 days)
  upcomingEvents:  UpcomingEvent[]

  // Tithe
  titheThisMonth:  number
  titheTarget:     number

  // Receivables
  pendingReceivables: { from: string; amount: number; status: string }[]
}

// ── Context Builder ─────────────────────────────────────────────────────────────

export async function buildFinancialContext(
  supabase: SupabaseClient,
  userId:   string
): Promise<FinancialContext> {
  const now      = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const in45Days     = new Date(now.getTime() + 45 * 86400000).toISOString().split('T')[0]
  const currentFY    = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  // Fetch all data in parallel
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
    supabase.from('tithe_entries').select('amount').eq('user_id', userId)
      .gte('giving_date', startOfMonth),
    supabase.from('receivables').select('*').eq('user_id', userId).neq('status', 'received'),
  ])

  const acc  = accounts     ?? []
  const inc  = income       ?? []
  const txns = thisMonthTxns ?? []
  const last = lastMonthTxns ?? []
  const dbt  = debts        ?? []
  const inv  = investments  ?? []
  const gls  = goals        ?? []
  const ins  = insurance    ?? []
  const tth  = tithe        ?? []
  const rcv  = receivables  ?? []

  // ── Accounts ────────────────────────────────────────────────────────────────
  const LIQUID = ['savings','current','salary','wallet','cash']
  const accountSummaries: AccountSummary[] = acc.map(a => ({
    id: a.id, name: a.name, type: a.account_type, bank: a.bank_name, balance: a.balance,
  }))
  const liquidCash  = acc.filter(a => LIQUID.includes(a.account_type)).reduce((s,a) => s+a.balance, 0)
  const totalInvAmt = inv.reduce((s,i) => s+(i.current_value??i.invested_amount), 0)
  const totalAssets = liquidCash + totalInvAmt

  // ── Income ──────────────────────────────────────────────────────────────────
  const incomeSummaries: IncomeSummary[] = inc.map(i => ({
    source: i.source_name, type: i.income_type, gross: i.gross_amount,
    net: i.net_amount, tds: i.tds_deducted, month: i.month, fy: i.financial_year,
  }))
  const annualIncome  = inc.reduce((s,i) => s+i.net_amount, 0)
  const annualGross   = inc.reduce((s,i) => s+i.gross_amount, 0)
  const annualTDS     = inc.reduce((s,i) => s+i.tds_deducted, 0)
  const monthlyIncome = annualIncome / 12

  // ── Expenses ────────────────────────────────────────────────────────────────
  const expenseSummaries: ExpenseSummary[] = txns.map(t => ({
    category: t.category, amount: t.amount, month: now.getMonth()+1, direction: t.direction,
  }))
  const thisMonthSpend = txns.filter(t=>t.direction==='debit').reduce((s,t)=>s+t.amount,0)
  const lastMonthSpend = last.filter(t=>t.direction==='debit').reduce((s,t)=>s+t.amount,0)
  const byCat: Record<string,number> = {}
  txns.filter(t=>t.direction==='debit').forEach(t => { byCat[t.category]=(byCat[t.category]??0)+t.amount })
  const topCategories = Object.entries(byCat)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([category, amount]) => ({
      category, amount,
      pct: thisMonthSpend > 0 ? Math.round((amount/thisMonthSpend)*100) : 0,
    }))

  // ── Debt ────────────────────────────────────────────────────────────────────
  const debtSummaries: DebtSummary[] = dbt.map(d => ({
    lender: d.lender_name, type: d.debt_type, outstanding: d.outstanding,
    emi: d.emi_amount??0, rate: d.interest_rate, nextEmiDate: d.next_emi_date,
  }))
  const totalDebt = dbt.reduce((s,d)=>s+d.outstanding, 0)
  const totalEMI  = dbt.reduce((s,d)=>s+(d.emi_amount??0), 0)
  const debtRatio = monthlyIncome > 0 ? Math.round((totalEMI/monthlyIncome)*100) : 0

  // ── Investments ─────────────────────────────────────────────────────────────
  const investmentSummaries: InvestmentSummary[] = inv.map(i => {
    const cur  = i.current_value ?? i.invested_amount
    const gain = cur - i.invested_amount
    return {
      name: i.name, type: i.investment_type, invested: i.invested_amount,
      currentValue: cur, gain, gainPct: i.invested_amount>0 ? (gain/i.invested_amount)*100 : 0,
    }
  })
  const totalInvested     = inv.reduce((s,i)=>s+i.invested_amount, 0)
  const portfolioValue    = inv.reduce((s,i)=>s+(i.current_value??i.invested_amount), 0)
  const portfolioGain     = portfolioValue - totalInvested
  const portfolioGainPct  = totalInvested > 0 ? (portfolioGain/totalInvested)*100 : 0

  // ── Goals ───────────────────────────────────────────────────────────────────
  const goalSummaries: GoalSummary[] = gls.map(g => ({
    name: g.name, target: g.target_amount, current: g.current_amount,
    pct: g.target_amount>0 ? Math.round((g.current_amount/g.target_amount)*100) : 0,
    targetDate: g.target_date, status: g.status,
  }))
  const activeGoals    = gls.filter(g=>g.status==='active').length
  const completedGoals = gls.filter(g=>g.status==='completed').length

  // ── Insurance ───────────────────────────────────────────────────────────────
  const insuranceSummaries: InsuranceSummary[] = ins.map(p => ({
    name: p.policy_name, type: p.insurance_type, premium: p.annual_premium??0,
    coverage: p.sum_assured??0, renewalDate: p.renewal_date,
  }))
  const totalCoverage = ins.reduce((s,p)=>s+(p.sum_assured??0),0)
  const totalPremium  = ins.reduce((s,p)=>s+(p.annual_premium??0),0)

  // ── Taxes ───────────────────────────────────────────────────────────────────
  const sec80C = inv.filter(i=>['ppf','elss','nps'].includes(i.investment_type))
    .reduce((s,i)=>s+i.invested_amount, 0)
  const sec80G        = 0 // from tithe tax-deductible entries (simplified)
  const std           = 50000
  const taxableIncome = Math.max(0, annualGross - Math.min(sec80C,150000) - sec80G - std)
  let estimatedTax    = 0
  if (taxableIncome > 1500000)      estimatedTax = 150000 + (taxableIncome-1500000)*0.30
  else if (taxableIncome > 1200000) estimatedTax =  90000 + (taxableIncome-1200000)*0.20
  else if (taxableIncome > 900000)  estimatedTax =  45000 + (taxableIncome-900000)*0.15
  else if (taxableIncome > 600000)  estimatedTax =  15000 + (taxableIncome-600000)*0.10
  else if (taxableIncome > 300000)  estimatedTax =          (taxableIncome-300000)*0.05
  const taxDue = Math.max(0, estimatedTax - annualTDS)

  // ── Net Worth & Health Score ─────────────────────────────────────────────────
  const netWorth = liquidCash + portfolioValue - totalDebt
  let healthScore = 40
  if (liquidCash >= monthlyIncome*3) healthScore += 15
  if (debtRatio < 30)                healthScore += 15
  if (gls.length > 0)                healthScore += 10
  if (totalInvested > 0)             healthScore += 10
  if (rcv.filter(r=>r.status==='overdue').length===0) healthScore += 5
  if (ins.length > 0)                healthScore +=  5
  healthScore = Math.min(100, healthScore)

  // ── Upcoming events (next 45 days) ──────────────────────────────────────────
  const upcomingEvents: UpcomingEvent[] = []
  dbt.forEach(d => {
    if (d.next_emi_date) {
      const days = Math.ceil((new Date(d.next_emi_date).getTime()-Date.now())/86400000)
      if (days >= 0 && days <= 45)
        upcomingEvents.push({ label:`${d.lender_name} EMI`, date:d.next_emi_date, amount:d.emi_amount, type:'emi', daysLeft:days })
    }
  })
  ins.forEach(p => {
    if (p.renewal_date) {
      const days = Math.ceil((new Date(p.renewal_date).getTime()-Date.now())/86400000)
      if (days >= 0 && days <= 45)
        upcomingEvents.push({ label:`${p.policy_name} renewal`, date:p.renewal_date, amount:p.annual_premium, type:'renewal', daysLeft:days })
    }
  })
  upcomingEvents.sort((a,b)=>a.daysLeft-b.daysLeft)

  // ── Tithe ───────────────────────────────────────────────────────────────────
  const titheThisMonth = tth.reduce((s,t)=>s+t.amount, 0)
  const titheTarget    = monthlyIncome * 0.1

  // ── Receivables ─────────────────────────────────────────────────────────────
  const pendingReceivables = rcv.map(r => ({
    from: r.from_name, amount: r.balance_due, status: r.status,
  }))

  return {
    builtAt: now.toISOString(), userId, currentFY,
    accounts: accountSummaries, liquidCash, totalAssets,
    income: incomeSummaries, annualIncome, monthlyIncome, annualTDS,
    expenses: expenseSummaries, thisMonthSpend, lastMonthSpend, topCategories,
    debts: debtSummaries, totalDebt, totalEMI, debtRatio,
    investments: investmentSummaries, totalInvested, portfolioValue, portfolioGain, portfolioGainPct,
    goals: goalSummaries, activeGoals, completedGoals,
    insurance: insuranceSummaries, totalCoverage, totalPremium,
    grossIncome: annualGross, taxableIncome, estimatedTax, taxPaid: annualTDS, taxDue, sec80C, sec80G,
    netWorth, healthScore,
    upcomingEvents, titheThisMonth, titheTarget,
    pendingReceivables,
  }
}

// ── Prompt Orchestrator ─────────────────────────────────────────────────────────
// Compiles the system prompt from the financial context.
// This is the single place that shapes what the AI "knows".

export function buildSystemPrompt(ctx: FinancialContext): string {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const pct = (n: number) => `${n.toFixed(1)}%`

  return `You are the FinanceOS AI Copilot — an intelligent personal finance advisor for an Indian user.
You have real-time access to ALL of the user's financial data as of ${new Date(ctx.builtAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}.

══ FINANCIAL CONTEXT (FY ${ctx.currentFY}) ══

NET WORTH: ${fmt(ctx.netWorth)} | Health Score: ${ctx.healthScore}/100
Assets: ${fmt(ctx.totalAssets)} | Liabilities: ${fmt(ctx.totalDebt)}

LIQUID CASH: ${fmt(ctx.liquidCash)} across ${ctx.accounts.length} account(s)
${ctx.accounts.map(a => `  • ${a.name} (${a.bank ?? a.type}): ${fmt(a.balance)}`).join('\n')}

INCOME (Annual):
  Gross: ${fmt(ctx.grossIncome)} | Net: ${fmt(ctx.annualIncome)} | TDS: ${fmt(ctx.annualTDS)}
  Monthly avg net: ${fmt(ctx.monthlyIncome)}
${ctx.income.slice(0,5).map(i => `  • ${i.source} (${i.type}): ${fmt(i.gross)} gross`).join('\n')}

EXPENSES (This month): ${fmt(ctx.thisMonthSpend)} | Last month: ${fmt(ctx.lastMonthSpend)}
Top categories:
${ctx.topCategories.map(c => `  • ${c.category}: ${fmt(c.amount)} (${c.pct}%)`).join('\n')}

DEBT: ${fmt(ctx.totalDebt)} outstanding | Monthly EMI: ${fmt(ctx.totalEMI)} | Debt ratio: ${pct(ctx.debtRatio)}
${ctx.debts.map(d => `  • ${d.lender} (${d.type}): ${fmt(d.outstanding)} @ ${d.rate}% | EMI ${fmt(d.emi)}`).join('\n')}

INVESTMENTS: ${fmt(ctx.portfolioValue)} (invested: ${fmt(ctx.totalInvested)}, gain: ${fmt(ctx.portfolioGain)} / ${pct(ctx.portfolioGainPct)})
${ctx.investments.map(i => `  • ${i.name} (${i.type}): ${fmt(i.currentValue)} | ${pct(i.gainPct)} gain`).join('\n')}

GOALS (${ctx.activeGoals} active, ${ctx.completedGoals} completed):
${ctx.goals.map(g => `  • ${g.name}: ${g.pct}% complete (${fmt(g.current)}/${fmt(g.target)})`).join('\n')}

INSURANCE: ${ctx.insurance.length} policies | Coverage: ${fmt(ctx.totalCoverage)} | Annual premium: ${fmt(ctx.totalPremium)}
${ctx.insurance.map(p => `  • ${p.name} (${p.type}): ${fmt(p.coverage)} coverage, ${fmt(p.premium)}/yr`).join('\n')}

TAXES:
  Taxable income: ${fmt(ctx.taxableIncome)} | Estimated tax: ${fmt(ctx.estimatedTax)}
  TDS paid: ${fmt(ctx.taxPaid)} | Tax due: ${fmt(ctx.taxDue)}
  80C used: ${fmt(ctx.sec80C)} / ${fmt(150000)} max

TITHE: Paid this month: ${fmt(ctx.titheThisMonth)} | Target (10%): ${fmt(ctx.titheTarget)}

UPCOMING (next 45 days):
${ctx.upcomingEvents.length > 0
  ? ctx.upcomingEvents.map(e => `  • ${e.label}: ${e.amount ? fmt(e.amount) : ''} in ${e.daysLeft} days`).join('\n')
  : '  None'}

PENDING RECEIVABLES: ${ctx.pendingReceivables.length > 0
  ? ctx.pendingReceivables.map(r => `${r.from}: ${fmt(r.amount)} (${r.status})`).join(', ')
  : 'None'}

══ INSTRUCTIONS ══

1. You MUST reason across ALL the data above — never answer from a single module.
2. Every recommendation must include:
   - WHY: the specific data that led to this recommendation
   - SOURCES: which modules/data were used
   - CONFIDENCE: High/Medium/Low
   - NEXT ACTION: one concrete step the user can take now
3. Use ₹ symbol and Indian number format (lakhs, crores).
4. Be concise, specific, and action-oriented. No generic advice.
5. When the user asks about a topic, proactively mention related risks or opportunities you can see in their data.
6. When suggesting automations or actions, always say "I can help you set this up" and ask for confirmation before doing anything.
7. Refer to this financial data naturally — you already know it, so don't ask the user to repeat it.`
}

// ── Recommendation Engine ────────────────────────────────────────────────────────
// Generates proactive insights from the context without the user asking.

export interface Recommendation {
  id:         string
  category:   string
  title:      string
  why:        string
  sources:    string[]
  confidence: 'High' | 'Medium' | 'Low'
  impact:     'High' | 'Medium' | 'Low'
  nextAction: string
  href:       string
  color:      string
}

export function generateRecommendations(ctx: FinancialContext): Recommendation[] {
  const recs: Recommendation[] = []
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const expenseChange = ctx.lastMonthSpend > 0
    ? ((ctx.thisMonthSpend - ctx.lastMonthSpend) / ctx.lastMonthSpend) * 100 : 0

  // 1. Emergency fund
  const emgMonths = ctx.monthlyIncome > 0 ? ctx.liquidCash / ctx.monthlyIncome : 0
  if (emgMonths < 3) recs.push({
    id: 'emg', category: 'Security', color: '#f59e0b',
    title: `Emergency fund covers only ${emgMonths.toFixed(1)} months`,
    why: `Your liquid cash (${fmt(ctx.liquidCash)}) divided by monthly income (${fmt(ctx.monthlyIncome)}) = ${emgMonths.toFixed(1)} months. The safe minimum is 3–6 months.`,
    sources: ['Accounts', 'Income'],
    confidence: 'High', impact: 'High',
    nextAction: `Transfer ${fmt(ctx.monthlyIncome * 3 - ctx.liquidCash)} to a high-yield savings account to reach 3-month target.`,
    href: '/accounts',
  })

  // 2. High debt ratio
  if (ctx.debtRatio > 40) recs.push({
    id: 'debt', category: 'Debt', color: '#ff5a5f',
    title: `EMIs consume ${ctx.debtRatio}% of income — above safe limit`,
    why: `Monthly EMI total (${fmt(ctx.totalEMI)}) ÷ monthly income (${fmt(ctx.monthlyIncome)}) = ${ctx.debtRatio}%. Above 40% stresses cash flow.`,
    sources: ['Debt', 'Income'],
    confidence: 'High', impact: 'High',
    nextAction: `Focus on prepaying the highest-interest loan first. Check if any loan allows part-prepayment without penalty.`,
    href: '/debt',
  })

  // 3. 80C optimisation
  const remaining80C = Math.max(0, 150000 - ctx.sec80C)
  if (remaining80C > 0 && ctx.annualIncome > 300000) recs.push({
    id: '80c', category: 'Tax', color: '#c9a227',
    title: `Save ${fmt(Math.round(remaining80C * 0.2))} in tax via 80C`,
    why: `You have used ${fmt(ctx.sec80C)} of the ₹1.5L limit. Investing ${fmt(remaining80C)} more in ELSS/PPF/NPS would reduce taxable income and save approximately ${fmt(Math.round(remaining80C * 0.2))} in tax.`,
    sources: ['Investments', 'Taxes', 'Income'],
    confidence: 'High', impact: 'Medium',
    nextAction: `Invest ${fmt(remaining80C)} in ELSS (tax-saving mutual fund) before 31 March to claim 80C deduction.`,
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
    why: `With a net worth of ${fmt(ctx.netWorth)} and income of ${fmt(ctx.annualIncome)}, uninsured risks could wipe out years of savings in one event.`,
    sources: ['Insurance', 'Net Worth'],
    confidence: 'High', impact: 'High',
    nextAction: `Add at minimum: term life (10× annual income = ${fmt(ctx.annualIncome * 10)}) and health insurance (₹5L minimum cover).`,
    href: '/insurance',
  })

  // 6. Portfolio under-invested
  const invPct = ctx.totalAssets > 0 ? (ctx.portfolioValue / ctx.totalAssets) * 100 : 0
  if (invPct < 20 && ctx.monthlyIncome > 0) recs.push({
    id: 'inv', category: 'Investments', color: '#00C896',
    title: `Only ${invPct.toFixed(0)}% of assets in investments`,
    why: `Investments (${fmt(ctx.portfolioValue)}) are ${invPct.toFixed(0)}% of total assets (${fmt(ctx.totalAssets)}). Experts recommend 30–70% in growth assets depending on age.`,
    sources: ['Investments', 'Accounts'],
    confidence: 'Medium', impact: 'High',
    nextAction: `Start a monthly SIP of ${fmt(Math.round(ctx.monthlyIncome * 0.15))} (15% of income) in diversified equity funds.`,
    href: '/investments',
  })

  // 7. Upcoming EMI warning
  const urgentEMI = ctx.upcomingEvents.find(e => e.type === 'emi' && e.daysLeft <= 5)
  if (urgentEMI) recs.push({
    id: 'emi', category: 'Debt', color: '#ff5a5f',
    title: `EMI due in ${urgentEMI.daysLeft} day${urgentEMI.daysLeft !== 1 ? 's' : ''}`,
    why: `${urgentEMI.label} of ${fmt(urgentEMI.amount ?? 0)} is due on ${new Date(urgentEMI.date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}.`,
    sources: ['Debt', 'Calendar'],
    confidence: 'High', impact: 'High',
    nextAction: `Ensure ${fmt(urgentEMI.amount ?? 0)} is available in your primary account before the due date.`,
    href: '/debt',
  })

  // 8. Tax due warning
  if (ctx.taxDue > 0) recs.push({
    id: 'tax', category: 'Taxes', color: '#c9a227',
    title: `Estimated tax due: ${fmt(ctx.taxDue)}`,
    why: `Your estimated tax (${fmt(ctx.estimatedTax)}) minus TDS paid (${fmt(ctx.taxPaid)}) leaves ${fmt(ctx.taxDue)} to be paid before July 31.`,
    sources: ['Taxes', 'Income'],
    confidence: 'Medium', impact: 'Medium',
    nextAction: `Pay advance tax or file ITR early to avoid interest under Section 234B/234C.`,
    href: '/taxes',
  })

  return recs.sort((a,b) => {
    const iPriority = { High: 0, Medium: 1, Low: 2 }
    return iPriority[a.impact] - iPriority[b.impact]
  }).slice(0, 6)
}

// ── Executive Brief ──────────────────────────────────────────────────────────────

export interface ExecutiveBrief {
  headline:     string
  summary:      string
  strengths:    string[]
  risks:        string[]
  opportunities:string[]
  upcomingEvents:UpcomingEvent[]
  healthScore:  number
  netWorth:     number
}

export function generateExecutiveBrief(ctx: FinancialContext): ExecutiveBrief {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const savingsRate = ctx.monthlyIncome > 0
    ? Math.max(0, ctx.monthlyIncome - ctx.thisMonthSpend) / ctx.monthlyIncome * 100 : 0
  const emgMonths = ctx.monthlyIncome > 0 ? ctx.liquidCash / ctx.monthlyIncome : 0

  const headline = ctx.healthScore >= 75
    ? `Strong financial position — Net Worth ${fmt(ctx.netWorth)}`
    : ctx.healthScore >= 50
    ? `Stable finances with room to improve — ${ctx.debtRatio > 40 ? 'high debt ratio needs attention' : 'focus on building emergency fund'}`
    : `Financial health needs attention — action required on ${ctx.debtRatio > 40 ? 'debt' : 'savings'}`

  const strengths: string[] = []
  if (emgMonths >= 3) strengths.push(`Emergency fund covers ${emgMonths.toFixed(1)} months`)
  if (ctx.debtRatio < 30) strengths.push(`Healthy debt ratio at ${ctx.debtRatio}%`)
  if (ctx.portfolioGainPct > 0) strengths.push(`Investment portfolio up ${ctx.portfolioGainPct.toFixed(1)}%`)
  if (ctx.activeGoals > 0) strengths.push(`${ctx.activeGoals} active financial goal${ctx.activeGoals>1?'s':''} on track`)
  if (savingsRate > 20) strengths.push(`Savings rate of ${savingsRate.toFixed(0)}% — above the 20% benchmark`)
  if (ctx.insurance.length > 0) strengths.push(`${ctx.insurance.length} insurance polic${ctx.insurance.length>1?'ies':'y'} in place`)

  const risks: string[] = []
  if (emgMonths < 3) risks.push(`Emergency fund only ${emgMonths.toFixed(1)} months (need 3–6)`)
  if (ctx.debtRatio > 40) risks.push(`EMIs at ${ctx.debtRatio}% of income — above 40% danger zone`)
  if (ctx.insurance.length === 0) risks.push('No insurance — one event could wipe out savings')
  if (ctx.taxDue > 5000) risks.push(`Tax due of ${fmt(ctx.taxDue)} — file/pay before July 31`)
  if (ctx.pendingReceivables.some(r=>r.status==='overdue'))
    risks.push(`${ctx.pendingReceivables.filter(r=>r.status==='overdue').length} overdue receivable${ctx.pendingReceivables.filter(r=>r.status==='overdue').length>1?'s':''}`)

  const opportunities: string[] = []
  const rem80C = Math.max(0, 150000 - ctx.sec80C)
  if (rem80C > 0) opportunities.push(`Save ${fmt(Math.round(rem80C*0.2))} in tax by maximising 80C (${fmt(rem80C)} remaining)`)
  const invPct = ctx.totalAssets > 0 ? (ctx.portfolioValue/ctx.totalAssets)*100 : 0
  if (invPct < 30) opportunities.push(`Increase investments — only ${invPct.toFixed(0)}% of assets are in growth instruments`)
  if (ctx.monthlyIncome > 0 && ctx.totalEMI === 0) opportunities.push('Zero debt — ideal time to aggressively invest and build wealth')
  if (ctx.goals.length === 0) opportunities.push('Set a financial goal to direct your savings purposefully')

  return {
    headline, strengths, risks, opportunities,
    upcomingEvents: ctx.upcomingEvents.slice(0, 5),
    healthScore: ctx.healthScore,
    netWorth: ctx.netWorth,
    summary: `Your net worth is ${fmt(ctx.netWorth)} with a health score of ${ctx.healthScore}/100. ${
      strengths.length > 0 ? `Strengths: ${strengths[0]}. ` : ''
    }${risks.length > 0 ? `Key risk: ${risks[0]}.` : 'No major risks detected.'}`,
  }
}
