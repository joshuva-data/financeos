'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { insurancePolicySchema } from '@/lib/validations/insurance'
import type { InsurancePolicyInsert, InsurancePolicyUpdate } from '@/types/database'

export async function createInsurancePolicy(formData: InsurancePolicyInsert) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const validated = insurancePolicySchema.parse(formData)

  const { data, error } = await supabase
    .from('insurance_policies')
    .insert({ ...validated, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/insurance')
  return data
}

export async function updateInsurancePolicy(id: string, formData: InsurancePolicyUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('insurance_policies')
    .update(formData)
    .eq('id', id)
    .eq('user_id', user.id)  // RLS + explicit check
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/insurance')
  return data
}

export async function deleteInsurancePolicy(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('insurance_policies')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/insurance')
}