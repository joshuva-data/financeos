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
import { createClient } from '@/lib/supabase/client'

interface Props { open: boolean; onClose: () => void }

export function AddInsurancePolicyForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    policy_name: '', insurance_type: 'health', insurer_name: '',
    policy_number: '', sum_assured: '', annual_premium: '',
    premium_frequency: 'annual', start_date: '', renewal_date: '',
    nominee_name: '', agent_name: '', agent_phone: '', notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.policy_name.trim())  e.policy_name  = 'Policy name required'
    if (!form.insurer_name.trim()) e.insurer_name = 'Insurer name required'
    if (!form.annual_premium || parseFloat(form.annual_premium) <= 0) e.annual_premium = 'Enter premium amount'
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

        const { error } = await supabase.from('insurance_policies').insert({
          user_id:            user.id,
          policy_name:        form.policy_name.trim(),
          insurance_type:     form.insurance_type,
          insurer_name:       form.insurer_name.trim(),
          policy_number:      form.policy_number.trim() || null,
          sum_assured:        form.sum_assured ? parseFloat(form.sum_assured) : null,
          annual_premium:     parseFloat(form.annual_premium),
          premium_frequency:  form.premium_frequency,
          start_date:         form.start_date || null,
          renewal_date:       form.renewal_date || null,
          nominee_name:       form.nominee_name.trim() || null,
          agent_name:         form.agent_name.trim() || null,
          agent_phone:        form.agent_phone.trim() || null,
          notes:              form.notes.trim() || null,
          status:             'active',
        })
        if (error) { toast.error(error.message); return }
        toast.success('Policy added!')
        onClose()
        window.location.reload()
      } catch (e) { toast.error('Failed to add policy') }
    })
  }

  const INSURERS = [
    'LIC', 'HDFC Life', 'ICICI Prudential', 'SBI Life', 'Max Life',
    'Bajaj Allianz Life', 'Tata AIA', 'Star Health', 'Niva Bupa',
    'Aditya Birla Health', 'Care Health', 'ICICI Lombard', 'New India Assurance',
    'National Insurance', 'Oriental Insurance', 'Bajaj Allianz General', 'Other',
  ]

  return (
    <FormDialog open={open} onClose={onClose} title="Add Insurance Policy" size="lg">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Policy Name" required error={errors.policy_name} className="col-span-2">
            <Input value={form.policy_name} onChange={e => set('policy_name', e.target.value)}
              placeholder="e.g. Health Plus Policy, Term Plan 2024" />
          </FormField>

          <FormField label="Insurance Type" required>
            <Select value={form.insurance_type} onValueChange={v => set('insurance_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="health">🏥 Health Insurance</SelectItem>
                <SelectItem value="life_term">🛡️ Life — Term Plan</SelectItem>
                <SelectItem value="life_ulip">📈 Life — ULIP</SelectItem>
                <SelectItem value="life_endowment">💰 Life — Endowment</SelectItem>
                <SelectItem value="vehicle">🚗 Vehicle Insurance</SelectItem>
                <SelectItem value="home">🏠 Home Insurance</SelectItem>
                <SelectItem value="travel">✈️ Travel Insurance</SelectItem>
                <SelectItem value="accident">⚡ Personal Accident</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Insurer / Company" required error={errors.insurer_name}>
            <Select value={form.insurer_name} onValueChange={v => set('insurer_name', v)}>
              <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
              <SelectContent>
                {INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {form.insurer_name === 'Other' && (
            <FormField label="Specify Insurer" required className="col-span-2">
              <Input onChange={e => set('insurer_name', e.target.value)} placeholder="Enter insurer name" />
            </FormField>
          )}

          <FormField label="Sum Assured / Coverage">
            <AmountInput value={form.sum_assured} onChange={v => set('sum_assured', v)} />
          </FormField>

          <FormField label="Annual Premium" required error={errors.annual_premium}>
            <AmountInput value={form.annual_premium} onChange={v => set('annual_premium', v)} />
          </FormField>

          <FormField label="Premium Frequency">
            <Select value={form.premium_frequency} onValueChange={v => set('premium_frequency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="half_yearly">Half Yearly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="single">Single Premium</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Policy Number">
            <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} placeholder="Optional" />
          </FormField>

          <FormField label="Start Date">
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </FormField>

          <FormField label="Renewal Date">
            <Input type="date" value={form.renewal_date} onChange={e => set('renewal_date', e.target.value)} />
          </FormField>

          <FormField label="Nominee Name">
            <Input value={form.nominee_name} onChange={e => set('nominee_name', e.target.value)} placeholder="e.g. Spouse, Parent" />
          </FormField>

          <FormField label="Agent Name">
            <Input value={form.agent_name} onChange={e => set('agent_name', e.target.value)} placeholder="Optional" />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Policy'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}