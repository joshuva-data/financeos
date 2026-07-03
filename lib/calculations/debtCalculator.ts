export interface AmortizationRow {
    month: number
    emi: number
    principal: number
    interest: number
    balance: number
  }
  
  export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    if (annualRate === 0) return Math.round(principal / tenureMonths)
    const r = annualRate / 12 / 100
    const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1)
    return Math.round(emi)
  }
  
  export function generateAmortizationSchedule(
    principal: number,
    annualRate: number,
    tenureMonths: number
  ): AmortizationRow[] {
    const emi = calculateEMI(principal, annualRate, tenureMonths)
    const r = annualRate / 12 / 100
    const schedule: AmortizationRow[] = []
    let balance = principal
  
    for (let i = 1; i <= tenureMonths; i++) {
      const interest = Math.round(balance * r)
      const principalPaid = Math.min(emi - interest, balance)
      balance = Math.max(0, balance - principalPaid)
      schedule.push({ month: i, emi, principal: principalPaid, interest, balance })
      if (balance === 0) break
    }
  
    return schedule
  }
  
  export function debtFreeDate(remainingMonths: number): Date {
    const d = new Date()
    d.setMonth(d.getMonth() + remainingMonths)
    return d
  }
  
  export function totalInterestPayable(schedule: AmortizationRow[]): number {
    return schedule.reduce((s, r) => s + r.interest, 0)
  }