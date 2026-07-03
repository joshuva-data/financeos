export interface CashflowSummary {
    totalIncome: number
    totalExpenses: number
    netSavings: number
    savingsRate: number
    expenseRatio: number
    byCategory: { category: string; amount: number; pct: number }[]
  }
  
  export function summarizeCashflow(
    transactions: { amount: number; direction: 'credit' | 'debit'; category: string }[]
  ): CashflowSummary {
    const totalIncome = transactions.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
    const totalExpenses = transactions.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
    const netSavings = totalIncome - totalExpenses
  
    const catMap: Record<string, number> = {}
    transactions.filter(t => t.direction === 'debit').forEach(t => {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
    })
  
    const byCategory = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
      }))
  
    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0,
      expenseRatio: totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0,
      byCategory,
    }
  }