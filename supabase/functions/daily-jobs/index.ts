// Supabase Edge Function — runs daily at 00:05 IST via pg_cron
// Deploy: supabase functions deploy daily-jobs
// Trigger SQL: SELECT cron.schedule('daily-jobs','5 18 * * *','SELECT net.http_post(...)');
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runDailyNetWorthSnapshot } from '../../../lib/jobs/syncJobs.ts'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  await runDailyNetWorthSnapshot(supabase)
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
