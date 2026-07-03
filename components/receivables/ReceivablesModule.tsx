'use client'

import { useState } from 'react'
import { Plus, Clock, AlertCircle, CheckCircle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FormDialog } from '@/components/forms/FormDialog'
import { FormField } from '@/components/forms/FormField'
import { AmountInput } from '@/components/forms/AmountInput'
import { AddReceivableForm } from '@/components/forms/AddReceivableForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface Receivable { id:string; from_name:string; from_type:string; amount:number; amount_received:number; balance_due:number; due_date:string; reason:string; status:string; contact_phone?:string }

const STATUS_CFG: Record<string,{label:string;color:string}> = {
  pending:            { label:'Pending',  color:'text-amber-400 border-amber-500/30'  },
  partially_received: { label:'Partial',  color:'text-blue-400 border-blue-500/30'   },
  overdue:            { label:'Overdue',  color:'text-red-400 border-red-500/30'     },
  received:           { label:'Received', color:'text-green-400 border-green-500/30' },
}

export function ReceivablesModule({ receivables: initial }: { receivables: Receivable[] }) {
  const [receivables, setReceivables] = useState(initial)
  const [showAdd, setShowAdd]         = useState(false)
  const [markItem, setMarkItem]       = useState<Receivable|null>(null)
  const [markAmount, setMarkAmount]   = useState('')
  const [marking, setMarking]         = useState(false)
  const [deleting, setDeleting]       = useState<string|null>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete receivable from "${name}"?`)) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('receivables').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setReceivables(prev => prev.filter(r => r.id !== id)); toast.success('Deleted') }
    setDeleting(null)
  }

  const handleMark = async () => {
    if (!markItem || !markAmount || parseFloat(markAmount)<=0) { toast.error('Enter a valid amount'); return }
    setMarking(true)
    const supabase = createClient()
    const newReceived = parseFloat(markAmount)
    const status = newReceived >= markItem.amount ? 'received' : 'partially_received'
    const { error } = await supabase.from('receivables').update({ amount_received: newReceived, status }).eq('id', markItem.id)
    if (error) toast.error(error.message)
    else {
      setReceivables(prev => prev.map(r => r.id===markItem.id ? {...r, amount_received:newReceived, balance_due:r.amount-newReceived, status} : r).filter(r => r.status !== 'received'))
      toast.success(status==='received' ? 'Fully received!' : 'Partial payment recorded')
      setMarkItem(null); setMarkAmount('')
    }
    setMarking(false)
  }

  const totalDue = receivables.reduce((s,r) => s+r.balance_due, 0)
  const overdue  = receivables.filter(r => r.status==='overdue')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Receivables</h1><p className="text-xs text-muted-foreground mt-0.5">{receivables.length} pending</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" /> Add Receivable</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Due',     value:fmtINR(totalDue), icon:RefreshCw,  color:'text-blue-400' },
          { label:'Overdue',       value:String(overdue.length), icon:AlertCircle, color:overdue.length>0?'text-red-400':'text-muted-foreground' },
          { label:'Pending',       value:String(receivables.filter(r=>r.status==='pending').length), icon:Clock, color:'text-amber-400' },
          { label:'Partial',       value:String(receivables.filter(r=>r.status==='partially_received').length), icon:RefreshCw, color:'text-blue-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="metric-label">{item.label}</p><item.icon className={cn('h-4 w-4',item.color)} /></div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {overdue.length>0 && (
        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm"><span className="font-medium text-red-400">{overdue.length} overdue</span><span className="text-muted-foreground"> · {fmtINR(overdue.reduce((s,r)=>s+r.balance_due,0))} total</span></p>
        </div>
      )}
      <div className="space-y-3">
        {receivables.length===0 ? (
          <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3"><span className="text-3xl">✅</span><p className="text-sm text-muted-foreground">No pending receivables</p></div>
        ) : receivables.map(r => {
          const cfg = STATUS_CFG[r.status]??STATUS_CFG.pending
          const paidPct = r.amount>0 ? ((r.amount-r.balance_due)/r.amount)*100 : 0
          return (
            <div key={r.id} className="glass-card rounded-xl p-4 hover:border-blue-500/20 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.from_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] capitalize">{r.from_type}</Badge>
                    <span className="text-xs text-muted-foreground">{r.reason}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base font-bold text-white tabular-nums">{fmtINR(r.balance_due)}</p>
                    <Badge variant="outline" className={cn('text-[10px] mt-0.5', cfg.color)}>{cfg.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setMarkItem(r); setMarkAmount(String(r.balance_due)) }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-green-500/10 hover:text-green-400 transition-colors">
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r.id, r.from_name)} disabled={deleting===r.id}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              {r.amount_received>0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Received: {fmtINR(r.amount_received)}</span><span>Total: {fmtINR(r.amount)}</span></div>
                  <div className="h-1.5 rounded-full bg-white/6 overflow-hidden"><div className="h-full rounded-full bg-green-500" style={{width:`${paidPct}%`}} /></div>
                </div>
              )}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Due: <span className={cn('font-medium', r.status==='overdue'?'text-red-400':'text-white')}>{fmtDate(r.due_date)}</span></span>
                {r.contact_phone && <span>{r.contact_phone}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mark received dialog */}
      <FormDialog open={!!markItem} onClose={() => setMarkItem(null)} title={`Mark Received — ${markItem?.from_name}`} size="sm">
        <div className="space-y-4 mt-2">
          <FormField label="Amount Received" hint={`Full amount: ${fmtINR(markItem?.amount??0)}`}>
            <AmountInput value={markAmount} onChange={setMarkAmount} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMarkItem(null)} disabled={marking}>Cancel</Button>
            <Button onClick={handleMark} disabled={marking}>{marking?'Saving…':'Mark Received'}</Button>
          </div>
        </div>
      </FormDialog>

      <AddReceivableForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
