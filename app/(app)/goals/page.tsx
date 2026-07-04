import { createClient }  from '@/lib/supabase/server'
import { GoalsModule }   from '@/components/goals/GoalsModule'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: goals } = await supabase
    .from('financial_goals').select('*').eq('user_id', user.id)
    .order('priority').order('target_date')

  return <GoalsModule goals={goals ?? []} />
}
