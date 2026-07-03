'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface Props { open: boolean; onClose: () => void; financialYear: string }

export function AddCorporateBenefitsForm({ open, onClose, financialYear }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    employer_name: '', uan_number: '',
    epf_employee_contrib: '', epf_employer_contrib: '', epf_balance: '',
    annual_bonus: '0', variable_pay: '0', joining_bonus: '0', retention_bonus: '0',
    corporate_health_cover: '', corporate_life_cover: '',
    learning_budget: '0', learning_used: '0',
    total_leaves: '', leaves_taken: '', notice_period_days: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.employer_name.trim()) e.employer_name = 'Employer name required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('Not logged in'); return }

        const n = (v: string) => v ? parseFloat(v) : 0
        const ni = (v: string) => v ? parseInt(v) : null

        const { error } = await supabase.from('corporate_benefits').upsert({
          user_id:               user.id,
          financial_year:        financialYear,
          employer_name:         form.employer_name.trim(),
          uan_number:            form.uan_number.trim() || null,
          epf_employee_contrib:  n(form.epf_employee_contrib),
          epf_employer_contrib:  n(form.epf_employer_contrib),
          epf_balance:           n(form.epf_balance),
          annual_bonus:          n(form.annual_bonus),
          variable_pay:          n(form.variable_pay),
          joining_bonus:         n(form.joining_bonus),
          retention_bonus:       n(form.retention_bonus),
          corporate_health_cover:form.corporate_health_cover ? n(form.corporate_health_cover) : null,
          corporate_life_cover:  form.corporate_life_cover ? n(form.corporate_life_cover) : null,
          learning_budget:       n(form.learning_budget),
          learning_used:         n(form.learning_used),
          total_leaves:          ni(form.total_leaves),
          leaves_taken:          ni(form.leaves_taken),
          notice_period_days:    ni(form.notice_period_days),
        }, { onConflict: 'user_id,financial_year' })

        if (error) { toast.error(error.message); return }
        toast.success('Corporate benefits saved!')
        onClose()
        window.location.reload()
      } catch (e) { toast.error('Failed to save benefits') }
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Set Up Corporate Benefits" description={`FY ${financialYear}`} size="lg">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Employer Name" required error={errors.employer_name} className="col-span-2">
            <Input value={form.employer_name} onChange={e => set('employer_name', e.target.value)}
              placeholder="e.g. Amazon India, Infosys, TCS" />
          </FormField>

          <FormField label="UAN Number">
            <Input value={form.uan_number} onChange={e => set('uan_number', e.target.value)}
              placeholder="12-digit UAN" maxLength={12} />
          </FormField>

          <FormField label="EPF Balance">
            <AmountInput value={form.epf_balance} onChange={v => set('epf_balance', v)} />
          </FormField>

          <FormField label="Employee EPF Contribution">
            <AmountInput value={form.epf_employee_contrib} onChange={v => set('epf_employee_contrib', v)} />
          </FormField>

          <FormField label="Employer EPF Contribution">
            <AmountInput value={form.epf_employer_contrib} onChange={v => set('epf_employer_contrib', v)} />
          </FormField>

          <FormField label="Annual Bonus">
            <AmountInput value={form.annual_bonus} onChange={v => set('annual_bonus', v)} />
          </FormField>

          <FormField label="Variable Pay">
            <AmountInput value={form.variable_pay} onChange={v => set('variable_pay', v)} />
          </FormField>

          <FormField label="Joining Bonus">
            <AmountInput value={form.joining_bonus} onChange={v => set('joining_bonus', v)} />
          </FormField>

          <FormField label="Retention Bonus">
            <AmountInput value={form.retention_bonus} onChange={v => set('retention_bonus', v)} />
          </FormField>

          <FormField label="Corporate Health Cover">
            <AmountInput value={form.corporate_health_cover} onChange={v => set('corporate_health_cover', v)} />
          </FormField>

          <FormField label="Corporate Life Cover">
            <AmountInput value={form.corporate_life_cover} onChange={v => set('corporate_life_cover', v)} />
          </FormField>

          <FormField label="L&D Budget">
            <AmountInput value={form.learning_budget} onChange={v => set('learning_budget', v)} />
          </FormField>

          <FormField label="L&D Used So Far">
            <AmountInput value={form.learning_used} onChange={v => set('learning_used', v)} />
          </FormField>

          <FormField label="Total Annual Leaves">
            <Input type="number" value={form.total_leaves} onChange={e => set('total_leaves', e.target.value)} placeholder="e.g. 18" />
          </FormField>

          <FormField label="Leaves Taken">
            <Input type="number" value={form.leaves_taken} onChange={e => set('leaves_taken', e.target.value)} placeholder="e.g. 5" />
          </FormField>

          <FormField label="Notice Period (days)" className="col-span-2">
            <Input type="number" value={form.notice_period_days} onChange={e => set('notice_period_days', e.target.value)} placeholder="e.g. 60" />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Benefits'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}