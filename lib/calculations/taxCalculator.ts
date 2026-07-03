export interface TaxSlabResult {
    taxableIncome: number
    taxBeforeCess: number
    educationCess: number
    totalTax: number
    effectiveRate: number
  }
  
  interface TaxSlab { upto: number; rate: number }
  
  // New Regime FY 2025-26 (per Budget 2025)
  const NEW_SLABS: TaxSlab[] = [
    { upto: 400_000, rate: 0 },
    { upto: 800_000, rate: 0.05 },
    { upto: 1_200_000, rate: 0.10 },
    { upto: 1_600_000, rate: 0.15 },
    { upto: 2_000_000, rate: 0.20 },
    { upto: 2_400_000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ]
  
  // Old Regime FY 2025-26 (below 60)
  const OLD_SLABS: TaxSlab[] = [
    { upto: 250_000, rate: 0 },
    { upto: 500_000, rate: 0.05 },
    { upto: 1_000_000, rate: 0.20 },
    { upto: Infinity, rate: 0.30 },
  ]
  
  const CESS_RATE = 0.04
  
  function applySlabs(income: number, slabs: TaxSlab[]): number {
    let tax = 0
    let prev = 0
    for (const slab of slabs) {
      if (income <= 0) break
      const slabWidth = slab.upto - prev
      const taxable = Math.min(income, slabWidth)
      tax += taxable * slab.rate
      income -= taxable
      prev = slab.upto
      if (slab.upto === Infinity) break
    }
    return Math.round(tax)
  }
  
  export function calculateTax(
    grossIncome: number,
    deductions: number,
    regime: 'old' | 'new'
  ): TaxSlabResult {
    if (grossIncome <= 0) return { taxableIncome: 0, taxBeforeCess: 0, educationCess: 0, totalTax: 0, effectiveRate: 0 }
  
    const standardDeduction = regime === 'new' ? 75_000 : 50_000
    const totalDeductions = regime === 'new' ? standardDeduction : deductions + standardDeduction
    const taxableIncome = Math.max(0, Math.round(grossIncome - totalDeductions))
  
    const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS
    let taxBeforeCess = applySlabs(taxableIncome, slabs)
  
    // Rebate u/s 87A
    const rebateLimit = regime === 'new' ? 700_000 : 500_000
    const rebateMax = regime === 'new' ? 25_000 : 12_500
    if (taxableIncome <= rebateLimit) {
      taxBeforeCess = Math.max(0, taxBeforeCess - Math.min(taxBeforeCess, rebateMax))
    }
  
    // Surcharge (10% for income 50L-1Cr, 15% for 1Cr-2Cr, 25% for >2Cr in old; capped at 25% in new)
    let surcharge = 0
    if (grossIncome > 5_000_000 && grossIncome <= 10_000_000) surcharge = taxBeforeCess * 0.10
    else if (grossIncome > 10_000_000 && grossIncome <= 20_000_000) surcharge = taxBeforeCess * 0.15
    else if (grossIncome > 20_000_000) surcharge = taxBeforeCess * (regime === 'new' ? 0.25 : 0.25)
  
    const taxWithSurcharge = taxBeforeCess + Math.round(surcharge)
    const educationCess = Math.round(taxWithSurcharge * CESS_RATE)
    const totalTax = taxWithSurcharge + educationCess
    const effectiveRate = grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0
  
    return { taxableIncome, taxBeforeCess: taxWithSurcharge, educationCess, totalTax, effectiveRate }
  }
  
  export function compareTaxRegimes(grossIncome: number, oldRegimeDeductions: number) {
    const oldResult = calculateTax(grossIncome, oldRegimeDeductions, 'old')
    const newResult = calculateTax(grossIncome, 0, 'new')
    const savings = Math.abs(oldResult.totalTax - newResult.totalTax)
    return {
      old: oldResult,
      new: newResult,
      recommended: oldResult.totalTax <= newResult.totalTax ? 'old' : 'new',
      savings,
      savingsRegime: oldResult.totalTax <= newResult.totalTax ? 'old' : 'new',
    }
  }
  
  export function calculateHRAExemption(
    hraReceived: number,
    basicSalary: number,
    rentPaid: number,
    isMetroCity: boolean
  ): number {
    const actual = hraReceived
    const percentage = isMetroCity ? basicSalary * 0.50 : basicSalary * 0.40
    const rentExcess = Math.max(0, rentPaid - basicSalary * 0.10)
    return Math.min(actual, percentage, rentExcess)
  }