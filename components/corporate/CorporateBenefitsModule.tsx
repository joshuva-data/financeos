'use client'

import { useState } from 'react'
import { Plus, Edit2, Building2, Shield, Wallet, BookOpen, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AddCorporateBenefitsForm } from '@/components/forms/AddCorporateBenefitsForm'
import { fmtINR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface CorporateBenefits {
  id: string
  employer_name: string
  financial_year: string
  epf_employee_contrib: number
  epf_employer_contrib: number
  epf_balance: number
  uan_number?: string
  annual_bonus: number
  joining_bonus: number
  retention_bonus: number
  variable_pay: number
  corporate_health_cover?: number
  corporate_life_cover?: number
  learning_budget: number
  learning_used: number
  total_leaves?: number
  leaves_taken?: number
  notice_period_days?: number
}

interface Props {
  benefits: CorporateBenefits | null
  financialYear: string
}

export function CorporateBenefitsModule({ benefits, financialYear }: Props) {
  const [showForm, setShowForm] = useState(false)

  if (!benefits) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Corporate Benefits</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {financialYear}</p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center rounded-xl border border-border/50 bg-card">
          <div className="text-4xl">🏢</div>
          <div>
            <p className="text-sm font-semibold">No corporate benefits recorded</p>
            <p className="text-xs text-muted-foreground mt-1">
              Track your EPF, gratuity, bonuses, health cover, and company perks
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Set Up Benefits
          </Button>
        </div>

        <AddCorporateBenefitsForm
          open={showForm}
          onClose={() => setShowForm(false)}
          financialYear={financialYear}
        />
      </div>
    )
  }

  const epfTotal     = benefits.epf_employee_contrib + benefits.epf_employer_contrib
  const totalBonuses = benefits.annual_bonus + benefits.joining_bonus + benefits.retention_bonus + benefits.variable_pay
  const learningPct  = benefits.learning_budget > 0 ? (benefits.learning_used / benefits.learning_budget) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Corporate Benefits</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {benefits.employer_name} · FY {financialYear}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Edit2 className="h-4 w-4 mr-1.5" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'EPF Balance',   value: fmtINR(benefits.epf_balance),                  icon: Building2, color: 'text-blue-600'   },
          { label: 'Total Bonuses', value: fmtINR(totalBonuses),                           icon: Wallet,    color: 'text-green-600'  },
          { label: 'Health Cover',  value: fmtINR(benefits.corporate_health_cover ?? 0),   icon: Shield,    color: 'text-purple-600' },
          { label: 'Life Cover',    value: fmtINR(benefits.corporate_life_cover ?? 0),     icon: Shield,    color: 'text-indigo-600' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" /> EPF Details
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Employee Contribution', value: fmtINR(benefits.epf_employee_contrib) },
              { label: 'Employer Contribution', value: fmtINR(benefits.epf_employer_contrib) },
              { label: 'Total EPF (this FY)',   value: fmtINR(epfTotal) },
              { label: 'EPF Balance',           value: fmtINR(benefits.epf_balance) },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </div>
            ))}
            {benefits.uan_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">UAN Number</span>
                <span className="font-mono text-xs">{benefits.uan_number}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-green-600" /> Bonuses & Variable Pay
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Annual Bonus',    value: fmtINR(benefits.annual_bonus)    },
              { label: 'Variable Pay',    value: fmtINR(benefits.variable_pay)    },
              { label: 'Joining Bonus',   value: fmtINR(benefits.joining_bonus)   },
              { label: 'Retention Bonus', value: fmtINR(benefits.retention_bonus) },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-orange-600" /> L&D Budget
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">
                {fmtINR(benefits.learning_used)} of {fmtINR(benefits.learning_budget)}
              </span>
            </div>
            <Progress value={learningPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {fmtINR(benefits.learning_budget - benefits.learning_used)} remaining
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" /> Leave Balance
          </h3>
          {benefits.total_leaves && benefits.leaves_taken != null ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taken</span>
                <span className="font-medium">{benefits.leaves_taken} of {benefits.total_leaves} days</span>
              </div>
              <Progress value={(benefits.leaves_taken / benefits.total_leaves) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {benefits.total_leaves - benefits.leaves_taken} days remaining
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not configured</p>
          )}
          {benefits.notice_period_days && (
            <p className="text-xs text-muted-foreground">
              Notice period: {benefits.notice_period_days} days
            </p>
          )}
        </div>

      </div>

      <AddCorporateBenefitsForm
        open={showForm}
        onClose={() => setShowForm(false)}
        financialYear={financialYear}
      />
    </div>
  )
}