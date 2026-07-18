// ============================================================================
// Shared Supabase client type for the AI layer.
//
// We derive this from the actual return type of lib/supabase/server.ts's
// createClient() rather than importing `SupabaseClient<Database>` from
// '@supabase/supabase-js' directly. Those two types don't structurally match
// in this project (a pre-existing quirk of how @supabase/ssr's
// createServerClient<Database>() infers its schema generic — visible
// throughout the app, e.g. lib/actions/automation.ts, well before this AI
// layer existed). Typing against the real return value avoids fighting that
// mismatch in every new file.
// ============================================================================
import type { createClient } from '@/lib/supabase/server'
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// ============================================================================
// lib/ai/types.ts
//
// Shared vocabulary for the AI Copilot's reasoning layer. Every service in
// lib/ai/services/* imports from here so the Context Builder, Reasoning
// Engine, Recommendation Engine, Action Generator, and Prompt Orchestrator
// all agree on shapes.
// ============================================================================

// ── Per-module summaries (one entry per Context Builder module) ─────────────

export interface AccountSummary {
  id: string; name: string; type: string; bank?: string; balance: number
}

export interface IncomeSummary {
  source: string; type: string; gross: number; net: number; tds: number; month: number; fy: string
}

export interface ExpenseSummary {
  category: string; amount: number; month: number; direction: string; date?: string
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

export interface DocumentSummary {
  id: string; title: string; type: string; uploadedAt: string; expiryDate?: string | null; linkedType?: string | null
}

export interface CalendarEventSummary {
  id: string; label: string; date: string; amount?: number; type: string; daysLeft: number
}

export interface NotificationSummary {
  id: string; title: string; body: string; severity: 'info' | 'warning' | 'critical'; isRead: boolean; createdAt: string
}

export interface AutomationSummary {
  id: string; name: string; category: string; status: string; runCount: number; lastRunAt?: string | null
}

// Kept for backward compatibility with modules that referred to "UpcomingEvent"
export type UpcomingEvent = CalendarEventSummary

// ── The full cross-module context the Financial Reasoning Engine works from ──

export interface FinancialContext {
  // Snapshot metadata
  builtAt:   string
  userId:    string
  currentFY: string

  // 1. Accounts
  accounts:        AccountSummary[]
  liquidCash:      number
  totalAssets:     number

  // 2. Income
  income:          IncomeSummary[]
  annualIncome:    number
  monthlyIncome:   number
  annualTDS:       number

  // 3. Expenses
  expenses:        ExpenseSummary[]
  thisMonthSpend:  number
  lastMonthSpend:  number
  topCategories:   { category: string; amount: number; pct: number }[]

  // 4. Investments
  investments:     InvestmentSummary[]
  totalInvested:   number
  portfolioValue:  number
  portfolioGain:   number
  portfolioGainPct:number

  // 5. Debt
  debts:           DebtSummary[]
  totalDebt:       number
  totalEMI:        number
  debtRatio:       number   // EMI / monthly income %

  // 6. Insurance
  insurance:       InsuranceSummary[]
  totalCoverage:   number
  totalPremium:    number

  // 7. Taxes (computed)
  grossIncome:     number
  taxableIncome:   number
  estimatedTax:    number
  taxPaid:         number
  taxDue:          number
  sec80C:          number
  sec80G:          number

  // 8. Goals
  goals:           GoalSummary[]
  activeGoals:     number
  completedGoals:  number

  // 9. Documents
  documents:       DocumentSummary[]
  expiringDocuments: DocumentSummary[]

  // 10. Analytics (derived cross-module metrics)
  netWorth:        number
  healthScore:     number
  savingsRate:     number
  emergencyFundMonths: number

  // 11. Calendar (next 45 days)
  upcomingEvents:  CalendarEventSummary[]

  // 12. Notifications
  notifications:   NotificationSummary[]
  unreadNotificationCount: number

  // 13. Automation
  automations:     AutomationSummary[]
  activeAutomationCount: number

  // Misc — kept from the pre-existing context builder
  titheThisMonth:  number
  titheTarget:     number
  pendingReceivables: { from: string; amount: number; status: string }[]
}

// ── Recommendation Engine output ─────────────────────────────────────────────
// Every recommendation must be explainable: Requirement 7.

export interface Recommendation {
  id:         string
  category:   string
  title:      string
  why:        string          // the specific data that led to this recommendation
  sources:    string[]        // which Context Builder modules were used
  confidence: 'High' | 'Medium' | 'Low'
  impact:     'High' | 'Medium' | 'Low'
  nextAction: string          // one concrete step the user can take now
  href:       string
  color:      string
}

// ── Executive Financial Brief ────────────────────────────────────────────────

export interface ExecutiveBrief {
  headline:      string
  summary:       string
  strengths:     string[]
  risks:         string[]
  opportunities: string[]
  upcomingEvents:CalendarEventSummary[]
  healthScore:   number
  netWorth:      number
  generatedAt:   string
}

// ── Explainable AI (v5 Deliverable 11) ───────────────────────────────────────
// The existing Recommendation type above already carries most of this
// (why/sources/confidence/nextAction) — this is a stricter, more granular
// shape for the newer reasoning surfaces (Scenario Simulator, and future
// Spending/Investment/Risk Intelligence engines) that separates Evidence
// from Reasoning and makes Assumptions explicit, since "what did the AI
// assume" and "what did the AI observe" are different questions a user
// might want answered separately. Existing Recommendation consumers are
// unaffected — this is additive, not a replacement.

export interface ExplainableInsight {
  observation: string       // what was noticed, in plain terms
  evidence: string[]        // the specific data points that support the observation
  reasoning: string          // how the observation leads to the conclusion
  assumptions: string[]      // anything projected/estimated rather than observed directly
  suggestedActions: string[] // concrete next steps
  confidence: 'High' | 'Medium' | 'Low'
  isEstimate: boolean         // true for anything forward-looking (forecasts, scenarios)
}

// ── Scenario Simulator (v5 Deliverable 13) ───────────────────────────────────

export type ScenarioType =
  | 'increase_income' | 'increase_expense' | 'increase_sip' | 'early_loan_payoff'

export interface ScenarioInput {
  type: ScenarioType
  // Interpretation depends on `type`:
  //   increase_income / increase_expense: percentage change (e.g. 10 for +10%)
  //   increase_sip: absolute monthly rupee amount
  //   early_loan_payoff: the debt's `lender` name (matched against current debts) — omit to target the highest-interest debt
  amount: number
  targetDebtLender?: string
  projectionMonths?: number // default 12
}

export interface ScenarioMetricComparison {
  metric: string
  before: number
  after: number
  changeAbs: number
  changePct: number
}

export interface ScenarioResult extends ExplainableInsight {
  scenarioLabel: string
  comparisons: ScenarioMetricComparison[]
  projectionMonths: number
}

// ── Financial Reasoning Engine output types ──────────────────────────────────
// Requirement 6: trends, comparisons, forecasts, subscriptions.

export interface TrendExplanation {
  metric:      string
  direction:   'up' | 'down' | 'flat'
  changePct:   number
  why:         string
  sources:     string[]
}

export interface PeriodComparison {
  metric:       string
  periodALabel: string
  periodBLabel: string
  periodAValue: number
  periodBValue: number
  changeAbs:    number
  changePct:    number
  narrative:    string
}

export interface CashFlowForecastMonth {
  month:            string   // e.g. "2026-08"
  projectedIncome:  number
  projectedExpense: number
  projectedNet:     number
  runningBalance:   number
}

export interface CashFlowForecast {
  basis:       string       // explanation of assumptions used
  months:      CashFlowForecastMonth[]
  confidence:  'High' | 'Medium' | 'Low'
}

export interface RecurringSubscription {
  merchantOrCategory: string
  averageAmount:      number
  occurrences:         number
  cadence:            'monthly' | 'weekly' | 'irregular'
  lastSeen:            string
  annualCost:          number
}

// ── Action Center — Requirement 8 ────────────────────────────────────────────
// Actions are always proposed first; execution requires explicit confirmation.

export type ProposedActionType =
  | 'categorize_transactions'
  | 'create_reminder'
  | 'generate_report'
  | 'suggest_automation'
  | 'update_goal'
  | 'flag_for_review'

export interface ProposedAction {
  id?:          string   // present once persisted
  actionType:   ProposedActionType
  title:        string
  description:  string
  why:          string
  sources:      string[]
  confidence:   'High' | 'Medium' | 'Low'
  payload:      Record<string, unknown>
}

// ── Copilot conversational contract ──────────────────────────────────────────

export interface CopilotTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface CopilotResponse {
  answer:          string
  toolsUsed:       string[]
  turnCount:       number
  conversationId:  string
  proposedActions: ProposedAction[]
}
