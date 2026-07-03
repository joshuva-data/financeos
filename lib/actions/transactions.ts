'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ActionResult } from './shared'

export interface AddTransactionInput {
  account_id: string
  txn_type: string
  direction: 'credit' | 'debit'
  amount: number
  category: string
  subcategory?: string
  description?: string
  merchant?: string
  txn_date: string
  notes?: string
  is_tax_relevant?: boolean
}

export async function addTransaction(input: AddTransactionInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data, error } = await supabase.from('transactions').insert({
      user_id:         user.id,
      account_id:      input.account_id,
      txn_type:        input.txn_type,
      direction:       input.direction,
      amount:          input.amount,
      category:        input.category,
      subcategory:     input.subcategory?.trim() || null,
      description:     input.description?.trim() || null,
      merchant:        input.merchant?.trim() || null,
      txn_date:        input.txn_date,
      notes:           input.notes?.trim() || null,
      is_tax_relevant: input.is_tax_relevant ?? false,
      status:          'cleared',
      tags:            [],
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/expenses')
    revalidatePath('/accounts')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add transaction')
  }
}