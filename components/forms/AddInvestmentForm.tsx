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

const INVESTMENT_TYPES = [
  { value: 'mutual_fund',     label: '📊 Mutual Fund'         },
  { value: 'stock',           label: '📈 Direct Stock'        },
  { value: 'fd',              label: '🏦 Fixed Deposit'       },
  { value: 'rd',              label: '📅 Recurring Deposit'   },
  { value: 'ppf',             label: '🏛️ PPF'                },
  { value: 'nps',             label: '🏛️ NPS'                },
  { value: 'elss',            label: '💰 ELSS'               },
  { value: 'gold',            label: '🪙 Gold'               },
  { value: 'real_estate',     label: '🏠 Real Estate'        },
  { value: 'crypto',          label: '₿ Crypto'              },
  { value: 'bonds',           label: '📜 Bonds / Debentures' },
  { value: 'etf',             label: '📉 ETF'                },
  { value: 'ulip',            label: '🛡️ ULIP'              },
  { value: 'other',           label: '💼 Other'              },
]

interface Props { open: boolean; onClose: () => void }

export function AddInvestmentForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name:              '',
    investment_type:   'mutual_fund',
    custom_type:       '',
    invested_amount:   '',
    current_value:     '',
    units:             '',
    nav:               '',
    purchase_date:     '',
    maturity_date:     '',
    expected_return:   '',
    folio_number:      '',
    demat_account:     '',
    notes:             '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Investment name is required'
    if (!form.invested_amount || parseFloat(form.invested_amount) <= 0) e.invested_amount = 'Invested amount is required'
    if (form.investment_type === 'other' && !form.custom_type.trim()) e.custom_type = 'Please specify the investment type'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const finalType = form.investment_type === 'other' ? form.custom_type.trim() : form.investment_type
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('Not logged in'); return }

        const n = (v: string) => v ? parseFloat(v) : null

        const { error } = await supabase.from('investments').insert({
          user_id:         user.id,
          name:            form.name.trim(),
          investment_type: finalType,
          invested_amount: parseFloat(form.invested_amount),
          current_value:   n(form.current_value),
          units:           n(form.units),
          nav:             n(form.nav),
          purchase_date:   form.purchase_date || null,
          maturity_date:   form.maturity_date || null,
          expected_return: n(form.expected_return),
          folio_number:    form.folio_number.trim() || null,
          demat_account:   form.demat_account.trim() || null,
          notes:           form.notes.trim() || null,
          status:          'active',
        })

        if (error) { toast.error(error.message); return }
        toast.success('Investment added!')
        onClose()
        window.location.reload()
      } catch (e) {
        toast.error('Failed to add investment')
      }
    })
  }

  const showUnits = ['mutual_fund', 'etf', 'stock', 'elss'].includes(form.investment_type)
  const showFolio = ['mutual_fund', 'elss', 'etf'].includes(form.investment_type)

  return (
    <FormDialog open={open} onClose={onClose} title="Add Investment" description="Track a new investment" size="lg">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">

          <FormField label="Investment Name" required error={errors.name} className="col-span-2">
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Axis Bluechip Fund, Reliance Industries, SBI FD" />
          </FormField>

          <FormField label="Investment Type" required>
            <Select value={form.investment_type} onValueChange={v => set('investment_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {form.investment_type === 'other' && (
            <FormField label="Specify Type" required error={errors.custom_type}>
              <Input value={form.custom_type} onChange={e => set('custom_type', e.target.value)}
                placeholder="e.g. Chit Fund, LIC Policy" autoFocus />
            </FormField>
          )}

          <FormField label="Amount Invested" required error={errors.invested_amount}>
            <AmountInput value={form.invested_amount} onChange={v => set('invested_amount', v)} />
          </FormField>

          <FormField label="Current Value" hint="Leave blank if same as invested">
            <AmountInput value={form.current_value} onChange={v => set('current_value', v)} />
          </FormField>

          {showUnits && (
            <>
              <FormField label="Units / Quantity">
                <Input type="number" step="0.001" value={form.units}
                  onChange={e => set('units', e.target.value)} placeholder="e.g. 45.234" />
              </FormField>
              <FormField label="NAV / Price per unit">
                <AmountInput value={form.nav} onChange={v => set('nav', v)} />
              </FormField>
            </>
          )}

          <FormField label="Purchase Date">
            <Input type="date" value={form.purchase_date}
              onChange={e => set('purchase_date', e.target.value)} />
          </FormField>

          <FormField label="Maturity Date (if any)">
            <Input type="date" value={form.maturity_date}
              onChange={e => set('maturity_date', e.target.value)} />
          </FormField>

          <FormField label="Expected Return (% p.a.)">
            <Input type="number" min="0" max="100" step="0.1" value={form.expected_return}
              onChange={e => set('expected_return', e.target.value)} placeholder="e.g. 12" />
          </FormField>

          {showFolio && (
            <FormField label="Folio Number">
              <Input value={form.folio_number} onChange={e => set('folio_number', e.target.value)}
                placeholder="Optional" />
            </FormField>
          )}

          {form.investment_type === 'stock' && (
            <FormField label="Demat Account">
              <Input value={form.demat_account} onChange={e => set('demat_account', e.target.value)}
                placeholder="e.g. Zerodha, Groww" />
            </FormField>
          )}

        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Optional notes…" />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Investment'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}
