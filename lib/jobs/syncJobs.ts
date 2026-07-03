import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export async function runDailyNetWorthSnapshot(supabase: Client): Promise<void> {
  // Get all active users
  const { data: profiles } = await supabase.from('profiles').select('id').eq('onboarding_done', true)

  for (const profile of profiles ?? []) {
    const { data: snapshot } = await supabase.rpc('compute_net_worth', { p_user_id: profile.id })

    if (snapshot) {
      await supabase.from('net_worth_snapshots').upsert({
        user_id: profile.id,
        snapshot_date: new Date().toISOString().split('T')[0],
        total_assets: snapshot.total_assets,
        total_liabilities: snapshot.total_liabilities,
        liquid_cash: snapshot.liquid_cash,
        investments_val: snapshot.investments_val,
        receivables_val: snapshot.receivables_val,
        real_estate_val: snapshot.real_estate_val,
        debt_total: snapshot.debt_total,
        metadata: {},
      }, { onConflict: 'user_id,snapshot_date' })

      // Generate AI insights for each user
      const { generateAIInsights } = await import('@/lib/notifications/inApp')
      await generateAIInsights(supabase, profile.id)

      // Generate reminders
      const { generateReminders } = await import('@/lib/notifications/engine')
      await generateReminders(supabase, profile.id)
    }
  }
}