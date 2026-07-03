export function fmtINR(amount: number): string {
    if (isNaN(amount)) return '₹0'
    const abs = Math.abs(amount)
    let formatted: string
    if (abs >= 10_000_000) {
      formatted = (abs / 10_000_000).toFixed(2) + ' Cr'
    } else if (abs >= 100_000) {
      formatted = (abs / 100_000).toFixed(2) + ' L'
    } else {
      formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    }
    return `${amount < 0 ? '-' : ''}₹${formatted}`
  }
  
  export function fmtINRFull(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  
  export function fmtPct(value: number): string {
    return `${value.toFixed(2)}%`
  }
