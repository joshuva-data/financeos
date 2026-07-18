// ============================================================================
// lib/ai/tools/definitions.ts
//
// Provider-neutral tool schema (plain JSON Schema) fed to the Prompt
// Orchestrator, which adapts it to whichever LLM provider is configured —
// currently Groq (OpenAI-compatible function-calling format). Keeping the
// definitions provider-neutral here means swapping providers later only
// touches the orchestrator's adapter, not this file.
//
// The Prompt Orchestrator loops on these until the model has enough data to
// answer without guessing — Requirement 5 ("never answer from a single data
// source" is enforced by giving the model enough distinct tools that
// answering well usually requires more than one call).
// ============================================================================

export interface FinanceOSTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string; enum?: string[] }>
    required: string[]
  }
}

export const FINANCEOS_TOOLS: FinanceOSTool[] = [
  {
    name: 'get_net_worth',
    description: 'Get the user\'s current net worth, including asset breakdown and liability summary. Always call this for any net worth question.',
    input_schema: {
      type: 'object',
      properties: {
        include_history: { type: 'boolean', description: 'Whether to include 12-month net worth history for trend questions' },
      },
      required: [],
    },
  },
  {
    name: 'get_insurance_coverage',
    description: 'Get all active insurance policies, coverage amounts, premiums, and renewal dates.',
    input_schema: {
      type: 'object',
      properties: {
        type_filter: { type: 'string', enum: ['health', 'life', 'vehicle', 'property', 'all'], description: 'Filter by insurance type' },
      },
      required: [],
    },
  },
  {
    name: 'get_upcoming_renewals',
    description: 'Get insurance policies, EMIs, and financial events due in the next N days.',
    input_schema: {
      type: 'object',
      properties: { days_ahead: { type: 'number', description: 'Number of days to look ahead (default: 30)' } },
      required: [],
    },
  },
  {
    name: 'calculate_tax_estimate',
    description: 'Calculate estimated income tax liability for the current financial year under old or new regime.',
    input_schema: {
      type: 'object',
      properties: {
        regime: { type: 'string', enum: ['old', 'new', 'compare'], description: 'Tax regime to calculate under. Use "compare" to show both.' },
      },
      required: [],
    },
  },
  {
    name: 'get_debt_summary',
    description: 'Get all outstanding loans, EMI schedule, total debt, and debt-to-income ratio.',
    input_schema: {
      type: 'object',
      properties: { include_schedule: { type: 'boolean', description: 'Include upcoming EMI payment schedule' } },
      required: [],
    },
  },
  {
    name: 'get_receivables',
    description: 'Get all amounts owed to the user — from tenants, individuals, or companies. Includes overdue amounts.',
    input_schema: {
      type: 'object',
      properties: {
        status_filter: { type: 'string', enum: ['all', 'overdue', 'pending', 'received'], description: 'Filter by receivable status' },
      },
      required: [],
    },
  },
  {
    name: 'get_expense_analysis',
    description: 'Analyze expenses by category for a given time period. Use for spend questions and single-period category breakdowns.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['this_month', 'last_month', 'this_fy', 'last_3_months'], description: 'Time period to analyze' },
        category: { type: 'string', description: 'Optional: filter to a specific category' },
      },
      required: ['period'],
    },
  },
  {
    name: 'calculate_tithe',
    description: 'Calculate tithe amount based on income. Shows what should be given and what has been given.',
    input_schema: {
      type: 'object',
      properties: {
        percentage: { type: 'number', description: 'Tithe percentage (default: 10)' },
        period: { type: 'string', enum: ['this_month', 'this_fy'], description: 'Period to calculate tithe for' },
      },
      required: [],
    },
  },
  {
    name: 'get_corporate_benefits',
    description: 'Get EPF balance, gratuity estimate, bonuses, learning budget, and other employer benefits.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_investment_portfolio',
    description: 'Get investment portfolio summary, unrealized P&L, asset allocation, and individual holdings.',
    input_schema: {
      type: 'object',
      properties: {
        group_by: { type: 'string', enum: ['type', 'broker', 'tax_saving'], description: 'How to group the portfolio summary' },
      },
      required: [],
    },
  },
  {
    name: 'get_cash_flow',
    description: 'Get income vs expense summary and savings rate for a single period.',
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['this_month', 'last_month', 'this_fy'] } },
      required: ['period'],
    },
  },
  {
    name: 'get_rental_status',
    description: 'Get rental property status, tenant payment history, and pending rent.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },

  // ── New: Documents module ────────────────────────────────────────────────
  {
    name: 'get_documents',
    description: 'List the user\'s uploaded documents (policies, statements, ITRs, etc). Use for "summarize my documents", "what documents do I have", or expiry questions.',
    input_schema: {
      type: 'object',
      properties: {
        expiring_only: { type: 'boolean', description: 'Only return documents expiring within 30 days' },
        doc_type: { type: 'string', description: 'Optional: filter by document type' },
      },
      required: [],
    },
  },

  // ── New: Calendar module ─────────────────────────────────────────────────
  {
    name: 'get_calendar',
    description: 'Get all upcoming financial calendar events (EMIs, renewals, tax deadlines, goal targets, custom reminders) within N days.',
    input_schema: {
      type: 'object',
      properties: { days_ahead: { type: 'number', description: 'Number of days to look ahead (default: 45)' } },
      required: [],
    },
  },

  // ── New: Notifications module ────────────────────────────────────────────
  {
    name: 'get_notifications',
    description: 'Get the user\'s unread/active AI-generated notifications and alerts.',
    input_schema: {
      type: 'object',
      properties: { unread_only: { type: 'boolean', description: 'Only return unread notifications (default: true)' } },
      required: [],
    },
  },

  // ── New: Automation module ───────────────────────────────────────────────
  {
    name: 'get_automations',
    description: 'Get the user\'s configured automations/workflows and their run history.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },

  // ── New: Reasoning Engine capabilities ───────────────────────────────────
  {
    name: 'compare_periods',
    description: 'Compare a financial metric (expenses, income, or net savings) between two time periods. Use for "how does this month compare to last month" style questions.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['expenses', 'income', 'savings'] },
        period_a: { type: 'string', enum: ['this_month', 'last_month', 'this_quarter', 'last_quarter'] },
        period_b: { type: 'string', enum: ['this_month', 'last_month', 'this_quarter', 'last_quarter'] },
      },
      required: ['metric', 'period_a', 'period_b'],
    },
  },
  {
    name: 'forecast_cash_flow',
    description: 'Project cash flow (income, expenses, running liquid balance) forward N months based on recent averages. Use for "will I have enough money for X" or "what will my balance look like in 3 months" questions. Always state the forecast\'s basis/assumptions to the user.',
    input_schema: {
      type: 'object',
      properties: { months_ahead: { type: 'number', description: 'How many months to project forward (default: 3, max: 12)' } },
      required: [],
    },
  },
  {
    name: 'detect_subscriptions',
    description: 'Detect likely recurring subscriptions/charges from transaction history by finding repeating category+amount patterns. Use for "what subscriptions am I paying for" questions.',
    input_schema: {
      type: 'object',
      properties: { lookback_months: { type: 'number', description: 'How many months of history to scan (default: 6)' } },
      required: [],
    },
  },
  {
    name: 'explain_trend',
    description: 'Explain why a specific metric (net worth, expenses, savings rate, or investments) is moving the way it is, with the underlying numbers.',
    input_schema: {
      type: 'object',
      properties: { metric: { type: 'string', enum: ['net_worth', 'expenses', 'savings_rate', 'investments'] } },
      required: ['metric'],
    },
  },

  // ── v5: Scenario Simulator ("What If" analysis) ──────────────────────────
  {
    name: 'simulate_scenario',
    description: 'Run a "what if" financial scenario — income change, expense change, an additional SIP/investment, or paying off a loan early. Use whenever the user asks a hypothetical question like "what if my salary increases" or "what if I invest more" or "what if I pay off my loan early". Always present the result as a projection with clearly stated assumptions, never as a certainty.',
    input_schema: {
      type: 'object',
      properties: {
        scenario_type: { type: 'string', enum: ['increase_income', 'increase_expense', 'increase_sip', 'early_loan_payoff'] },
        amount: { type: 'number', description: 'For increase_income/increase_expense: percentage change (e.g. 10 for +10%). For increase_sip: monthly rupee amount. Ignored for early_loan_payoff.' },
        target_debt_lender: { type: 'string', description: 'For early_loan_payoff only: the lender name to target. Omit to target the highest-interest debt automatically.' },
        projection_months: { type: 'number', description: 'How many months to project forward (default 12)' },
      },
      required: ['scenario_type'],
    },
  },
]
