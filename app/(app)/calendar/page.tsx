import { createClient } from '@/lib/supabase/server'
import { CalendarModule } from '@/components/calendar/CalendarModule'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: debts },
    { data: insurance },
    { data: receivables },
    { data: goals },
    { data: tithe },
  ] = await Promise.all([
    supabase.from('debt_accounts').select('id, lender_name, emi_amount, next_emi_date, debt_type').eq('user_id', user.id).eq('is_active', true).not('next_emi_date', 'is', null),
    supabase.from('insurance_policies').select('id, policy_name, annual_premium, renewal_date, insurance_type').eq('user_id', user.id).eq('status', 'active').not('renewal_date', 'is', null),
    supabase.from('receivables').select('id, from_name, balance_due, due_date, status').eq('user_id', user.id).neq('status', 'received'),
    supabase.from('financial_goals').select('id, name, target_date, target_amount, current_amount').eq('user_id', user.id).eq('status', 'active').not('target_date', 'is', null),
    supabase.from('tithe_entries').select('id, recipient_name, amount, giving_date').eq('user_id', user.id).order('giving_date', { ascending: false }).limit(10),
  ])

  return (
    <CalendarModule
      debts={debts ?? []}
      insurance={insurance ?? []}
      receivables={receivables ?? []}
      goals={goals ?? []}
      tithe={tithe ?? []}
    />
  )
}