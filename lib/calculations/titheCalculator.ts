export interface TitheResult {
    grossIncome: number
    tithePercentage: number
    titheAmount: number
    alreadyGiven: number
    balanceToGive: number
    isCurrent: boolean
    monthlyBreakdown?: { month: string; income: number; tithe: number; given: number; balance: number }[]
  }
  
  export function calculateTithe(
    income: number,
    alreadyGiven: number,
    percentage = 10
  ): TitheResult {
    const titheAmount = Math.round((income * percentage) / 100)
    const balanceToGive = Math.max(0, titheAmount - alreadyGiven)
    return {
      grossIncome: income,
      tithePercentage: percentage,
      titheAmount,
      alreadyGiven,
      balanceToGive,
      isCurrent: balanceToGive === 0,
    }
  }