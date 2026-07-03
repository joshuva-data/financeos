interface PolicyCardProps { policy: InsurancePolicy; compact?: boolean }

export function PolicyCard({ policy, compact }: PolicyCardProps) {
  const days = daysUntil(policy.renewal_date)
  const isUrgent = days <= 7

  const TYPE_ICONS: Record<string, string> = {
    health: '🏥', life: '💙', vehicle: '🚗', property: '🏠',
    term: '📋', ulip: '📈', travel: '✈️', corporate: '🏢', other: '🛡️'
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card transition-colors hover:border-border', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
            {TYPE_ICONS[policy.insurance_type] ?? '🛡️'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{policy.policy_name}</p>
              <StatusBadge status={policy.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{policy.insurer_name}</p>
            {policy.policy_number && <p className="text-[10px] text-muted-foreground font-mono">#{policy.policy_number}</p>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold">{fmtINR(policy.annual_premium)}<span className="text-xs font-normal text-muted-foreground">/yr</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Cover: {fmtINR(policy.sum_insured)}</p>
          {!compact && (
            <Badge variant={isUrgent ? 'destructive' : days <= 30 ? 'secondary' : 'outline'} className="mt-1.5 text-[10px]">
              {days <= 0 ? 'Expired' : days === 1 ? 'Due Tomorrow' : `Renews in ${days}d`}
            </Badge>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-3 pt-3 border-t border-border/40 flex gap-4 text-xs text-muted-foreground">
          <span>Start: {fmtDate(policy.start_date)}</span>
          <span>Renewal: <span className={cn('font-medium', isUrgent && 'text-negative')}>{fmtDate(policy.renewal_date)}</span></span>
          {policy.auto_renew && <span className="text-positive ml-auto">Auto-renew ✓</span>}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: InsurancePolicy['status'] }) {
  const map: Record<InsurancePolicy['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Active', variant: 'default' },
    lapsed: { label: 'Lapsed', variant: 'destructive' },
    renewal_due: { label: 'Renewal Due', variant: 'secondary' },
    expired: { label: 'Expired', variant: 'destructive' },
    claimed: { label: 'Claimed', variant: 'outline' },
  }
  const cfg = map[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={cfg.variant} className="text-[10px] capitalize">{cfg.label}</Badge>
}