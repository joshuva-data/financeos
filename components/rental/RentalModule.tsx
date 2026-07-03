'use client'

import { AddRentalPropertyForm } from '@/components/forms/AddRentalPropertyForm'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Home, Users, AlertCircle, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { RentalProperty, Tenant, Receivable } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface RentalModuleProps {
  properties: RentalProperty[]
  tenants: Tenant[]
  pendingRent: Receivable[]
}

export function RentalModule({ properties, tenants, pendingRent }: RentalModuleProps) {
  const [tab, setTab] = useState('properties')
  const [showAdd, setShowAdd] = useState(false)

  const totalMonthlyRent    = properties.reduce((s, p) => s + p.monthly_rent, 0)
  const occupiedCount       = properties.filter(p => p.is_occupied).length
  const totalPending        = pendingRent.reduce((s, r) => s + r.balance_due, 0)
  const totalPortfolioValue = properties.reduce((s, p) => s + (p.current_value ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Rental Property</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {properties.length} properties · {occupiedCount} occupied
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Property
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Income',   value: fmtINR(totalMonthlyRent),    icon: TrendingUp,  color: 'text-positive' },
          { label: 'Portfolio Value',  value: fmtINR(totalPortfolioValue), icon: Home,        color: 'text-primary'  },
          { label: 'Active Tenants',   value: String(tenants.length),      icon: Users,       color: 'text-blue-500' },
          { label: 'Rent Pending',     value: fmtINR(totalPending),        icon: AlertCircle, color: totalPending > 0 ? 'text-destructive' : 'text-muted-foreground' },
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Rent {pendingRent.length > 0 && `(${pendingRent.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-4 space-y-4">
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="text-3xl">🏠</div>
              <p className="text-sm text-muted-foreground">No properties added yet</p>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Property
              </Button>
            </div>
          ) : properties.map(p => {
            const propertyTenants = tenants.filter(t => t.property_id === p.id)
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{p.property_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs capitalize">{p.property_type}</Badge>
                      <Badge variant="outline" className={cn('text-xs',
                        p.is_occupied ? 'text-positive border-positive/30' : 'text-muted-foreground')}>
                        {p.is_occupied ? 'Occupied' : 'Vacant'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold tabular-nums text-positive">
                      {fmtINR(p.monthly_rent)}<span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </p>
                    {p.current_value && (
                      <p className="text-xs text-muted-foreground">Value: {fmtINR(p.current_value)}</p>
                    )}
                  </div>
                </div>
                {propertyTenants.length > 0 && (
                  <div className="border-t border-border/40 pt-3 space-y-1">
                    {propertyTenants.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{t.tenant_name}</span>
                        <span className="text-muted-foreground">
                          Lease until {t.lease_end ? fmtDate(t.lease_end) : 'ongoing'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </TabsContent>

        <TabsContent value="tenants" className="mt-4 space-y-3">
          {tenants.length === 0
            ? <p className="text-center py-10 text-sm text-muted-foreground">No active tenants</p>
            : tenants.map(t => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{t.tenant_name}</p>
                  <p className="text-sm font-bold tabular-nums">{fmtINR(t.monthly_rent)}/mo</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {t.phone && <span>{t.phone}</span>}
                  <span>Rent due: {t.rent_due_day}th</span>
                  <span>Deposit: {fmtINR(t.deposit_paid)}</span>
                </div>
              </div>
            ))
          }
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingRent.length === 0
            ? <p className="text-center py-10 text-sm text-positive">All rents collected ✓</p>
            : pendingRent.map(r => (
              <div key={r.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4">
                <div>
                  <p className="text-sm font-semibold">{r.from_name}</p>
                  <p className="text-xs text-muted-foreground">Due: {fmtDate(r.due_date)} · {r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-destructive">{fmtINR(r.balance_due)}</p>
                  <Badge variant="outline" className={cn('text-xs',
                    r.status === 'overdue'
                      ? 'text-destructive border-destructive/30'
                      : 'text-warning border-warning/30')}>
                    {r.status}
                  </Badge>
                </div>
              </div>
            ))
          }
        </TabsContent>
      </Tabs>
      <AddRentalPropertyForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}