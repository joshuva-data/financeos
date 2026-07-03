import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { RentalModule } from '@/components/rental/RentalModule'

export const revalidate = 0
export const metadata: Metadata = { title: 'Rental Property' }

export default async function RentalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: properties }, { data: tenants }, { data: pendingRent }] = await Promise.all([
    supabase.from('rental_properties').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('tenants').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('receivables').select('*').eq('user_id', user.id)
      .eq('is_rental', true).neq('status', 'received'),
  ])

  return <RentalModule properties={properties ?? []} tenants={tenants ?? []} pendingRent={pendingRent ?? []} />
}