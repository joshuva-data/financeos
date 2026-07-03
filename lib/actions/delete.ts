'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Table =
  | 'accounts' | 'transactions' | 'income_entries' | 'debt_accounts'
  | 'receivables' | 'financial_goals' | 'tithe_entries' | 'insurance_policies'
  | 'rental_properties' | 'tenants' | 'investments' | 'documents'

const TABLE_PATHS: Record<Table, string> = {
  accounts:          '/accounts',
  transactions:      '/expenses',
  income_entries:    '/income',
  debt_accounts:     '/debt',
  receivables:       '/receivables',
  financial_goals:   '/goals',
  tithe_entries:     '/tithe',
  insurance_policies:'/insurance',
  rental_properties: '/rental',
  tenants:           '/rental',
  investments:       '/investments',
  documents:         '/documents',
}

export async function deleteRecord(table: Table, id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Unauthorized' }

    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }

    revalidatePath(TABLE_PATHS[table] ?? '/')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}
