import { createClient }        from '@/lib/supabase/server'
import { ReceivablesModule }   from '@/components/receivables/ReceivablesModule'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: receivables } = await supabase
    .from('receivables').select('*').eq('user_id', user.id)
    .neq('status', 'received').order('due_date')

  return <ReceivablesModule receivables={receivables ?? []} />
}
