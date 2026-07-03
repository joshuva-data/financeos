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
import { Switch } from '@/components/ui/switch'
import { addAccount } from '@/lib/actions/accounts'

const ACCOUNT_TYPES = [
  { value: 'savings',     label: 'Savings Account'   },
  { value: 'current',     label: 'Current Account'   },
  { value: 'salary',      label: 'Salary Account'    },
  { value: 'fd',          label: 'Fixed Deposit'      },
  { value: 'rd',          label: 'Recurring Deposit'  },
  { value: 'ppf',         label: 'PPF'                },
  { value: 'nps',         label: 'NPS'                },
  { value: 'demat',       label: 'Demat Account'      },
  { value: 'wallet',      label: 'Digital Wallet'     },
  { value: 'cash',        label: 'Cash'               },
  { value: 'credit_card', label: 'Credit Card'        },
  { value: 'loan',        label: 'Loan Account'       },
  { value: 'other',       label: 'Other'              },
]

const BANKS = [
  'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'IndusInd Bank',
  'Yes Bank', 'Federal Bank', 'IDFC First Bank', 'RBL Bank',
  'AU Small Finance', 'Paytm Payments Bank', 'Airtel Payments Bank',
  'Jupiter', 'Fi Money', 'Other',
]

interface Props { open: boolean; onClose: () => void }

export function AddAccountForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name:          '',
    account_type:  'savings',
    bank_name:     '',
    custom_bank:   '',
    account_number:'',
    ifsc_code:     '',
    balance:       '',
    credit_limit:  '',
    interest_rate: '',
    is_primary:    false,
    notes:         '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())        e.name         = 'Account name is required'
    if (!form.account_type)       e.account_type = 'Account type is required'
    if (form.balance === '')      e.balance      = 'Balance is required'
    if (isNaN(parseFloat(form.balance))) e.balance = 'Enter a valid amount'
    if (form.bank_name === 'Other' && !form.custom_bank.trim()) {
      e.custom_bank = 'Please specify the bank name'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const finalBank = form.bank_name === 'Other' ? form.custom_bank.trim() : form.bank_name
    startTransition(async () => {
      const result = await addAccount({
        name:           form.name,
        account_type:   form.account_type,
        bank_name:      finalBank || undefined,
        account_number: form.account_number || undefined,
        ifsc_code:      form.ifsc_code || undefined,
        balance:        parseFloat(form.balance),
        credit_limit:   form.credit_limit ? parseFloat(form.credit_limit) : undefined,
        interest_rate:  form.interest_rate ? parseFloat(form.interest_rate) : undefined,
        is_primary:     form.is_primary,
        notes:          form.notes || undefined,
      })
      if (result.ok) {
        toast.success('Account added successfully')
        onClose()
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  const isCredit = form.account_type === 'credit_card'
  const isLoan   = form.account_type === 'loan'
  const isFD     = ['fd', 'rd', 'ppf', 'nps'].includes(form.account_type)

  return (
    <FormDialog open={open} onClose={onClose} title="Add Account" description="Link a new bank, wallet, or investment account">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">

          <FormField label="Account Name" required error={errors.name} className="col-span-2">
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. SBI Savings, HDFC Credit" />
          </FormField>

          <FormField label="Account Type" required error={errors.account_type}>
            <Select value={form.account_type} onValueChange={v => set('account_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Bank / Institution">
            <Select value={form.bank_name} onValueChange={v => set('bank_name', v)}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {form.bank_name === 'Other' && (
            <FormField label="Specify Bank Name" required error={errors.custom_bank} className="col-span-2">
              <Input
                value={form.custom_bank}
                onChange={e => set('custom_bank', e.target.value)}
                placeholder="Enter the bank or institution name"
                autoFocus
              />
            </FormField>
          )}

          <FormField label={isCredit ? 'Outstanding Balance' : 'Current Balance'} required error={errors.balance}>
            <AmountInput value={form.balance} onChange={v => set('balance', v)} />
          </FormField>

          {isCredit && (
            <FormField label="Credit Limit">
              <AmountInput value={form.credit_limit} onChange={v => set('credit_limit', v)} />
            </FormField>
          )}

          {(isLoan || isFD) && (
            <FormField label="Interest Rate (% p.a.)">
              <Input type="number" min="0" max="100" step="0.01"
                value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)}
                placeholder="e.g. 7.5" />
            </FormField>
          )}

          {!['wallet', 'cash', 'ppf', 'nps'].includes(form.account_type) && (
            <FormField label="Account Number">
              <Input value={form.account_number} onChange={e => set('account_number', e.target.value)}
                placeholder="Last 4 digits or full" maxLength={20} />
            </FormField>
          )}

          {['savings', 'current', 'salary'].includes(form.account_type) && (
            <FormField label="IFSC Code">
              <Input value={form.ifsc_code}
                onChange={e => set('ifsc_code', e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234" maxLength={11} />
            </FormField>
          )}

        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Primary Account</p>
            <p className="text-xs text-muted-foreground">Used as default for expenses</p>
          </div>
          <Switch checked={form.is_primary} onCheckedChange={v => set('is_primary', v)} />
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes…" rows={2} />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Account'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}