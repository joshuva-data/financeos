import { createClient } from '@/lib/supabase/server'
import { InsuranceSimple } from '@/components/insurance/InsuranceSimple'

export const revalidate = 0
export default async function InsurancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: policies } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('user_id', user.id)
    .order('renewal_date')

  return <InsuranceSimple policies={policies ?? []} />
}