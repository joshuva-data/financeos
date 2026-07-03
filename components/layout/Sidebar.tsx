'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CreditCard,
  Users, Home, Heart, Target, FileText, Zap, Bot, Settings,
  ChevronLeft, ChevronRight, Building2, Shield, LogOut, Menu,
  BarChart3, PieChart, Landmark, HelpCircle, Receipt, Calendar
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
      { label: 'Accounts',     href: '/accounts',     icon: Wallet          },
      { label: 'Income',       href: '/income',       icon: TrendingUp      },
      { label: 'Expenses',     href: '/expenses',     icon: TrendingDown    },
    ]
  },
  {
    label: 'Wealth',
    items: [
      { label: 'Investments',  href: '/investments',  icon: BarChart3  },
      { label: 'Net Worth',    href: '/net-worth',    icon: PieChart   },
      { label: 'Goals',        href: '/goals',        icon: Target     },
    ]
  },
  {
    label: 'Protection',
    items: [
      { label: 'Insurance',         href: '/insurance',          icon: Shield    },
      { label: 'Corporate Benefits', href: '/corporate-benefits', icon: Building2 },
      { label: 'Documents',         href: '/documents',          icon: FileText  },
    ]
  },
  {
    label: 'Liabilities',
    items: [
      { label: 'Debt',        href: '/debt',        icon: CreditCard },
      { label: 'Receivables', href: '/receivables', icon: Users      },
      { label: 'Rental',      href: '/rental',      icon: Home       },
    ]
  },
  {
    label: 'Planning',
    items: [
      { label: 'Taxes',          href: '/taxes',     icon: Receipt  },
      { label: 'Tithe & Giving', href: '/tithe',     icon: Heart    },
      { label: 'Calendar',       href: '/calendar',  icon: Calendar },
    ]
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'AI Copilot', href: '/ai-copilot', icon: Bot },
      { label: 'Automation', href: '/automation',  icon: Zap },
    ]
  },
]

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 md:hidden rounded-lg border border-border/50 bg-card p-2"
        onClick={() => setMobileOpen(!mobileOpen)}>
        <Menu className="h-4 w-4" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        'border-r border-border/50',
        'bg-[#0a0a0f]',
        collapsed ? 'w-[60px]' : 'w-[220px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>

        {/* Logo */}
        <div className={cn(
          'flex items-center h-14 px-4 border-b border-border/50 flex-shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center glow-blue flex-shrink-0">
                <Landmark className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-white">FinanceOS</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted/50 transition-colors text-muted-foreground">
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = isActive(item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                        collapsed ? 'justify-center px-2' : '',
                        active
                          ? 'bg-blue-600/15 text-blue-400 font-medium'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                      )}>
                      <item.icon className={cn('h-4 w-4 flex-shrink-0',
                        active ? 'text-blue-400' : '')} />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && active && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border/50 space-y-0.5 flex-shrink-0">
          {[
            { label: 'Settings',    href: '/settings', icon: Settings   },
            { label: 'Help',        href: '/help',     icon: HelpCircle },
          ].map(item => (
            <Link key={item.href} href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors w-full',
                collapsed ? 'justify-center px-2' : '',
                isActive(item.href)
                  ? 'bg-blue-600/15 text-blue-400 font-medium'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white'
              )}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
          <button onClick={handleLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors w-full text-left',
              collapsed ? 'justify-center px-2' : '',
              'text-muted-foreground hover:bg-red-500/10 hover:text-red-400'
            )}>
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
