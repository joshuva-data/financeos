import { createClient } from '@/lib/supabase/server'
import { AutomationHub } from '@/components/automation/AutomationHub'

export default async function AutomationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: jobs } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <AutomationHub jobs={jobs ?? []} userId={user.id} />
}
