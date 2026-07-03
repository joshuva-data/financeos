import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile }  = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const in7Days   = new Date(Date.now() + 7  * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30Days  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: upcomingEMIs }, { data: renewals }, { data: overdue }] = await Promise.all([
    supabase.from('debt_accounts').select('lender_name, emi_amount, next_emi_date')
      .eq('user_id', user.id).eq('is_active', true)
      .not('next_emi_date', 'is', null).lte('next_emi_date', in7Days),
    supabase.from('insurance_policies').select('policy_name, renewal_date, annual_premium')
      .eq('user_id', user.id).eq('status', 'active')
      .not('renewal_date', 'is', null).lte('renewal_date', in30Days),
    supabase.from('receivables').select('from_name, balance_due')
      .eq('user_id', user.id).eq('status', 'overdue'),
  ])

  const notifications = [
    ...(upcomingEMIs ?? []).map((d: any) => ({
      title: `EMI due: ${d.lender_name}`,
      desc:  `₹${Number(d.emi_amount ?? 0).toLocaleString('en-IN')} due ${new Date(d.next_emi_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      color: '#ef4444',
      href:  '/debt',
    })),
    ...(renewals ?? []).map((p: any) => ({
      title: `Renewal: ${p.policy_name}`,
      desc:  `₹${Number(p.annual_premium ?? 0).toLocaleString('en-IN')}/yr · ${new Date(p.renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      color: '#f59e0b',
      href:  '/insurance',
    })),
    ...(overdue ?? []).map((r: any) => ({
      title: `Overdue: ${r.from_name}`,
      desc:  `₹${Number(r.balance_due ?? 0).toLocaleString('en-IN')} pending`,
      color: '#ef4444',
      href:  '/receivables',
    })),
  ]

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 md:ml-[220px] min-w-0">
        <TopBar
          userName={profile?.full_name ?? user.email ?? ''}
          userEmail={user.email ?? ''}
          notifications={notifications}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}