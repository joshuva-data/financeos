import { createClient }  from '@/lib/supabase/server'
import { TitheModule }   from '@/components/tithe/TitheModule'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function TithePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const { data: entries } = await supabase
    .from('tithe_entries').select('*').eq('user_id', user.id)
    .eq('financial_year', currentFY)
    .order('giving_date', { ascending: false })

  return <TitheModule entries={entries ?? []} financialYear={currentFY} />
}
