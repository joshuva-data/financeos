'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Sun, Moon, Plus, TrendingUp, TrendingDown,
  Target, FileText, X, LogOut, Settings, User, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface TopBarProps { userName: string; userEmail: string }

const QUICK_ACTIONS = [
  { label: 'Add Transaction', href: '/expenses',   icon: TrendingDown, color: 'text-red-400'    },
  { label: 'Add Income',      href: '/income',     icon: TrendingUp,   color: 'text-green-400'  },
  { label: 'Add Goal',        href: '/goals',      icon: Target,       color: 'text-blue-400'   },
  { label: 'Upload Document', href: '/documents',  icon: FileText,     color: 'text-purple-400' },
]

const ALL_PAGES = [
  { label: 'Dashboard',         href: '/dashboard'          },
  { label: 'Accounts',          href: '/accounts'           },
  { label: 'Income',            href: '/income'             },
  { label: 'Expenses',          href: '/expenses'           },
  { label: 'Investments',       href: '/investments'        },
  { label: 'Net Worth',         href: '/net-worth'          },
  { label: 'Goals',             href: '/goals'              },
  { label: 'Insurance',         href: '/insurance'          },
  { label: 'Corporate Benefits',href: '/corporate-benefits' },
  { label: 'Documents',         href: '/documents'          },
  { label: 'Debt',              href: '/debt'               },
  { label: 'Receivables',       href: '/receivables'        },
  { label: 'Rental',            href: '/rental'             },
  { label: 'Tithe & Giving',    href: '/tithe'              },
  { label: 'Calendar',          href: '/calendar'           },
  { label: 'AI Copilot',        href: '/ai-copilot'         },
  { label: 'Automation',        href: '/automation'         },
  { label: 'Settings',          href: '/settings'           },
  { label: 'Help',              href: '/help'               },
]

export function TopBar({ userName, userEmail }: TopBarProps) {
  const [showSearch, setShowSearch]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [showActions, setShowActions]   = useState(false)
  const [showProfile, setShowProfile]   = useState(false)
  const [showNotifs, setShowNotifs]     = useState(false)
  const [isDark, setIsDark]             = useState(true)
  const searchRef = useRef<HTMLInputElement>(null)
  const router    = useRouter()

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail[0]?.toUpperCase() ?? 'U'

  const filteredPages = searchQuery.trim().length > 0
    ? ALL_PAGES.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const toggleTheme = () => {
    const html = document.documentElement
    if (isDark) {
      html.style.filter = 'invert(1) hue-rotate(180deg)'
      html.style.background = '#fff'
    } else {
      html.style.filter = ''
      html.style.background = ''
    }
    setIsDark(!isDark)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Search overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowSearch(false); setSearchQuery('') }} />
          <div className="relative w-full max-w-lg mx-4 bg-[#0f1117] border border-[#1f2937] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f2937]">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search pages, features…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none"
                style={{ background: 'transparent !important', border: 'none !important', boxShadow: 'none !important' }}
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {filteredPages.length > 0 ? (
              <div className="py-2 max-h-64 overflow-y-auto">
                {filteredPages.map(page => (
                  <Link key={page.href} href={page.href}
                    onClick={() => { setShowSearch(false); setSearchQuery('') }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#e5e7eb] hover:bg-white/5 transition-colors">
                    <div className="h-6 w-6 rounded bg-white/5 flex items-center justify-center text-[10px] text-muted-foreground">
                      {page.label[0]}
                    </div>
                    {page.label}
                  </Link>
                ))}
              </div>
            ) : searchQuery.length > 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No results for "{searchQuery}"</div>
            ) : (
              <div className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-2">Quick navigation</p>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_PAGES.slice(0, 8).map(page => (
                    <Link key={page.href} href={page.href}
                      onClick={() => { setShowSearch(false); setSearchQuery('') }}
                      className="px-3 py-2 text-xs text-[#9ca3af] hover:bg-white/5 rounded-lg transition-colors">
                      {page.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="h-14 border-b border-[#1f2937] flex items-center px-4 gap-3 flex-shrink-0 bg-[#080b12]/90 backdrop-blur-sm sticky top-0 z-30">

        {/* Search trigger */}
        <button
          onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50) }}
          className="flex items-center gap-2.5 h-8 px-3 text-sm text-muted-foreground bg-white/4 border border-[#1f2937] rounded-lg hover:bg-white/6 transition-colors flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-xs">Search or type a command…</span>
          <kbd className="ml-auto text-[10px] bg-white/8 border border-white/10 px-1.5 py-0.5 rounded font-mono text-muted-foreground">Ctrl K</kbd>
        </button>

        <div className="flex items-center gap-1.5 ml-auto">

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-8 w-8 relative hover:bg-white/5"
              onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); setShowActions(false) }}>
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            </Button>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-[#1f2937] bg-[#0f1117] shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1f2937]">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                  </div>
                  <div className="py-2">
                    {[
                      { title: 'Check upcoming EMIs', desc: 'Review your debt section for due dates', color: '#3b82f6', href: '/debt' },
                      { title: 'Insurance renewals', desc: 'Check insurance for policies expiring soon', color: '#f59e0b', href: '/insurance' },
                      { title: 'Monthly report ready', desc: 'View your financial summary for this month', color: '#10b981', href: '/dashboard' },
                    ].map((n, i) => (
                      <Link key={i} href={n.href} onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/4 transition-colors">
                        <div className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: n.color }} />
                        <div>
                          <p className="text-xs font-medium text-white">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{n.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-[#1f2937]">
                    <Link href="/settings" onClick={() => setShowNotifs(false)}
                      className="text-xs text-blue-400 hover:underline">Manage notifications →</Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {/* Quick add */}
          <div className="relative">
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white border-0"
              onClick={() => { setShowActions(!showActions); setShowProfile(false); setShowNotifs(false) }}>
              <Plus className="h-3.5 w-3.5" /> Quick Add
            </Button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-[#1f2937] bg-[#0f1117] shadow-2xl overflow-hidden">
                  {QUICK_ACTIONS.map(action => (
                    <Link key={action.href} href={action.href}
                      onClick={() => setShowActions(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[#e5e7eb] hover:bg-white/5 transition-colors">
                      <action.icon className={cn('h-4 w-4', action.color)} />
                      {action.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowProfile(!showProfile); setShowActions(false); setShowNotifs(false) }}
              className="flex items-center gap-2 pl-2 pr-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
              <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-white leading-none">{userName || userEmail}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Personal</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </button>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-[#1f2937] bg-[#0f1117] shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1f2937]">
                    <p className="text-xs font-semibold text-white">{userName || 'User'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{userEmail}</p>
                  </div>
                  <div className="py-1">
                    {[
                      { label: 'Profile Settings', icon: User,     href: '/settings'  },
                      { label: 'Preferences',      icon: Settings,  href: '/settings'  },
                    ].map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setShowProfile(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#e5e7eb] hover:bg-white/5 transition-colors">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="py-1 border-t border-[#1f2937]">
                    <button onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full">
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  )
}