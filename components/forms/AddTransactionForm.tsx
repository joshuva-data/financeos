'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addTransaction } from '@/lib/actions/transactions'

const EXPENSE_CATS = [
  'Housing', 'Food & Dining', 'Transport', 'Utilities', 'Insurance',
  'Health & Medical', 'Entertainment', 'Shopping', 'Education',
  'Personal Care', 'Gifts & Donations', 'EMI / Loan Repayment',
  'Investment', 'Fuel', 'Clothing', 'Subscriptions', 'Others',
]

interface Props {
  open: boolean
  onClose: () => void
  accounts: { id: string; name: string }[]
  defaultType?: 'expense' | 'income'
}

export function AddTransactionForm({ open, onClose, accounts, defaultType = 'expense' }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    account_id:  accounts[0]?.id ?? '',
    amount:      '',
    category:    '',
    otherCategory: '',
    description: '',
    merchant:    '',
    txn_date:    new Date().toISOString().split('T')[0],
    notes:       '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.account_id)                               e.account_id = 'Select an account'
    if (!form.amount || parseFloat(form.amount) <= 0)  e.amount     = 'Enter a valid amount'
    if (!form.category)                                 e.category   = 'Select a category'
    if (form.category === 'Others' && !form.otherCategory.trim()) e.otherCategory = 'Please specify'
    if (!form.txn_date)                                 e.txn_date   = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const finalCategory = form.category === 'Others' ? form.otherCategory.trim() : form.category
    startTransition(async () => {
      const result = await addTransaction({
        account_id:  form.account_id,
        txn_type:    defaultType,
        direction:   defaultType === 'expense' ? 'debit' : 'credit',
        amount:      parseFloat(form.amount),
        category:    finalCategory,
        description: form.description || undefined,
        merchant:    form.merchant || undefined,
        txn_date:    form.txn_date,
        notes:       form.notes || undefined,
        is_tax_relevant: false,
      })
      if (result.ok) {
        toast.success(defaultType === 'expense' ? 'Expense recorded' : 'Income recorded')
        onClose()
        setForm({ account_id: accounts[0]?.id ?? '', amount: '', category: '', otherCategory: '', description: '', merchant: '', txn_date: new Date().toISOString().split('T')[0], notes: '' })
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <FormDialog open={open} onClose={onClose}
      title={defaultType === 'expense' ? 'Add Expense' : 'Add Income'}
      description={defaultType === 'expense' ? 'Record a new expense' : 'Record a new income'}
      size="md">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount" required error={errors.amount} className="col-span-2">
            <AmountInput value={form.amount} onChange={v => set('amount', v)} />
          </FormField>

          <FormField label="Account" required error={errors.account_id}>
            <Select value={form.account_id} onValueChange={v => set('account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.length === 0
                  ? <SelectItem value="none" disabled>No accounts yet</SelectItem>
                  : accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Date" required error={errors.txn_date}>
            <Input type="date" value={form.txn_date} onChange={e => set('txn_date', e.target.value)} />
          </FormField>

          <FormField label="Category" required error={errors.category} className="col-span-2">
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {form.category === 'Others' && (
            <FormField label="Specify Category" required error={errors.otherCategory} className="col-span-2">
              <Input value={form.otherCategory} onChange={e => set('otherCategory', e.target.value)}
                placeholder="e.g. Pet expenses, Hobby supplies" autoFocus />
            </FormField>
          )}

          <FormField label="Merchant / Payee">
            <Input value={form.merchant} onChange={e => set('merchant', e.target.value)}
              placeholder="e.g. Swiggy, Amazon, BSNL" />
          </FormField>

          <FormField label="Description">
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional note" />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : defaultType === 'expense' ? 'Add Expense' : 'Add Income'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}