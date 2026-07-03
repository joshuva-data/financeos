import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ReceivablesModule } from '@/components/receivables/ReceivablesModule'

export const metadata: Metadata = { title: 'Receivables' }

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: receivables } = await supabase.from('receivables').select('*')
    .eq('user_id', user.id).neq('status', 'received').order('due_date')

  return <ReceivablesModule receivables={receivables ?? []} />
}