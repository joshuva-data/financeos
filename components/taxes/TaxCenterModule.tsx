'use client'

import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle, TrendingDown, Calculator } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TaxProfile, TaxDeduction, Document } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { calculateTax } from '@/lib/calculations/taxCalculator'
import { cn } from '@/lib/utils'

interface TaxCenterModuleProps {
  currentFY: string
  taxProfiles: TaxProfile[]
  deductions: TaxDeduction[]
  taxDocuments: Document[]
}

export function TaxCenterModule({ currentFY, taxProfiles, deductions, taxDocuments }: TaxCenterModuleProps) {
  const [regime, setRegime] = useState<'old' | 'new'>('new')
  const currentProfile = taxProfiles.find(p => p.financial_year === currentFY) ?? taxProfiles[0]

  const totalDeductions80C = deductions.filter(d => d.section === '80C').reduce((s, d) => s + d.amount_claimed, 0)
  const totalDeductions80D = deductions.filter(d => d.section === '80D').reduce((s, d) => s + d.amount_claimed, 0)

  const grossSalary = currentProfile?.gross_salary ?? 0
  const totalTDS = currentProfile?.total_tds ?? 0
  const hraExemption = currentProfile?.hra_exemption ?? 0

  const oldDeductions = Math.min(totalDeductions80C, 150000) + Math.min(totalDeductions80D, 25000) + hraExemption + 50000
  const oldResult = calculateTax(grossSalary, oldDeductions, 'old')
  const newResult = calculateTax(grossSalary, 75000, 'new')

  const result = regime === 'old' ? oldResult : newResult
  const balanceDue = Math.max(0, result.totalTax - totalTDS)
  const refundDue = Math.max(0, totalTDS - result.totalTax)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Tax Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} · AY {currentFY.split('-')[0]}–{String(Number(currentFY.split('-')[0]) + 1)}</p>
        </div>
        <div className="flex gap-1.5 bg-muted/50 rounded-lg p-1">
          {(['old', 'new'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRegime(r)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', regime === r ? 'bg-card shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground')}
            >
              {r === 'old' ? 'Old Regime' : 'New Regime'}
            </button>
          ))}
        </div>
      </div>

      {/* Tax Estimate Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Income', value: fmtINR(grossSalary), icon: TrendingDown, color: 'text-positive' },
          { label: 'Total Tax', value: fmtINR(result.totalTax), icon: Calculator, color: 'text-foreground' },
          { label: 'TDS Paid', value: fmtINR(totalTDS), icon: CheckCircle, color: 'text-positive' },
          { label: balanceDue > 0 ? 'Balance Due' : 'Refund Due', value: fmtINR(balanceDue > 0 ? balanceDue : refundDue), icon: AlertCircle, color: balanceDue > 0 ? 'text-negative' : 'text-positive' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{card.label}</p>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
            <p className={cn('text-xl font-semibold tabular-nums tracking-tight', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="estimator">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="estimator">Tax Estimator</TabsTrigger>
          <TabsTrigger value="deductions">Deductions ({deductions.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({taxDocuments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="estimator" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Tax Computation — {regime === 'old' ? 'Old' : 'New'} Regime</h3>
            {[
              ['Gross Salary', fmtINR(grossSalary)],
              ['Standard Deduction', `(${fmtINR(regime === 'new' ? 75000 : 50000)})`],
              regime === 'old' && ['Section 80C', `(${fmtINR(Math.min(totalDeductions80C, 150000))})`],
              regime === 'old' && ['Section 80D', `(${fmtINR(Math.min(totalDeductions80D, 25000))})`],
              regime === 'old' && hraExemption > 0 && ['HRA Exemption', `(${fmtINR(hraExemption)})`],
              ['Taxable Income', fmtINR(result.taxableIncome)],
              ['Tax (before cess)', fmtINR(result.taxBeforeCess)],
              ['Education Cess (4%)', fmtINR(result.educationCess)],
              ['Total Tax', fmtINR(result.totalTax)],
              ['TDS Already Paid', `(${fmtINR(totalTDS)})`],
              [balanceDue > 0 ? '⚠ Balance Due' : '✓ Refund Due', balanceDue > 0 ? fmtINR(balanceDue) : fmtINR(refundDue)],
            ].filter(Boolean).map(([label, value], i, arr) => (
              <div key={label as string} className={cn('flex justify-between items-center py-2', i < arr.length - 1 ? 'border-b border-border/30' : 'border-t border-border font-semibold text-base mt-2 pt-3')}>
                <span className="text-sm text-muted-foreground">{label as string}</span>
                <span className="text-sm font-medium tabular-nums">{value as string}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deductions" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/50 bg-muted/20">
                  <tr>{['Section', 'Instrument', 'Claimed', 'Max Allowed'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {deductions.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No deductions added yet</td></tr>
                  ) : deductions.map(d => (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs font-mono">{d.section}</Badge></td>
                      <td className="px-4 py-3 font-medium">{d.instrument}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{fmtINR(d.amount_claimed)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.max_allowed ? fmtINR(d.max_allowed) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {taxDocuments.length === 0 ? (
              <div className="sm:col-span-2 rounded-xl border border-dashed border-border bg-card py-12 text-center space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No tax documents uploaded</p>
                <p className="text-xs text-muted-foreground">Upload Form 16, AIS, 26AS, or ITR acknowledgements</p>
              </div>
            ) : taxDocuments.map(doc => (
              <div key={doc.id} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.financial_year ?? '—'}</p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto text-xs h-7 flex-shrink-0">View</Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}