import type { FinancialSnapshot } from './financialSnapshot'

export interface SuggestedQuestion {
  icon: string        // lucide icon name
  label: string
  priority: number    // lower = higher priority
  category: 'urgent' | 'insight' | 'planning' | 'regular'
}

export function generateSuggestions(snapshot: FinancialSnapshot): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = []

  // Urgent — overdue items
  if (snapshot.overdueReceivables > 0) {
    suggestions.push({
      icon: 'AlertCircle',
      label: `Who owes me money and how much is overdue?`,
      priority: 1,
      category: 'urgent',
    })
  }

  // Upcoming renewals
  if (snapshot.upcomingRenewals.length > 0) {
    const names = snapshot.upcomingRenewals.slice(0, 2).map(r => r.name).join(', ')
    suggestions.push({
      icon: 'Shield',
      label: `Show my upcoming insurance renewals`,
      priority: 2,
      category: 'urgent',
    })
  }

  // Upcoming EMIs
  if (snapshot.upcomingEMIs.length > 0) {
    suggestions.push({
      icon: 'Calendar',
      label: `What EMIs are due this month?`,
      priority: 3,
      category: 'urgent',
    })
  }

  // Net worth
  suggestions.push({
    icon: 'TrendingUp',
    label: `What is my current net worth?`,
    priority: 4,
    category: 'insight',
  })

  // High debt-to-income
  if (snapshot.totalEMI > 0 && snapshot.monthlyIncome > 0) {
    const dtiRatio = (snapshot.totalEMI / snapshot.monthlyIncome) * 100
    if (dtiRatio > 40) {
      suggestions.push({
        icon: 'AlertTriangle',
        label: `My EMIs seem high. Help me analyse my debt situation.`,
        priority: 2,
        category: 'urgent',
      })
    } else {
      suggestions.push({
        icon: 'CreditCard',
        label: `Summarise my active loans and EMI obligations`,
        priority: 5,
        category: 'insight',
      })
    }
  }

  // Tithe
  if (snapshot.monthlyIncome > 0) {
    suggestions.push({
      icon: 'Heart',
      label: `How much tithe should I pay this month?`,
      priority: 6,
      category: 'regular',
    })
  }

  // Tax
  suggestions.push({
    icon: 'Receipt',
    label: `Estimate my tax liability for FY ${snapshot.currentFY}`,
    priority: 7,
    category: 'planning',
  })

  // Goals progress
  if (snapshot.goalsCount > 0) {
    suggestions.push({
      icon: 'Target',
      label: `How are my financial goals progressing?`,
      priority: 8,
      category: 'planning',
    })
  }

  // Expense analysis
  suggestions.push({
    icon: 'BarChart3',
    label: `Analyse my spending patterns this month`,
    priority: 9,
    category: 'insight',
  })

  // Corporate benefits
  suggestions.push({
    icon: 'Building2',
    label: `What are my corporate benefits and EPF balance?`,
    priority: 10,
    category: 'regular',
  })

  // Investments
  suggestions.push({
    icon: 'LineChart',
    label: `Show my investment portfolio performance`,
    priority: 11,
    category: 'insight',
  })

  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6)
}