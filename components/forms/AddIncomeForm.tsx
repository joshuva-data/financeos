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
import { addIncomeEntry } from '@/lib/actions/income'

const INCOME_TYPES = [
  { value: 'salary',        label: 'Salary'         },
  { value: 'freelance',     label: 'Freelance'      },
  { value: 'rental',        label: 'Rental'         },
  { value: 'dividend',      label: 'Dividend'       },
  { value: 'interest',      label: 'Interest'       },
  { value: 'bonus',         label: 'Bonus'          },
  { value: 'capital_gains', label: 'Capital Gains'  },
  { value: 'business',      label: 'Business'       },
  { value: 'gift',          label: 'Gift'           },
  { value: 'other',         label: 'Other'          },
]

const MONTHS = [
  { value: 4,  label: 'April'     }, { value: 5,  label: 'May'       },
  { value: 6,  label: 'June'      }, { value: 7,  label: 'July'      },
  { value: 8,  label: 'August'    }, { value: 9,  label: 'September' },
  { value: 10, label: 'October'   }, { value: 11, label: 'November'  },
  { value: 12, label: 'December'  }, { value: 1,  label: 'January'   },
  { value: 2,  label: 'February'  }, { value: 3,  label: 'March'     },
]

interface Props {
  open: boolean
  onClose: () => void
  accounts: { id: string; name: string }[]
  financialYear: string
}

export function AddIncomeForm({ open, onClose, accounts, financialYear }: Props) {
  const [isPending, startTransition] = useTransition()
  const now = new Date()
  const [form, setForm] = useState({
    source_name: '', income_type: 'salary', gross_amount: '', tds_deducted: '0',
    month: now.getMonth() + 1, account_id: accounts[0]?.id ?? '',
    is_taxable: true, notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const netAmount = (parseFloat(form.gross_amount) || 0) - (parseFloat(form.tds_deducted) || 0)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.source_name.trim()) e.source_name  = 'Source name is required'
    if (!form.gross_amount || parseFloat(form.gross_amount) <= 0) e.gross_amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    startTransition(async () => {
      const result = await addIncomeEntry({
        source_name:    form.source_name,
        income_type:    form.income_type,
        gross_amount:   parseFloat(form.gross_amount),
        tds_deducted:   parseFloat(form.tds_deducted) || 0,
        month:          form.month,
        financial_year: financialYear,
        account_id:     form.account_id || undefined,
        is_taxable:     form.is_taxable,
        notes:          form.notes || undefined,
      })
      if (result.ok) { toast.success('Income entry added'); onClose() }
      else toast.error(result.error)
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Add Income" description={`Recording for FY ${financialYear}`}>
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source Name" required error={errors.source_name} className="col-span-2">
            <Input value={form.source_name} onChange={e => set('source_name', e.target.value)}
              placeholder="e.g. Amazon, Freelance Client, HDFC FD" />
          </FormField>

          <FormField label="Income Type" required>
            <Select value={form.income_type} onValueChange={v => set('income_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Month" required>
            <Select value={String(form.month)} onValueChange={v => set('month', parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Gross Amount" required error={errors.gross_amount}>
            <AmountInput value={form.gross_amount} onChange={v => set('gross_amount', v)} />
          </FormField>

          <FormField label="TDS Deducted" hint="Enter 0 if no TDS">
            <AmountInput value={form.tds_deducted} onChange={v => set('tds_deducted', v)} />
          </FormField>

          <FormField label="Net Amount (auto)" className="col-span-2">
            <div className="h-9 px-3 rounded-md border border-border/50 bg-muted/50 flex items-center">
              <span className="text-sm font-semibold text-positive">
                ₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </FormField>

          <FormField label="Credited to Account">
            <Select value={form.account_id} onValueChange={v => set('account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Taxable Income</p>
            <p className="text-xs text-muted-foreground">Include in tax calculations</p>
          </div>
          <Switch checked={form.is_taxable} onCheckedChange={v => set('is_taxable', v)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Add Income'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}