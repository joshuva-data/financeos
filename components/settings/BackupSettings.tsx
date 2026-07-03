'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function BackupSettings({ userId }: { userId: string }) {
  const [exporting, setExporting] = useState<string | null>(null)
  const supabase = createClient()

  const exportData = async (module: string) => {
    setExporting(module)
    const tableMap: Record<string, string> = {
      transactions: 'transactions', accounts: 'accounts',
      insurance: 'insurance_policies', investments: 'investments',
      debt: 'debt_accounts', receivables: 'receivables',
    }
    const table = tableMap[module]
    const { data, error } = await supabase.from(table as any).select('*').eq('user_id', userId)
    setExporting(null)
    if (error) { toast.error(error.message); return }
    const headers = Object.keys(data?.[0] ?? {}).join(',')
    const rows = (data ?? []).map(r => Object.values(r).map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v ?? '')).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `financeos-${module}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(`${module} exported`)
  }

  const exports = [
    { key: 'transactions', label: 'All Transactions' },
    { key: 'accounts', label: 'Bank Accounts' },
    { key: 'insurance', label: 'Insurance Policies' },
    { key: 'investments', label: 'Investment Portfolio' },
    { key: 'debt', label: 'Debt Accounts' },
    { key: 'receivables', label: 'Receivables' },
  ]

  return (
    <SectionCard title="Export Data" description="Download your financial data as CSV">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {exports.map(e => (
          <div key={e.key} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{e.label}</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportData(e.key)} disabled={exporting === e.key}>
              {exporting === e.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            </Button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}