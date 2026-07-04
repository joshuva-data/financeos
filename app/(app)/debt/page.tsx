import { createClient }  from '@/lib/supabase/server'
import { DebtModule }    from '@/components/debt/DebtModule'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function DebtPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: debts } = await supabase
    .from('debt_accounts').select('*').eq('user_id', user.id)
    .eq('is_active', true).order('outstanding', { ascending: false })

  return <DebtModule debts={debts ?? []} />
}
