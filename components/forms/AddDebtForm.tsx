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
import { addDebt } from '@/lib/actions/debt'

const DEBT_TYPES = [
  { value: 'home_loan',               label: '🏠 Home Loan'               },
  { value: 'vehicle_loan',            label: '🚗 Vehicle Loan'            },
  { value: 'personal_loan',           label: '💼 Personal Loan'           },
  { value: 'education_loan',          label: '🎓 Education Loan'          },
  { value: 'gold_loan',               label: '🪙 Gold Loan'               },
  { value: 'credit_card_outstanding', label: '💳 Credit Card Outstanding' },
  { value: 'bnpl',                    label: '📱 Buy Now Pay Later'       },
  { value: 'friend_family',           label: '🤝 Friend / Family'         },
  { value: 'other',                   label: '📄 Other'                   },
]

interface Props { open: boolean; onClose: () => void }

export function AddDebtForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    debt_type:          'personal_loan',
    custom_debt_type:   '',
    lender_name:        '',
    loan_account_no:    '',
    original_amount:    '',
    outstanding:        '',
    interest_rate:      '',
    rate_type:          'fixed',
    emi_amount:         '',
    tenure_months:      '',
    disbursement_date:  '',
    emi_start_date:     '',
    next_emi_date:      '',
    collateral:         '',
    notes:              '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.lender_name.trim()) e.lender_name = 'Lender name is required'
    if (!form.original_amount || parseFloat(form.original_amount) <= 0) e.original_amount = 'Original amount required'
    if (!form.outstanding || parseFloat(form.outstanding) < 0) e.outstanding = 'Outstanding amount required'
    if (!form.interest_rate || parseFloat(form.interest_rate) < 0) e.interest_rate = 'Interest rate required'
    if (form.debt_type === 'other' && !form.custom_debt_type.trim()) {
      e.custom_debt_type = 'Please specify the loan type'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const finalType = form.debt_type === 'other' ? form.custom_debt_type.trim() : form.debt_type
    startTransition(async () => {
      const result = await addDebt({
        debt_type:         finalType,
        lender_name:       form.lender_name,
        loan_account_no:   form.loan_account_no || undefined,
        original_amount:   parseFloat(form.original_amount),
        outstanding:       parseFloat(form.outstanding),
        interest_rate:     parseFloat(form.interest_rate),
        rate_type:         form.rate_type as 'fixed' | 'floating',
        emi_amount:        form.emi_amount ? parseFloat(form.emi_amount) : undefined,
        tenure_months:     form.tenure_months ? parseInt(form.tenure_months) : undefined,
        disbursement_date: form.disbursement_date || undefined,
        emi_start_date:    form.emi_start_date || undefined,
        next_emi_date:     form.next_emi_date || undefined,
        collateral:        form.collateral || undefined,
        notes:             form.notes || undefined,
      })
      if (result.ok) {
        toast.success('Loan added')
        onClose()
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Add Loan" description="Track a new loan or debt" size="lg">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">

          <FormField label="Loan Type" required>
            <Select value={form.debt_type} onValueChange={v => set('debt_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEBT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Lender / Bank" required error={errors.lender_name}>
            <Input value={form.lender_name} onChange={e => set('lender_name', e.target.value)}
              placeholder="e.g. HDFC Bank, SBI, Ramesh" />
          </FormField>

          {form.debt_type === 'other' && (
            <FormField label="Specify Loan Type" required error={errors.custom_debt_type} className="col-span-2">
              <Input
                value={form.custom_debt_type}
                onChange={e => set('custom_debt_type', e.target.value)}
                placeholder="e.g. Chit Fund, Employer Advance, Mortgage"
                autoFocus
              />
            </FormField>
          )}

          <FormField label="Original Loan Amount" required error={errors.original_amount}>
            <AmountInput value={form.original_amount} onChange={v => set('original_amount', v)} />
          </FormField>

          <FormField label="Outstanding Balance" required error={errors.outstanding}>
            <AmountInput value={form.outstanding} onChange={v => set('outstanding', v)} />
          </FormField>

          <FormField label="Interest Rate (% p.a.)" required error={errors.interest_rate}>
            <Input type="number" min="0" max="100" step="0.01"
              value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)}
              placeholder="e.g. 8.5" />
          </FormField>

          <FormField label="Rate Type">
            <Select value={form.rate_type} onValueChange={v => set('rate_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="floating">Floating / MCLR</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Monthly EMI">
            <AmountInput value={form.emi_amount} onChange={v => set('emi_amount', v)} />
          </FormField>

          <FormField label="Tenure (months)">
            <Input type="number" min="1" value={form.tenure_months}
              onChange={e => set('tenure_months', e.target.value)} placeholder="e.g. 240" />
          </FormField>

          <FormField label="Disbursement Date">
            <Input type="date" value={form.disbursement_date}
              onChange={e => set('disbursement_date', e.target.value)} />
          </FormField>

          <FormField label="Next EMI Date">
            <Input type="date" value={form.next_emi_date}
              onChange={e => set('next_emi_date', e.target.value)} />
          </FormField>

          <FormField label="Loan Account No.">
            <Input value={form.loan_account_no}
              onChange={e => set('loan_account_no', e.target.value)} placeholder="Optional" />
          </FormField>

          <FormField label="Collateral / Security">
            <Input value={form.collateral}
              onChange={e => set('collateral', e.target.value)}
              placeholder="e.g. Property, Vehicle" />
          </FormField>

        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Optional notes…" />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Loan'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}