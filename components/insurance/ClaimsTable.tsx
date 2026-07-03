function ClaimsTable({ claims }: { claims: InsuranceClaim[] }) {
  if (claims.length === 0) return (
    <div className="rounded-xl border border-border/50 bg-card py-12 text-center space-y-2">
      <CheckCircle className="h-8 w-8 text-positive mx-auto opacity-50" />
      <p className="text-sm text-muted-foreground">No claims filed</p>
    </div>
  )
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/50 bg-muted/30">
            <tr>{['Claim #', 'Date', 'Amount', 'Approved', 'Status'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {claims.map(c => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{c.claim_number ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.claim_date)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{fmtINR(c.claim_amount)}</td>
                <td className="px-4 py-3 tabular-nums">{c.approved_amount ? fmtINR(c.approved_amount) : '—'}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyInsurance({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center space-y-3">
      <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto" />
      <p className="text-sm font-medium">No insurance policies yet</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">Add your health, life, and vehicle policies to track premiums and renewal dates.</p>
      <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Policy</Button>
    </div>
  )
}

// Stub — full implementation in components/insurance/AddPolicyModal.tsx
function AddPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border/50 p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Add Insurance Policy</h2>
        <p className="text-sm text-muted-foreground">Full form implementation: InsurancePolicyForm with React Hook Form + Zod using insurancePolicySchema from lib/validations/insurance.ts</p>
        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}