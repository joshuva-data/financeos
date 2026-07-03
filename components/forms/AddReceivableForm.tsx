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
import { addReceivable } from '@/lib/actions/receivables'

interface Props { open: boolean; onClose: () => void }

export function AddReceivableForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    from_name: '', from_type: 'individual', amount: '',
    due_date: '', reason: '', contact_phone: '', contact_email: '', notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.from_name.trim())  e.from_name = 'Name is required'
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter a valid amount'
    if (!form.due_date)          e.due_date  = 'Due date is required'
    if (!form.reason.trim())     e.reason    = 'Reason is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    startTransition(async () => {
      const result = await addReceivable({
        from_name:     form.from_name,
        from_type:     form.from_type as any,
        amount:        parseFloat(form.amount),
        due_date:      form.due_date,
        reason:        form.reason,
        contact_phone: form.contact_phone || undefined,
        contact_email: form.contact_email || undefined,
        notes:         form.notes || undefined,
      })
      if (result.ok) { toast.success('Receivable added'); onClose() }
      else toast.error(result.error)
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Add Receivable" description="Record money someone owes you">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From (Name)" required error={errors.from_name} className="col-span-2">
            <Input value={form.from_name} onChange={e => set('from_name', e.target.value)}
              placeholder="Person or company name" />
          </FormField>

          <FormField label="Type">
            <Select value={form.from_type} onValueChange={v => set('from_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Amount" required error={errors.amount}>
            <AmountInput value={form.amount} onChange={v => set('amount', v)} />
          </FormField>

          <FormField label="Due Date" required error={errors.due_date} className="col-span-2">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </FormField>

          <FormField label="Reason / Description" required error={errors.reason} className="col-span-2">
            <Input value={form.reason} onChange={e => set('reason', e.target.value)}
              placeholder="e.g. Loan, Rent, Project payment" />
          </FormField>

          <FormField label="Phone">
            <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
              placeholder="Optional" type="tel" />
          </FormField>

          <FormField label="Email">
            <Input value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
              placeholder="Optional" type="email" />
          </FormField>
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional…" />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Receivable'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}