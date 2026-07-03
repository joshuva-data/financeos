/*export function calculateXIRR(cashflows: { amount: number; date: Date }[]): number {
    // Newton-Raphson XIRR approximation
    let rate = 0.1
    for (let iter = 0; iter < 100; iter++) {
      const t0 = cashflows[0].date.getTime()
      let f = 0, df = 0
      for (const cf of cashflows) {
        const t = (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000)
        const v = Math.pow(1 + rate, t)
        f += cf.amount / v
        df += -t * cf.amount / (v * (1 + rate))
      }
      const delta = f / df
      rate -= delta
      if (Math.abs(delta) < 1e-6) break
    }
    return Math.round(rate * 10000) / 100
  }
  
  export function simpleReturn(invested: number, current: number): number {
    if (invested <= 0) return 0
    return Math.round(((current - invested) / invested) * 10000) / 100
  }
  
  export function sipFutureValue(monthlyAmount: number, annualReturn: number, months: number): number {
    const r = annualReturn / 12 / 100
    return Math.round(monthlyAmount * ((Math.pow(1 + r, months) - 1) / r) * (1 + r))
  }
  
  export function goalMonthsRequired(target: number, currentSaved: number, monthlyContrib: number, annualReturn: number): number {
    if (monthlyContrib <= 0) return Infinity
    const r = annualReturn / 12 / 100
    if (r === 0) return Math.ceil((target - currentSaved) / monthlyContrib)
    // SIP formula: target - currentSaved * (1+r)^n = monthlyContrib * ((1+r)^n - 1) / r
    // Approximate numerically
    let months = 0
    let accumulated = currentSaved
    while (accumulated < target && months < 1200) {
      accumulated = accumulated * (1 + r) + monthlyContrib
      months++
    }
    return months
  }*/

  export function simpleReturn(invested: number, current: number): number {
  if (invested === 0) return 0
  return ((current - invested) / invested) * 100
}