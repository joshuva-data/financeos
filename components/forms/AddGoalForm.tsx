'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addGoal } from '@/lib/actions/goals'

const GOAL_ICONS = ['🏠','🚗','✈️','💍','🎓','🏋️','💻','📱','🏦','👶','🌴','🏥','💰','🎯','⚡']
const GOAL_CATEGORIES = ['Property', 'Vehicle', 'Travel', 'Education', 'Emergency Fund', 'Investment', 'Wedding', 'Retirement', 'Business', 'Other']

interface Props { open: boolean; onClose: () => void }

export function AddGoalForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '', description: '', target_amount: '', current_amount: '0',
    target_date: '', monthly_contrib: '', category: '', icon: '🎯', priority: '3',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())         e.name          = 'Goal name is required'
    if (!form.target_amount || parseFloat(form.target_amount) <= 0) e.target_amount = 'Target amount required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    startTransition(async () => {
      const result = await addGoal({
        name:           form.name,
        description:    form.description || undefined,
        target_amount:  parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        target_date:    form.target_date || undefined,
        monthly_contrib:form.monthly_contrib ? parseFloat(form.monthly_contrib) : undefined,
        category:       form.category || undefined,
        icon:           form.icon,
        priority:       parseInt(form.priority),
      })
      if (result.ok) { toast.success('Goal created!'); onClose() }
      else toast.error(result.error)
    })
  }

  const pct = form.target_amount && parseFloat(form.target_amount) > 0
    ? Math.min((parseFloat(form.current_amount || '0') / parseFloat(form.target_amount)) * 100, 100)
    : 0

  return (
    <FormDialog open={open} onClose={onClose} title="Add Financial Goal">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Goal Name" required error={errors.name} className="col-span-2">
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Emergency Fund, Goa Trip, MacBook" />
          </FormField>

          <FormField label="Category">
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {GOAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Priority">
            <Select value={form.priority} onValueChange={v => set('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">🔴 P1 — Critical</SelectItem>
                <SelectItem value="2">🟠 P2 — High</SelectItem>
                <SelectItem value="3">🟡 P3 — Medium</SelectItem>
                <SelectItem value="4">🔵 P4 — Low</SelectItem>
                <SelectItem value="5">⚪ P5 — Someday</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Target Amount" required error={errors.target_amount}>
            <AmountInput value={form.target_amount} onChange={v => set('target_amount', v)} />
          </FormField>

          <FormField label="Already Saved">
            <AmountInput value={form.current_amount} onChange={v => set('current_amount', v)} />
          </FormField>

          <FormField label="Target Date">
            <Input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
          </FormField>

          <FormField label="Monthly Contribution">
            <AmountInput value={form.monthly_contrib} onChange={v => set('monthly_contrib', v)} />
          </FormField>
        </div>

        {/* Icon picker */}
        <FormField label="Icon">
          <div className="flex flex-wrap gap-2 p-2 border border-border/50 rounded-lg bg-muted/30">
            {GOAL_ICONS.map(icon => (
              <button key={icon} type="button" onClick={() => set('icon', icon)}
                className={`text-xl p-1 rounded-lg transition-colors ${form.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}>
                {icon}
              </button>
            ))}
          </div>
        </FormField>

        {pct > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Starting at {pct.toFixed(0)}% complete</p>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-positive transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}