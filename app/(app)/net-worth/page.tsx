import { createClient }   from '@/lib/supabase/server'
import { NetWorthModule } from '@/components/networth/NetWorthModule'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function NetWorthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: snapshots },
    { data: accounts },
    { data: investments },
    { data: debts },
  ] = await Promise.all([
    supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id)
      .order('snapshot_date').limit(12),
    supabase.from('accounts').select('id, name, account_type, balance')
      .eq('user_id', user.id).eq('status', 'active'),
    supabase.from('investments').select('id, name, investment_type, current_value, invested_amount')
      .eq('user_id', user.id),
    supabase.from('debt_accounts').select('id, lender_name, debt_type, outstanding')
      .eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <NetWorthModule
      snapshots={snapshots   ?? []}
      accounts={accounts     ?? []}
      investments={investments ?? []}
      debts={debts           ?? []}
    />
  )
}
