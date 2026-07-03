import { createClient } from '@/lib/supabase/server'

export default async function TaxesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const [{ data: income }, { data: investments }, { data: tithe }] = await Promise.all([
    supabase.from('income_entries').select('*').eq('user_id', user.id).eq('financial_year', currentFY),
    supabase.from('investments').select('*').eq('user_id', user.id),
    supabase.from('tithe_entries').select('amount, tax_deductible').eq('user_id', user.id).eq('financial_year', currentFY),
  ])

  const grossIncome    = (income ?? []).reduce((s, i) => s + i.gross_amount, 0)
  const totalTDS       = (income ?? []).reduce((s, i) => s + i.tds_deducted, 0)
  const sec80C         = (investments ?? []).filter(i => ['ppf','elss','nps'].includes(i.investment_type)).reduce((s, i) => s + i.invested_amount, 0)
  const sec80G         = (tithe ?? []).filter(t => t.tax_deductible).reduce((s, t) => s + t.amount, 0)
  const taxableIncome  = Math.max(0, grossIncome - Math.min(sec80C, 150000) - sec80G - 50000)

  // New tax regime (FY 2024-25)
  let estimatedTax = 0
  if (taxableIncome > 300000 && taxableIncome <= 600000)  estimatedTax = (taxableIncome - 300000) * 0.05
  else if (taxableIncome > 600000 && taxableIncome <= 900000)  estimatedTax = 15000 + (taxableIncome - 600000) * 0.10
  else if (taxableIncome > 900000 && taxableIncome <= 1200000) estimatedTax = 45000 + (taxableIncome - 900000) * 0.15
  else if (taxableIncome > 1200000 && taxableIncome <= 1500000) estimatedTax = 90000 + (taxableIncome - 1200000) * 0.20
  else if (taxableIncome > 1500000) estimatedTax = 150000 + (taxableIncome - 1500000) * 0.30
  const netTaxDue = Math.max(0, estimatedTax - totalTDS)

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Tax Centre</h1>
        <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} · Estimated based on your recorded data</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Income',    value: fmt(grossIncome),   color: 'text-green-400'  },
          { label: 'TDS Deducted',    value: fmt(totalTDS),      color: 'text-amber-400'  },
          { label: 'Taxable Income',  value: fmt(taxableIncome), color: 'text-blue-400'   },
          { label: 'Tax Due',         value: fmt(netTaxDue),     color: netTaxDue > 0 ? 'text-red-400' : 'text-green-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <p className="metric-label">{item.label}</p>
            <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tax Calculation Breakdown</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Gross Income',             value: fmt(grossIncome),                    color: '' },
            { label: 'Standard Deduction (50k)', value: `− ${fmt(50000)}`,                  color: 'text-green-400' },
            { label: 'Sec 80C (PPF/ELSS/NPS)',   value: `− ${fmt(Math.min(sec80C,150000))}`,color: 'text-green-400' },
            { label: 'Sec 80G (Donations)',       value: `− ${fmt(sec80G)}`,                 color: 'text-green-400' },
            { label: 'Taxable Income',            value: fmt(taxableIncome),                  color: 'text-blue-400'  },
            { label: 'Estimated Tax',             value: fmt(estimatedTax),                   color: 'text-amber-400' },
            { label: 'TDS Already Paid',          value: `− ${fmt(totalTDS)}`,               color: 'text-green-400' },
            { label: 'Net Tax Due',               value: fmt(netTaxDue),                      color: netTaxDue > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold' },
          ].map(row => (
            <div key={row.label} className={`flex justify-between py-2 border-b border-white/5 last:border-0 ${row.label === 'Net Tax Due' ? 'border-t border-white/10 mt-2 pt-3' : ''}`}>
              <span className="text-muted-foreground">{row.label}</span>
              <span className={`font-medium tabular-nums ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tax Saving Tips</h2>
        <div className="space-y-2 text-xs text-muted-foreground">
          {sec80C < 150000 && <p className="text-amber-400">💡 You can invest {fmt(150000 - sec80C)} more in PPF/ELSS/NPS to maximise your Sec 80C deduction.</p>}
          {sec80G === 0 && <p className="text-blue-400">💡 Donations to 80G-eligible charities are tax deductible. Record them in Tithe & Giving.</p>}
          {totalTDS === 0 && grossIncome > 250000 && <p className="text-red-400">⚠️ No TDS recorded. Make sure to add your TDS deductions in Income entries.</p>}
          <p>📋 This is an estimate only. Consult a CA for accurate tax filing.</p>
          <p>📋 Calculated using New Tax Regime (FY 2024-25 slabs).</p>
        </div>
      </div>
    </div>
  )
}
