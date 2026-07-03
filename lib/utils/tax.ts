export interface TaxSlabResult {
    taxableIncome: number
    taxBeforeCess: number
    educationCess: number
    totalTax: number
  }
  
  // New tax regime FY 2025-26
  const NEW_REGIME_SLABS = [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.20 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ]
  
  // Old tax regime FY 2025-26
  const OLD_REGIME_SLABS = [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.20 },
    { upto: Infinity, rate: 0.30 },
  ]
  
  export function calculateTax(
    grossIncome: number,
    deductions: number,
    regime: 'old' | 'new'
  ): TaxSlabResult {
    const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS
    const taxableIncome = Math.max(0, grossIncome - (regime === 'new' ? 75000 : deductions))
  
    let taxBeforeCess = 0
    let remaining = taxableIncome
    let prevUpto = 0
  
    for (const slab of slabs) {
      if (remaining <= 0) break
      const slabIncome = Math.min(remaining, slab.upto - prevUpto)
      taxBeforeCess += slabIncome * slab.rate
      remaining -= slabIncome
      prevUpto = slab.upto
    }
  
    // Rebate u/s 87A (new regime: income <= 7L, old: income <= 5L)
    if (regime === 'new' && taxableIncome <= 700000) taxBeforeCess = 0
    if (regime === 'old' && taxableIncome <= 500000) taxBeforeCess = 0
  
    const educationCess = Math.round(taxBeforeCess * 0.04)
    const totalTax = taxBeforeCess + educationCess
  
    return { taxableIncome, taxBeforeCess: Math.round(taxBeforeCess), educationCess, totalTax }
  }