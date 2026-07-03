'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { InsurancePolicy, InsuranceClaim } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate, daysUntil } from '@/lib/utils/dates'
// import { AddPolicyModal } from './AddPolicyModal'
import { PolicyCard } from './PolicyCard'
import { cn } from '@/lib/utils'

interface InsuranceModuleProps {
  policies: InsurancePolicy[]
  claims: InsuranceClaim[]
}

export function InsuranceModule({ policies, claims }: InsuranceModuleProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [tab, setTab] = useState('policies')

  const totalPremium = policies.reduce((s, p) => s + p.annual_premium, 0)
  const totalCoverage = policies.reduce((s, p) => s + p.sum_insured, 0)
  const dueSoon = policies.filter(p => daysUntil(p.renewal_date) <= 30 && p.status === 'active')

  const byType = policies.reduce<Record<string, InsurancePolicy[]>>((acc, p) => {
    acc[p.insurance_type] = [...(acc[p.insurance_type] ?? []), p]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Insurance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{policies.length} active policies</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Policy
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Annual Premium', value: fmtINR(totalPremium), icon: Shield, color: 'text-primary' },
          { label: 'Total Coverage', value: fmtINR(totalCoverage), icon: CheckCircle, color: 'text-positive' },
          { label: 'Renewals Due', value: String(dueSoon.length), icon: AlertTriangle, color: dueSoon.length > 0 ? 'text-warning' : 'text-muted-foreground' },
          { label: 'Total Policies', value: String(policies.length), icon: Clock, color: 'text-muted-foreground' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="metric-label">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Renewal Alert Banner */}
      {dueSoon.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium text-warning">{dueSoon.length} {dueSoon.length === 1 ? 'policy' : 'policies'}</span>
            <span className="text-muted-foreground"> renewing in the next 30 days. </span>
            <span className="font-medium">Total: {fmtINR(dueSoon.reduce((s, p) => s + p.annual_premium, 0))}</span>
          </p>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="policies">All Policies</TabsTrigger>
          <TabsTrigger value="bytype">By Type</TabsTrigger>
          <TabsTrigger value="claims">Claims {claims.length > 0 && `(${claims.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-4 space-y-3">
          {policies.length === 0 ? (
            <EmptyInsurance onAdd={() => setShowAdd(true)} />
          ) : (
            policies.map(p => <PolicyCard key={p.id} policy={p} />)
          )}
        </TabsContent>

        <TabsContent value="bytype" className="mt-4 space-y-5">
          {Object.entries(byType).map(([type, typePolicies]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold capitalize">{type.replace('_', ' ')} Insurance</h3>
                <span className="text-xs text-muted-foreground">({typePolicies.length})</span>
              </div>
              {typePolicies.map(p => <PolicyCard key={p.id} policy={p} compact />)}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="claims" className="mt-4">
          <ClaimsTable claims={claims} />
        </TabsContent>
      </Tabs>
    </div>
  )
}