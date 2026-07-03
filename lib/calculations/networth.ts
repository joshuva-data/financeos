export interface NetWorthBreakdown {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    liquid: number
    investments: number
    receivables: number
    realEstate: number
    other: number
    debtAccounts: number
    creditCards: number
  }
  
  export function computeNetWorth(components: {
    bankBalances: number
    walletBalances: number
    investmentValue: number
    receivables: number
    propertyValue: number
    vehicleValue: number
    goldValue: number
    loans: number
    creditCardDues: number
  }): NetWorthBreakdown {
    const liquid = components.bankBalances + components.walletBalances
    const investments = components.investmentValue + components.goldValue
    const receivables = components.receivables
    const realEstate = components.propertyValue
    const other = components.vehicleValue
  
    const totalAssets = liquid + investments + receivables + realEstate + other
    const totalLiabilities = components.loans + components.creditCardDues
    const netWorth = totalAssets - totalLiabilities
  
    return {
      totalAssets, totalLiabilities, netWorth,
      liquid, investments, receivables, realEstate, other,
      debtAccounts: components.loans, creditCards: components.creditCardDues,
    }
  }
  
  export function netWorthGrowthRate(snapshots: { net_worth: number; snapshot_date: string }[]): number {
    if (snapshots.length < 2) return 0
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    const oldest = sorted[0].net_worth
    const latest = sorted[sorted.length - 1].net_worth
    if (oldest <= 0) return 0
    const months = sorted.length - 1
    return Math.round(((Math.pow(latest / oldest, 1 / months) - 1) * 100) * 100) / 100
  }