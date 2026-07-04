import { createClient }        from '@/lib/supabase/server'
import { InvestmentConsole }   from '@/components/investments/InvestmentConsole'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function InvestmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: investments } = await supabase
    .from('investments').select('*').eq('user_id', user.id)
    .order('invested_amount', { ascending: false })

  return <InvestmentConsole investments={investments ?? []} />
}