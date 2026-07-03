import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export async function generateReminders(supabase: Client, userId: string): Promise<void> {
  const [insurance, debts, investments, receivables] = await Promise.all([
    supabase.from('insurance_policies').select('id, policy_name, renewal_date, annual_premium').eq('user_id', userId).eq('status', 'active'),
    supabase.from('debt_accounts').select('id, lender_name, next_emi_date, emi_amount').eq('user_id', userId).eq('is_active', true),
    supabase.from('investments').select('id, name, maturity_date').eq('user_id', userId).not('maturity_date', 'is', null),
    supabase.from('receivables').select('id, from_name, due_date, balance_due').eq('user_id', userId).not('status', 'in', '("received","written_off")'),
  ])

  const events: Database['public']['Tables']['calendar_events']['Insert'][] = []

  // Insurance renewal reminders
  for (const policy of insurance.data ?? []) {
    events.push({
      user_id: userId,
      event_type: 'insurance_renewal',
      title: `Renew: ${policy.policy_name}`,
      event_date: policy.renewal_date,
      amount: policy.annual_premium,
      reminder_days: [30, 14, 7, 3, 1],
      is_recurring: false,
      linked_id: policy.id,
      linked_type: 'insurance_policies',
      is_completed: false,
    })
  }

  // EMI reminders
  for (const debt of debts.data ?? []) {
    if (!debt.next_emi_date) continue
    events.push({
      user_id: userId,
      event_type: 'emi_due',
      title: `EMI: ${debt.lender_name}`,
      event_date: debt.next_emi_date,
      amount: debt.emi_amount,
      reminder_days: [5, 3, 1],
      is_recurring: true,
      linked_id: debt.id,
      linked_type: 'debt_accounts',
      is_completed: false,
    })
  }

  // Investment maturity
  for (const inv of investments.data ?? []) {
    if (!inv.maturity_date) continue
    events.push({
      user_id: userId,
      event_type: 'investment_maturity',
      title: `Maturity: ${inv.name}`,
      event_date: inv.maturity_date,
      reminder_days: [30, 7],
      is_recurring: false,
      linked_id: inv.id,
      linked_type: 'investments',
      is_completed: false,
    })
  }

  // Receivables due
  for (const r of receivables.data ?? []) {
    events.push({
      user_id: userId,
      event_type: 'receivable_due',
      title: `Collect: ${r.from_name}`,
      event_date: r.due_date,
      amount: r.balance_due,
      reminder_days: [3, 1],
      is_recurring: false,
      linked_id: r.id,
      linked_type: 'receivables',
      is_completed: false,
    })
  }

  // Tax deadlines (FY 2025-26)
  const TAX_DEADLINES = [
    { title: 'Advance Tax Q1', date: '2025-06-15' },
    { title: 'Advance Tax Q2', date: '2025-09-15' },
    { title: 'Advance Tax Q3', date: '2025-12-15' },
    { title: 'Advance Tax Q4', date: '2026-03-15' },
    { title: 'ITR Filing Deadline', date: '2026-07-31' },
  ]

  for (const deadline of TAX_DEADLINES) {
    events.push({
      user_id: userId,
      event_type: 'tax_deadline',
      title: deadline.title,
      event_date: deadline.date,
      reminder_days: [30, 7, 3],
      is_recurring: false,
      is_completed: false,
    })
  }

  // Upsert — avoid duplicates by (user_id, event_type, linked_id, event_date)
  if (events.length > 0) {
    await supabase.from('calendar_events').upsert(events, {
      onConflict: 'user_id,event_type,event_date',
      ignoreDuplicates: true,
    })
  }
}