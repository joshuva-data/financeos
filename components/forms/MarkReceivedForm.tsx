'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { markReceivable } from '@/lib/actions/receivables'

interface Props {
  open: boolean
  onClose: () => void
  receivableId: string
  fromName: string
  balanceDue: number
}

export function MarkReceivedForm({ open, onClose, receivableId, fromName, balanceDue }: Props) {
  const [amount, setAmount]          = useState(String(balanceDue))
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { toast.error('Enter a valid amount'); return }
    startTransition(async () => {
      const result = await markReceivable({ id: receivableId, amount_received: parsed })
      if (result.ok) {
        toast.success(parsed >= balanceDue ? `Fully received from ${fromName}` : `Partial payment recorded`)
        onClose()
      } else toast.error(result.error)
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title={`Mark Received — ${fromName}`} size="sm">
      <div className="space-y-4 mt-2">
        <FormField label="Amount Received" hint={`Full amount: ₹${balanceDue.toLocaleString('en-IN')}`}>
          <AmountInput value={amount} onChange={setAmount} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Mark Received'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}