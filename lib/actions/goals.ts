'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ActionResult } from './shared'

export interface AddGoalInput {
  name: string
  description?: string
  target_amount: number
  current_amount?: number
  target_date?: string
  monthly_contrib?: number
  category?: string
  icon?: string
  color?: string
  priority?: number
}

export async function addGoal(input: AddGoalInput): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data, error } = await supabase.from('financial_goals').insert({
      user_id:        user.id,
      name:           input.name.trim(),
      description:    input.description?.trim() || null,
      target_amount:  input.target_amount,
      current_amount: input.current_amount ?? 0,
      target_date:    input.target_date || null,
      monthly_contrib:input.monthly_contrib || null,
      category:       input.category?.trim() || null,
      icon:           input.icon || null,
      color:          input.color || null,
      priority:       input.priority ?? 3,
      status:         'active',
    }).select('id').single()

    if (error) return fail(error.message)
    revalidatePath('/goals')
    return ok({ id: data.id })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add goal')
  }
}

export async function addGoalContribution(
  goalId: string,
  amount: number
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('Unauthorized')

    const { data: goal } = await supabase.from('financial_goals')
      .select('current_amount, target_amount').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return fail('Goal not found')

    const newAmount = goal.current_amount + amount
    const status = newAmount >= goal.target_amount ? 'completed' : 'active'

    const { error } = await supabase.from('financial_goals').update({
      current_amount: newAmount, status,
    }).eq('id', goalId).eq('user_id', user.id)

    if (error) return fail(error.message)
    revalidatePath('/goals')
    return ok(undefined)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to add contribution')
  }
}