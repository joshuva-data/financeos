'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ActionResult } from './shared'

export interface AddReceivableInput {
  from_name: string
  from_type: 'individual' | 'company' | 'tenant' | 'other'
  amount: number
  due_date: string
  reason: string
  contact_phone?: string
  contact_email?: string
  notes?: string
}

export async function addReceivable(input: AddReceivableInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const today = new Date().toISOString().split('T')[0]
    const isOverdue = input.due_date < today

    const { data, error } = await supabase.from('receivables').insert({
      user_id:        user.id,
      from_name:      input.from_name.trim(),
      from_type:      input.from_type,
      amount:         input.amount,
      amount_received:0,
      due_date:       input.due_date,
      reason:         input.reason.trim(),
      status:         isOverdue ? 'overdue' : 'pending',
      contact_phone:  input.contact_phone?.trim() || null,
      contact_email:  input.contact_email?.trim() || null,
      is_rental:      false,
      reminder_sent:  false,
      notes:          input.notes?.trim() || null,
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/receivables')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add receivable')
  }
}

export interface MarkReceivedInput {
  id: string
  amount_received: number
}

export async function markReceivable(input: MarkReceivedInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data: existing } = await supabase.from('receivables')
      .select('amount').eq('id', input.id).eq('user_id', user.id).single()
    if (!existing) return fail('Not found')

    const newReceived = input.amount_received
    const status = newReceived >= existing.amount ? 'received' : 'partially_received'

    const { error } = await supabase.from('receivables').update({
      amount_received: newReceived,
      status,
    }).eq('id', input.id).eq('user_id', user.id)

    if (error) return fail(error.message)
    revalidatePath('/receivables')
    return ok(undefined)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to update receivable')
  }
}