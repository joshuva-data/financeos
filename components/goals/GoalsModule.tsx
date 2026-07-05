'use client'

import { useState, useEffect } from 'react'
import { Plus, Target, CheckCircle, TrendingUp, Trash2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddGoalForm } from '@/components/forms/AddGoalForm'
import { FormDialog } from '@/components/forms/FormDialog'
import { FormField } from '@/components/forms/FormField'
import { AmountInput } from '@/components/forms/AmountInput'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface Goal { id:string; name:string; description?:string; target_amount:number; current_amount:number; target_date?:string; monthly_contrib?:number; category?:string; icon?:string; priority:number; status:string }

const STATUS_COLORS: Record<string,string> = { active:'text-green-400 border-green-500/30', paused:'text-amber-400 border-amber-500/30', completed:'text-blue-400 border-blue-500/30', abandoned:'text-muted-foreground' }
const P_COLORS = ['','bg-red-500','bg-orange-500','bg-amber-500','bg-blue-500','bg-gray-500']

export function GoalsModule({ goals: initial }: { goals: Goal[] }) {
  const [goals, setGoals]               = useState(initial)
  const [tab, setTab]                   = useState('active')
  const [showAdd, setShowAdd]           = useState(false)
  const [deleting, setDeleting]         = useState<string|null>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal|null>(null)
  const [contribAmount, setContribAmount]   = useState('')
  const [contributing, setContributing]     = useState(false)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete goal "${name}"?`)) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('financial_goals').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { setGoals(prev => prev.filter(g => g.id !== id)); toast.success('Goal deleted') }
    setDeleting(null)
  }

  const handleContribute = async () => {
    if (!contributeGoal || !contribAmount || parseFloat(contribAmount)<=0) { toast.error('Enter a valid amount'); return }
    setContributing(true)
    const supabase = createClient()
    const newAmt   = contributeGoal.current_amount + parseFloat(contribAmount)
    const status   = newAmt >= contributeGoal.target_amount ? 'completed' : 'active'
    const { error } = await supabase.from('financial_goals').update({ current_amount: newAmt, status }).eq('id', contributeGoal.id)
    if (error) toast.error(error.message)
    else {
      setGoals(prev => prev.map(g => g.id===contributeGoal.id ? {...g, current_amount:newAmt, status} : g))
      toast.success(`Added ${fmtINR(parseFloat(contribAmount))} to ${contributeGoal.name}`)
      setContributeGoal(null); setContribAmount('')
    }
    setContributing(false)
  }

  const filterGoals = (s: string) => s==='all' ? goals : goals.filter(g => g.status===s)
  const activeGoals = goals.filter(g => g.status==='active')
  const totalTarget = activeGoals.reduce((s,g) => s+g.target_amount, 0)
  const totalSaved  = activeGoals.reduce((s,g) => s+g.current_amount, 0)
  const overallPct  = totalTarget>0 ? Math.round((totalSaved/totalTarget)*100) : 0

  const renderGoal = (goal: Goal) => {
    const pct       = goal.target_amount>0 ? (goal.current_amount/goal.target_amount)*100 : 0
    const remaining = goal.target_amount - goal.current_amount
    return (
      <div key={goal.id} className="glass-card rounded-xl p-5 hover:border-blue-500/20 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0">
              {goal.icon ? <span className="text-2xl">{goal.icon}</span> : <div className={cn('h-3 w-3 rounded-full mt-1', P_COLORS[goal.priority]??'bg-gray-500')} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{goal.name}</p>
              {goal.description && <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {goal.category && <Badge variant="secondary" className="text-[10px]">{goal.category}</Badge>}
                <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[goal.status]??'')}>{goal.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-base font-bold text-white tabular-nums">{fmtINR(goal.current_amount)}</p>
              <p className="text-xs text-muted-foreground">of {fmtINR(goal.target_amount)}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setContributeGoal(goal); setContribAmount('') }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-green-500/10 hover:text-green-400 transition-colors">
                <PlusCircle className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(goal.id, goal.name)} disabled={deleting===goal.id}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{pct.toFixed(0)}% complete</span>
            <span>{fmtINR(remaining)} remaining</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          {goal.target_date && <span>Target: <span className="text-white font-medium">{fmtDate(goal.target_date)}</span></span>}
          {goal.monthly_contrib && <span>Monthly: <span className="text-white font-medium">{fmtINR(goal.monthly_contrib)}</span></span>}
          <span>P{goal.priority}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Financial Goals</h1><p className="text-xs text-muted-foreground mt-0.5">{activeGoals.length} active · {goals.filter(g=>g.status==='completed').length} completed</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" /> Add Goal</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Target',  value:fmtINR(totalTarget), icon:Target,      color:'text-blue-400'   },
          { label:'Total Saved',   value:fmtINR(totalSaved),  icon:TrendingUp,  color:'text-green-400'  },
          { label:'Active Goals',  value:String(activeGoals.length), icon:Target, color:'text-purple-400' },
          { label:'Overall',       value:`${overallPct}%`,    icon:CheckCircle, color:'text-amber-400'  },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="metric-label">{item.label}</p><item.icon className={cn('h-4 w-4',item.color)} /></div>
            <p className="text-xl font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
        {['active','completed','all'].map(s => (
          <TabsContent key={s} value={s} className="mt-4 space-y-3">
            {filterGoals(s).length===0
              ? <div className="glass-card rounded-xl flex flex-col items-center justify-center py-12 gap-3"><span className="text-3xl">🎯</span><p className="text-sm text-muted-foreground">No {s==='all'?'':s} goals yet</p><Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Goal</Button></div>
              : filterGoals(s).map(renderGoal)
            }
          </TabsContent>
        ))}
      </Tabs>

      {/* Contribution dialog */}
      <FormDialog open={!!contributeGoal} onClose={() => setContributeGoal(null)} title={`Add to: ${contributeGoal?.name}`} size="sm">
        <div className="space-y-4 mt-2">
          <FormField label="Amount to Add" hint={`${fmtINR((contributeGoal?.target_amount??0)-(contributeGoal?.current_amount??0))} remaining to target`}>
            <AmountInput value={contribAmount} onChange={setContribAmount} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setContributeGoal(null)} disabled={contributing}>Cancel</Button>
            <Button onClick={handleContribute} disabled={contributing}>{contributing?'Saving…':'Add Contribution'}</Button>
          </div>
        </div>
      </FormDialog>

      <AddGoalForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
