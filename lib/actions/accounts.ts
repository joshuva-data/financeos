'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ActionResult } from './shared'

export interface AddAccountInput {
  name: string
  account_type: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  balance: number
  credit_limit?: number
  interest_rate?: number
  is_primary?: boolean
  notes?: string
}

export async function addAccount(input: AddAccountInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data, error } = await supabase.from('accounts').insert({
      user_id:       user.id,
      name:          input.name.trim(),
      account_type:  input.account_type,
      bank_name:     input.bank_name?.trim() || null,
      account_number:input.account_number?.trim() || null,
      ifsc_code:     input.ifsc_code?.trim().toUpperCase() || null,
      balance:       input.balance,
      credit_limit:  input.credit_limit || null,
      interest_rate: input.interest_rate || null,
      is_primary:    input.is_primary ?? false,
      status:        'active',
      notes:         input.notes?.trim() || null,
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/accounts')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add account')
  }
}