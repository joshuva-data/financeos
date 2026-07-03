import type { Tool } from '@anthropic-ai/sdk/resources/messages'

export const FINANCEOS_TOOLS: Tool[] = [
  {
    name: 'get_net_worth',
    description: 'Get the user\'s current net worth, including asset breakdown and liability summary. Always call this for any net worth question.',
    input_schema: {
      type: 'object',
      properties: {
        include_history: {
          type: 'boolean',
          description: 'Whether to include 12-month net worth history for trend questions',
        },
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
        type_filter: {
          type: 'string',
          enum: ['health', 'life', 'vehicle', 'property', 'all'],
          description: 'Filter by insurance type',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_upcoming_renewals',
    description: 'Get insurance policies, EMIs, and financial events due in the next N days.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'number',
          description: 'Number of days to look ahead (default: 30)',
        },
      },
      required: [],
    },
  },
  {
    name: 'calculate_tax_estimate',
    description: 'Calculate estimated income tax liability for the current financial year under old or new regime.',
    input_schema: {
      type: 'object',
      properties: {
        regime: {
          type: 'string',
          enum: ['old', 'new', 'compare'],
          description: 'Tax regime to calculate under. Use "compare" to show both.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_debt_summary',
    description: 'Get all outstanding loans, EMI schedule, total debt, and debt-to-income ratio.',
    input_schema: {
      type: 'object',
      properties: {
        include_schedule: {
          type: 'boolean',
          description: 'Include upcoming EMI payment schedule',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_receivables',
    description: 'Get all amounts owed to the user — from tenants, individuals, or companies. Includes overdue amounts.',
    input_schema: {
      type: 'object',
      properties: {
        status_filter: {
          type: 'string',
          enum: ['all', 'overdue', 'pending', 'received'],
          description: 'Filter by receivable status',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_expense_analysis',
    description: 'Analyze expenses by category for a given time period. Use for spend questions and comparisons.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_month', 'this_fy', 'last_3_months'],
          description: 'Time period to analyze',
        },
        category: {
          type: 'string',
          description: 'Optional: filter to a specific category',
        },
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
        percentage: {
          type: 'number',
          description: 'Tithe percentage (default: 10)',
        },
        period: {
          type: 'string',
          enum: ['this_month', 'this_fy'],
          description: 'Period to calculate tithe for',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_corporate_benefits',
    description: 'Get EPF balance, gratuity estimate, bonuses, learning budget, and other employer benefits.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_investment_portfolio',
    description: 'Get investment portfolio summary, unrealized P&L, asset allocation, and individual holdings.',
    input_schema: {
      type: 'object',
      properties: {
        group_by: {
          type: 'string',
          enum: ['type', 'broker', 'tax_saving'],
          description: 'How to group the portfolio summary',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_cash_flow',
    description: 'Get income vs expense summary and savings rate for a period.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_month', 'this_fy'],
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_rental_status',
    description: 'Get rental property status, tenant payment history, and pending rent.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]