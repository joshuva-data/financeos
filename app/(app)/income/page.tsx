import { createClient } from '@/lib/supabase/server'
import { IncomeModule }  from '@/components/income/IncomeModule'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    supabase.from('income_entries').select('*').eq('user_id', user.id)
      .eq('financial_year', currentFY).order('month'),
    supabase.from('accounts').select('id, name, account_type').eq('user_id', user.id),
  ])

  return (
    <IncomeModule
      entries={entries ?? []}
      accounts={accounts ?? []}
      financialYear={currentFY}
    />
  )
}
