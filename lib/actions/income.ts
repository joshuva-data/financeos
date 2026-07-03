'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, getCurrentFY, type ActionResult } from './shared'

export interface AddIncomeInput {
  source_name: string
  income_type: string
  gross_amount: number
  tds_deducted: number
  month: number          // 1–12
  financial_year?: string
  account_id?: string
  is_taxable?: boolean
  notes?: string
}

export async function addIncomeEntry(input: AddIncomeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const net_amount = input.gross_amount - input.tds_deducted

    const { data, error } = await supabase.from('income_entries').insert({
      user_id:        user.id,
      source_name:    input.source_name.trim(),
      income_type:    input.income_type,
      gross_amount:   input.gross_amount,
      tds_deducted:   input.tds_deducted,
      net_amount,
      month:          input.month,
      financial_year: input.financial_year ?? getCurrentFY(),
      account_id:     input.account_id || null,
      is_taxable:     input.is_taxable ?? true,
      notes:          input.notes?.trim() || null,
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/income')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add income entry')
  }
}