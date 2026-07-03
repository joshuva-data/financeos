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
import { createClient } from '@/lib/supabase/client'

interface Props { open: boolean; onClose: () => void }

export function AddRentalPropertyForm({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    property_name: '', property_type: 'apartment', address: '',
    city: '', state: '', monthly_rent: '', current_value: '',
    purchase_price: '', purchase_date: '', is_occupied: false, notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.property_name.trim()) e.property_name = 'Property name required'
    if (!form.monthly_rent || parseFloat(form.monthly_rent) <= 0) e.monthly_rent = 'Enter monthly rent'
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

        const { error } = await supabase.from('rental_properties').insert({
          user_id:        user.id,
          property_name:  form.property_name.trim(),
          property_type:  form.property_type,
          address:        form.address.trim() || null,
          city:           form.city.trim() || null,
          state:          form.state.trim() || null,
          monthly_rent:   parseFloat(form.monthly_rent),
          current_value:  form.current_value ? parseFloat(form.current_value) : null,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          purchase_date:  form.purchase_date || null,
          is_occupied:    form.is_occupied,
          notes:          form.notes.trim() || null,
        })
        if (error) { toast.error(error.message); return }
        toast.success('Property added!')
        onClose()
        window.location.reload()
      } catch (e) { toast.error('Failed to add property') }
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Add Rental Property" size="lg">
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Property Name" required error={errors.property_name} className="col-span-2">
            <Input value={form.property_name} onChange={e => set('property_name', e.target.value)}
              placeholder="e.g. Anna Nagar Flat, Ambattur Plot" />
          </FormField>

          <FormField label="Property Type">
            <Select value={form.property_type} onValueChange={v => set('property_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment / Flat</SelectItem>
                <SelectItem value="house">Independent House</SelectItem>
                <SelectItem value="plot">Plot / Land</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Monthly Rent" required error={errors.monthly_rent}>
            <AmountInput value={form.monthly_rent} onChange={v => set('monthly_rent', v)} />
          </FormField>

          <FormField label="Address" className="col-span-2">
            <Input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Street address" />
          </FormField>

          <FormField label="City">
            <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Chennai" />
          </FormField>

          <FormField label="State">
            <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="Tamil Nadu" />
          </FormField>

          <FormField label="Current Market Value">
            <AmountInput value={form.current_value} onChange={v => set('current_value', v)} />
          </FormField>

          <FormField label="Purchase Price">
            <AmountInput value={form.purchase_price} onChange={v => set('purchase_price', v)} />
          </FormField>

          <FormField label="Purchase Date" className="col-span-2">
            <Input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </FormField>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Currently Occupied</p>
            <p className="text-xs text-muted-foreground">Is there a tenant living here?</p>
          </div>
          <Switch checked={form.is_occupied} onCheckedChange={v => set('is_occupied', v)} />
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional…" />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Property'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}