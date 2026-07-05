'use client'

import { useState, useEffect } from 'react'
import { useState } from 'react'
import { Plus, AlertTriangle, Calendar, Percent, TrendingDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AddDebtForm } from '@/components/forms/AddDebtForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

const DEBT_ICONS: Record<string,string> = { home_loan:'🏠',vehicle_loan:'🚗',personal_loan:'💼',education_loan:'🎓',gold_loan:'🪙',credit_card_outstanding:'💳',bnpl:'📱',friend_family:'🤝',other:'📄' }

interface DebtAccount { id:string; debt_type:string; lender_name:string; original_amount:number; outstanding:number; interest_rate:number; rate_type:string; emi_amount?:number; tenure_months?:number; remaining_months?:number; next_emi_date?:string }

export function DebtModule({ debts: initial }: { debts: DebtAccount[] }) {
  const [debts, setDebts]       = useState(initial)
  useEffect(() => { setDebts(initial) }, [initial])
  const [showAdd, setShowAdd]   = useState(false)
  const [deleting, setDeleting] = useState<string|null>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete loan from "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('debt_accounts').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setDebts(prev => prev.filter(d => d.id !== id)); toast.success('Loan deleted') }
    setDeleting(null)
  }

  const totalOutstanding = debts.reduce((s,d) => s+d.outstanding, 0)
  const totalEMI         = debts.reduce((s,d) => s+(d.emi_amount??0), 0)
  const totalOriginal    = debts.reduce((s,d) => s+d.original_amount, 0)
  const paidPctOverall   = totalOriginal > 0 ? ((totalOriginal-totalOutstanding)/totalOriginal)*100 : 0
  const nextEMI          = debts.filter(d => d.next_emi_date).sort((a,b) => new Date(a.next_emi_date!).getTime()-new Date(b.next_emi_date!).getTime())[0]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Debt</h1><p className="text-xs text-muted-foreground mt-0.5">{debts.length} active loans</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" /> Add Loan</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Outstanding', value:fmtINR(totalOutstanding), icon:TrendingDown, color:'text-red-400' },
          { label:'Monthly EMI',       value:fmtINR(totalEMI),         icon:Calendar,    color:'text-amber-400' },
          { label:'Active Loans',      value:String(debts.length),     icon:AlertTriangle,color:'text-blue-400' },
          { label:'Paid Off',          value:`${paidPctOverall.toFixed(0)}%`, icon:Percent, color:'text-green-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="metric-label">{item.label}</p><item.icon className={cn('h-4 w-4',item.color)} /></div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {nextEMI && (
        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 border-amber-500/20 bg-amber-500/5">
          <Calendar className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm"><span className="font-medium">Next EMI: </span><span className="text-muted-foreground">{nextEMI.lender_name} — </span><span className="font-semibold text-white">{fmtINR(nextEMI.emi_amount??0)}</span><span className="text-muted-foreground"> due {fmtDate(nextEMI.next_emi_date!)}</span></p>
        </div>
      )}
      <div className="space-y-3">
        {debts.length===0 ? (
          <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-3xl">✅</span><p className="text-sm text-muted-foreground">No active debt — well done!</p>
          </div>
        ) : debts.map(debt => {
          const pct = debt.original_amount>0 ? ((debt.original_amount-debt.outstanding)/debt.original_amount)*100 : 0
          return (
            <div key={debt.id} className="glass-card rounded-xl p-5 hover:border-blue-500/20 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0">{DEBT_ICONS[debt.debt_type]??'📄'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{debt.lender_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{debt.debt_type.replace(/_/g,' ')}</Badge>
                      <span className="text-xs text-muted-foreground">{debt.interest_rate}% · {debt.rate_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base font-bold text-red-400 tabular-nums">{fmtINR(debt.outstanding)}</p>
                    <p className="text-xs text-muted-foreground">of {fmtINR(debt.original_amount)}</p>
                  </div>
                  <button onClick={() => handleDelete(debt.id, debt.lender_name)} disabled={deleting===debt.id}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% paid off</span>
                  {debt.remaining_months && <span>{debt.remaining_months} months remaining</span>}
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
              {(debt.emi_amount || debt.next_emi_date) && (
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  {debt.emi_amount && <span>EMI: <span className="text-white font-medium">{fmtINR(debt.emi_amount)}/mo</span></span>}
                  {debt.next_emi_date && <span>Next: <span className="text-white font-medium">{fmtDate(debt.next_emi_date)}</span></span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <AddDebtForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
