'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, getCurrentFY, type ActionResult } from './shared'

export interface AddTitheInput {
  recipient_name: string
  category: 'tithe' | 'offering' | 'charity' | 'donation' | 'other'
  amount: number
  giving_date: string
  tithe_pct?: number
  tax_deductible?: boolean
  is_recurring?: boolean
  notes?: string
}

export async function addTitheEntry(input: AddTitheInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data, error } = await supabase.from('tithe_entries').insert({
      user_id:         user.id,
      recipient_name:  input.recipient_name.trim(),
      category:        input.category,
      amount:          input.amount,
      giving_date:     input.giving_date,
      tithe_pct:       input.tithe_pct ?? 0,
      tax_deductible:  input.tax_deductible ?? false,
      is_recurring:    input.is_recurring ?? false,
      financial_year:  getCurrentFY(),
      notes:           input.notes?.trim() || null,
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/tithe')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to record giving')
  }
}