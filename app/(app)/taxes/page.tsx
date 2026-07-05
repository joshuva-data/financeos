import { createClient } from '@/lib/supabase/server'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function TaxesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now       = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const [{ data: income }, { data: investments }, { data: tithe }] = await Promise.all([
    supabase.from('income_entries').select('*').eq('user_id', user.id).eq('financial_year', currentFY),
    supabase.from('investments').select('*').eq('user_id', user.id),
    supabase.from('tithe_entries').select('amount, tax_deductible').eq('user_id', user.id).eq('financial_year', currentFY),
  ])

  const grossIncome   = (income ?? []).reduce((s, i) => s + i.gross_amount, 0)
  const totalTDS      = (income ?? []).reduce((s, i) => s + i.tds_deducted, 0)
  const sec80C        = (investments ?? []).filter(i => ['ppf','elss','nps'].includes(i.investment_type)).reduce((s, i) => s + i.invested_amount, 0)
  const sec80G        = (tithe ?? []).filter(t => t.tax_deductible).reduce((s, t) => s + t.amount, 0)
  const std           = 50000
  const taxableIncome = Math.max(0, grossIncome - Math.min(sec80C, 150000) - sec80G - std)

  let tax = 0
  if (taxableIncome > 1500000)       tax = 150000 + (taxableIncome - 1500000) * 0.30
  else if (taxableIncome > 1200000)  tax =  90000 + (taxableIncome - 1200000) * 0.20
  else if (taxableIncome > 900000)   tax =  45000 + (taxableIncome -  900000) * 0.15
  else if (taxableIncome > 600000)   tax =  15000 + (taxableIncome -  600000) * 0.10
  else if (taxableIncome > 300000)   tax =          (taxableIncome -  300000) * 0.05
  const netTaxDue = Math.max(0, tax - totalTDS)

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Tax Centre</h1>
        <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} · New Tax Regime · Auto-calculated from your data</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Income',   value: fmt(grossIncome),   color: 'text-green-400'  },
          { label: 'TDS Deducted',   value: fmt(totalTDS),      color: 'text-amber-400'  },
          { label: 'Taxable Income', value: fmt(taxableIncome), color: 'text-blue-400'   },
          { label: 'Tax Due',        value: fmt(netTaxDue),     color: netTaxDue > 0 ? 'text-red-400' : 'text-green-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <p className="metric-label">{item.label}</p>
            <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tax Calculation</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Gross Income',              value: fmt(grossIncome),                     dim: false },
            { label: 'Standard Deduction',        value: `− ${fmt(std)}`,                      dim: true  },
            { label: `Sec 80C (max ₹1.5L)`,       value: `− ${fmt(Math.min(sec80C, 150000))}`, dim: true  },
            { label: 'Sec 80G (Donations)',        value: `− ${fmt(sec80G)}`,                   dim: true  },
            { label: 'Taxable Income',             value: fmt(taxableIncome),                   dim: false },
            { label: 'Estimated Tax',              value: fmt(tax),                             dim: false },
            { label: 'TDS Already Paid',           value: `− ${fmt(totalTDS)}`,                 dim: true  },
            { label: 'Net Tax Due',                value: fmt(netTaxDue),                       dim: false },
          ].map(row => (
            <div key={row.label} className={`flex justify-between py-2 border-b border-white/5 last:border-0 ${row.label === 'Net Tax Due' ? 'font-semibold pt-3 border-t border-white/10' : ''}`}>
              <span className={row.dim ? 'text-muted-foreground' : ''}>{row.label}</span>
              <span className={row.label === 'Net Tax Due' ? (netTaxDue > 0 ? 'text-red-400' : 'text-green-400') : ''}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold">Tax Saving Opportunities</h2>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {sec80C < 150000 && <p className="text-amber-400">💡 Invest {fmt(150000 - sec80C)} more in PPF / ELSS / NPS to maximise 80C deduction and save {fmt((150000 - sec80C) * 0.05)} in tax.</p>}
          {sec80G === 0    && <p className="text-blue-400">💡 Donations to registered charities are 80G deductible. Record them in Tithe & Giving.</p>}
          {totalTDS === 0 && grossIncome > 250000 && <p className="text-red-400">⚠️ No TDS recorded. Add your TDS in Income entries to avoid double counting.</p>}
          {netTaxDue === 0 && totalTDS > 0 && <p className="text-green-400">✓ Your TDS covers your full tax liability. You may be eligible for a refund.</p>}
          <p className="pt-1">📋 Calculated under New Tax Regime (FY 2024-25 slabs). Consult a CA for exact filing.</p>
        </div>
      </div>
    </div>
  )
}
