'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { addTitheEntry } from '@/lib/actions/tithe'

const COMMON_RECIPIENTS = ['Church', 'Mosque', 'Temple', 'Gurdwara', 'CRY', 'HelpAge India', 'Smile Foundation', 'Other']

interface Props {
  open: boolean
  onClose: () => void
  monthlyIncome?: number
}

export function RecordGivingForm({ open, onClose, monthlyIncome }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    recipient_name: '', category: 'tithe', amount: '',
    giving_date: new Date().toISOString().split('T')[0],
    tithe_pct: '10', tax_deductible: false, is_recurring: false, notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  // Auto-calculate tithe amount from pct + monthly income
  const suggestedTithe = monthlyIncome && form.tithe_pct
    ? (monthlyIncome * parseFloat(form.tithe_pct)) / 100
    : null

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.recipient_name.trim()) e.recipient_name = 'Recipient is required'
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter a valid amount'
    if (!form.giving_date) e.giving_date = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    startTransition(async () => {
      const result = await addTitheEntry({
        recipient_name: form.recipient_name,
        category:       form.category as any,
        amount:         parseFloat(form.amount),
        giving_date:    form.giving_date,
        tithe_pct:      parseFloat(form.tithe_pct) || 0,
        tax_deductible: form.tax_deductible,
        is_recurring:   form.is_recurring,
        notes:          form.notes || undefined,
      })
      if (result.ok) { toast.success('Giving recorded 🙏'); onClose() }
      else toast.error(result.error)
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Record Giving" description="Track your tithe and charitable giving">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Recipient" required error={errors.recipient_name} className="col-span-2">
            <div className="space-y-2">
              <Input value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)}
                placeholder="Church, charity, or organisation name" />
              <div className="flex flex-wrap gap-1">
                {COMMON_RECIPIENTS.map(r => (
                  <button key={r} type="button" onClick={() => set('recipient_name', r)}
                    className="text-xs px-2 py-0.5 rounded border border-border/50 hover:bg-muted transition-colors">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </FormField>

          <FormField label="Type">
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tithe">Tithe (10%)</SelectItem>
                <SelectItem value="offering">Offering</SelectItem>
                <SelectItem value="charity">Charity</SelectItem>
                <SelectItem value="donation">Donation</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Date" required error={errors.giving_date}>
            <Input type="date" value={form.giving_date} onChange={e => set('giving_date', e.target.value)} />
          </FormField>

          {form.category === 'tithe' && (
            <FormField label="Tithe %" hint="% of income" className="col-span-2">
              <div className="flex items-center gap-2">
                <Input type="number" min="1" max="100" value={form.tithe_pct}
                  onChange={e => set('tithe_pct', e.target.value)} className="w-24" />
                {suggestedTithe && (
                  <button type="button" onClick={() => set('amount', suggestedTithe.toFixed(0))}
                    className="text-xs text-primary underline underline-offset-2">
                    Use ₹{Math.round(suggestedTithe).toLocaleString('en-IN')} (from your income)
                  </button>
                )}
              </div>
            </FormField>
          )}

          <FormField label="Amount" required error={errors.amount} className="col-span-2">
            <AmountInput value={form.amount} onChange={v => set('amount', v)} />
          </FormField>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">80G Tax Deductible</p>
              <p className="text-xs text-muted-foreground">Eligible for tax deduction under 80G</p>
            </div>
            <Switch checked={form.tax_deductible} onCheckedChange={v => set('tax_deductible', v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Recurring</p>
              <p className="text-xs text-muted-foreground">Monthly giving commitment</p>
            </div>
            <Switch checked={form.is_recurring} onCheckedChange={v => set('is_recurring', v)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Recording…' : 'Record Giving 🤲'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}