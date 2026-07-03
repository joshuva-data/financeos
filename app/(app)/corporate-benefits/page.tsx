import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CorporateBenefitsModule } from '@/components/corporate/CorporateBenefitsModule'

export const metadata: Metadata = { title: 'Corporate Benefits' }

export default async function CorporateBenefitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

  const { data: benefits } = await supabase.from('corporate_benefits').select('*')
    .eq('user_id', user.id).eq('financial_year', currentFY).maybeSingle()

  return <CorporateBenefitsModule benefits={benefits ?? null} financialYear={currentFY} />
}