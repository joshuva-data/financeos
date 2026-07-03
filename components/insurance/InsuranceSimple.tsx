'use client'

import { AddInsurancePolicyForm } from '@/components/forms/AddInsurancePolicyForm'
import { useState } from 'react'
import { Plus, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Policy {
  id: string
  policy_name: string
  insurance_type: string
  insurer_name: string
  sum_assured: number | null
  annual_premium: number | null
  renewal_date: string | null
  status: string
}

interface Props { policies: Policy[] }

export function InsuranceSimple({ policies }: Props) {
  const [showAdd, setShowAdd] = useState(false)

  const totalPremium  = policies.reduce((s, p) => s + (p.annual_premium ?? 0), 0)
  const totalCover    = policies.reduce((s, p) => s + (p.sum_assured ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Insurance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {policies.length} active policies
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Policy
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Annual Premium</p>
          <p className="text-xl font-semibold tabular-nums">
            ₹{totalPremium.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Coverage</p>
          <p className="text-xl font-semibold tabular-nums">
            ₹{totalCover.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-border/50">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No policies added yet</p>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Policy
            </Button>
          </div>
        ) : policies.map(p => (
          <div key={p.id}
            className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">{p.policy_name}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize">
                  {p.insurance_type.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">{p.insurer_name}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">
                ₹{(p.annual_premium ?? 0).toLocaleString('en-IN')}/yr
              </p>
              {p.renewal_date && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(p.renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <AddInsurancePolicyForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}