'use client'

import { useState, useEffect } from 'react'
import { useState } from 'react'
import { Plus, Heart, Receipt, Percent, Calendar, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RecordGivingForm } from '@/components/forms/RecordGivingForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface TitheEntry { id:string; recipient_name:string; category:string; amount:number; giving_date:string; tithe_pct:number; tax_deductible:boolean; is_recurring:boolean; financial_year:string }

const CAT_LABELS: Record<string,string> = { tithe:'Tithe', offering:'Offering', charity:'Charity', donation:'Donation', other:'Other' }

export function TitheModule({ entries: initial, financialYear }: { entries: TitheEntry[]; financialYear: string }) {
  const [entries, setEntries]   = useState(initial)
  useEffect(() => { setEntries(initial) }, [initial])
  const [tab, setTab]           = useState('entries')
  const [showAdd, setShowAdd]   = useState(false)
  const [deleting, setDeleting] = useState<string|null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this giving record?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('tithe_entries').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setEntries(prev => prev.filter(e => e.id !== id)); toast.success('Record deleted') }
    setDeleting(null)
  }

  const totalGiven    = entries.reduce((s,e) => s+e.amount, 0)
  const totalTithe    = entries.filter(e => e.category==='tithe').reduce((s,e) => s+e.amount, 0)
  const taxDeductible = entries.filter(e => e.tax_deductible).reduce((s,e) => s+e.amount, 0)
  const pctEntries    = entries.filter(e => e.tithe_pct>0)
  const avgPct        = pctEntries.length>0 ? pctEntries.reduce((s,e)=>s+e.tithe_pct,0)/pctEntries.length : 0

  const byRecipient = entries.reduce<Record<string,number>>((acc,e) => { acc[e.recipient_name]=(acc[e.recipient_name]??0)+e.amount; return acc }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Tithe & Giving</h1><p className="text-xs text-muted-foreground mt-0.5">FY {financialYear} · {entries.length} entries</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" /> Record Giving</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Given',    value:fmtINR(totalGiven),    icon:Heart,    color:'text-pink-400'  },
          { label:'Tithe Portion',  value:fmtINR(totalTithe),    icon:Percent,  color:'text-blue-400'  },
          { label:'Tax Deductible', value:fmtINR(taxDeductible), icon:Receipt,  color:'text-green-400' },
          { label:'Avg Tithe %',    value:`${avgPct.toFixed(1)}%`, icon:Calendar, color:'text-muted-foreground' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="metric-label">{item.label}</p><item.icon className={cn('h-4 w-4',item.color)} /></div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="entries">All Entries</TabsTrigger><TabsTrigger value="recipients">By Recipient</TabsTrigger></TabsList>
        <TabsContent value="entries" className="mt-4 space-y-2">
          {entries.length===0 ? (
            <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3"><span className="text-3xl">🤲</span><p className="text-sm text-muted-foreground">No giving records yet</p><Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Record Giving</Button></div>
          ) : entries.map(e => (
            <div key={e.id} className="glass-card rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.recipient_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{CAT_LABELS[e.category]??e.category}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(e.giving_date)}</span>
                  {e.tax_deductible && <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">80G</Badge>}
                  {e.is_recurring && <Badge variant="outline" className="text-[10px]">Recurring</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">{fmtINR(e.amount)}</p>
                  {e.tithe_pct>0 && <p className="text-xs text-muted-foreground">{e.tithe_pct}%</p>}
                </div>
                <button onClick={() => handleDelete(e.id)} disabled={deleting===e.id}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="recipients" className="mt-4 space-y-2">
          {Object.entries(byRecipient).sort((a,b)=>b[1]-a[1]).map(([name,total]) => (
            <div key={name} className="glass-card rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-sm font-bold tabular-nums text-white">{fmtINR(total)}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
      <RecordGivingForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
