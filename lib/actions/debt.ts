'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ActionResult } from './shared'

export interface AddDebtInput {
  debt_type: string
  lender_name: string
  loan_account_no?: string
  original_amount: number
  outstanding: number
  interest_rate: number
  rate_type: 'fixed' | 'floating'
  emi_amount?: number
  tenure_months?: number
  disbursement_date?: string
  emi_start_date?: string
  next_emi_date?: string
  collateral?: string
  notes?: string
}

export async function addDebt(input: AddDebtInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data, error } = await supabase.from('debt_accounts').insert({
      user_id:           user.id,
      debt_type:         input.debt_type,
      lender_name:       input.lender_name.trim(),
      loan_account_no:   input.loan_account_no?.trim() || null,
      original_amount:   input.original_amount,
      outstanding:       input.outstanding,
      interest_rate:     input.interest_rate,
      rate_type:         input.rate_type,
      emi_amount:        input.emi_amount || null,
      tenure_months:     input.tenure_months || null,
      disbursement_date: input.disbursement_date || null,
      emi_start_date:    input.emi_start_date || null,
      next_emi_date:     input.next_emi_date || null,
      collateral:        input.collateral?.trim() || null,
      notes:             input.notes?.trim() || null,
      is_active:         true,
      prepayment_penalty:false,
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/debt')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add loan')
  }
}