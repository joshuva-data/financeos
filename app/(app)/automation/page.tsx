import { createClient }     from '@/lib/supabase/server'
import { AutomationEngine } from '@/components/automation/AutomationEngine'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function AutomationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: jobs } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <AutomationEngine
      jobs={jobs ?? []}
      userId={user.id}
    />
  )
}
