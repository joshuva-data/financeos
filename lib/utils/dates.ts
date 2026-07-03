export function fmtDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  
  export function fmtDateShort(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
    })
  }
  
  export function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
  
  export function getCurrentFY(): string {
    const now = new Date()
    return now.getMonth() >= 3
      ? `${now.getFullYear()}-${now.getFullYear() + 1}`
      : `${now.getFullYear() - 1}-${now.getFullYear()}`
  }