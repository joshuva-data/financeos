'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FormDialog } from './FormDialog'
import { FormField } from './FormField'
import { AmountInput } from './AmountInput'
import { Button } from '@/components/ui/button'
import { addGoalContribution } from '@/lib/actions/goals'

interface Props {
  open: boolean
  onClose: () => void
  goalId: string
  goalName: string
  remaining: number
}

export function GoalContributionForm({ open, onClose, goalId, goalName, remaining }: Props) {
  const [amount, setAmount]           = useState('')
  const [isPending, startTransition]  = useTransition()

  const handleSubmit = () => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { toast.error('Enter a valid amount'); return }
    startTransition(async () => {
      const result = await addGoalContribution(goalId, parsed)
      if (result.ok) { toast.success(`Added ₹${parsed.toLocaleString('en-IN')} to ${goalName}`); onClose() }
      else toast.error(result.error)
    })
  }

  return (
    <FormDialog open={open} onClose={onClose} title={`Add to: ${goalName}`} size="sm">
      <div className="space-y-4 mt-2">
        <FormField label="Amount to Add" hint={`₹${remaining.toLocaleString('en-IN')} remaining to target`}>
          <AmountInput value={amount} onChange={setAmount} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Add Contribution'}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}