'use client'

import { useState, useEffect, useTransition } from 'react'
import { User, Bell, Palette, Shield, Info, LogOut,
  Sun, Moon, Monitor, Save, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TABS = [
  { id: 'account',     label: 'Account',     icon: User    },
  { id: 'preferences', label: 'Preferences', icon: Bell    },
  { id: 'appearance',  label: 'Appearance',  icon: Palette },
  { id: 'security',    label: 'Security',    icon: Shield  },
  { id: 'about',       label: 'About',       icon: Info    },
]

export function SettingsModule({ user, profile }: { user: any; profile: any }) {
  const [tab, setTab]           = useState('account')
  const [saving, setSaving]     = useState(false)
  const [isPending, startTransition] = useTransition()
  const [theme, setTheme]       = useState('dark')
  const [showPass, setShowPass] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  const [accountForm, setAccountForm] = useState({
    full_name: profile?.full_name ?? '',
    phone:     profile?.phone ?? '',
    city:      profile?.city ?? '',
    pan_number:profile?.pan_number ?? '',
  })

  const [notifForm, setNotifForm] = useState({
    emiReminders:   true,
    renewalAlerts:  true,
    monthlyReport:  true,
    overdueAlerts:  true,
    goalProgress:   true,
    tithReminder:   true,
  })

  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('financeos-theme') ?? 'dark'
    setTheme(saved)
  }, [])

  const applyTheme = (t: string) => {
    setTheme(t)
    localStorage.setItem('financeos-theme', t)
    const html = document.documentElement
    if (t === 'dark') {
      html.style.filter = ''
    } else if (t === 'light') {
      html.style.filter = 'invert(1) hue-rotate(180deg)'
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      html.style.filter = prefersDark ? '' : 'invert(1) hue-rotate(180deg)'
    }
    toast.success(`${t.charAt(0).toUpperCase() + t.slice(1)} theme applied`)
  }

  const saveAccount = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name:  accountForm.full_name,
      phone:      accountForm.phone || null,
      city:       accountForm.city || null,
      pan_number: accountForm.pan_number || null,
    }).eq('id', user.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated successfully')
  }

  const sendPasswordReset = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(user?.email ?? '')
    if (error) toast.error(error.message)
    else { setResetSent(true); toast.success('Password reset email sent') }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const setA = (k: string, v: any) => setAccountForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="flex gap-5">
        {/* Tabs sidebar */}
        <div className="w-44 flex-shrink-0 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                tab === t.id
                  ? 'bg-blue-600/15 text-blue-400 font-medium'
                  : 'text-muted-foreground hover:bg-white/4 hover:text-white'
              )}>
              <t.icon className="h-4 w-4 flex-shrink-0" />
              {t.label}
            </button>
          ))}
          <div className="pt-3 border-t border-white/6">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* ACCOUNT */}
          {tab === 'account' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Personal Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold">
                    {accountForm.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{accountForm.full_name || 'Your Name'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                    <Input value={accountForm.full_name} onChange={e => setA('full_name', e.target.value)}
                      placeholder="Your full name" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                    <Input value={user?.email ?? ''} disabled className="opacity-50 cursor-not-allowed" />
                    <p className="text-[11px] text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                    <Input value={accountForm.phone} onChange={e => setA('phone', e.target.value)}
                      placeholder="+91 98765 43210" type="tel" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">City</label>
                    <Input value={accountForm.city} onChange={e => setA('city', e.target.value)}
                      placeholder="Chennai" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">PAN Number</label>
                    <Input value={accountForm.pan_number} onChange={e => setA('pan_number', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F" maxLength={10} />
                  </div>
                </div>

                <Button onClick={saveAccount} disabled={saving} size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {/* PREFERENCES */}
          {tab === 'preferences' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Notification Settings</h2>
                <div className="space-y-3">
                  {[
                    { key: 'emiReminders',  label: 'EMI Reminders',      desc: '3 days before each EMI due date'        },
                    { key: 'renewalAlerts', label: 'Insurance Renewals',  desc: '30 days before policy renewal date'    },
                    { key: 'monthlyReport', label: 'Monthly Report',      desc: 'Financial summary at month end'        },
                    { key: 'overdueAlerts', label: 'Overdue Alerts',      desc: 'When receivables become overdue'       },
                    { key: 'goalProgress',  label: 'Goal Milestones',     desc: 'When you hit 25%, 50%, 75%, 100%'     },
                    { key: 'tithReminder',  label: 'Tithe Reminder',      desc: 'Monthly reminder to record giving'    },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifForm[item.key as keyof typeof notifForm]}
                        onCheckedChange={v => setNotifForm(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">Regional Preferences</h2>
                <div className="space-y-2">
                  {[
                    { label: 'Currency',        value: '₹ Indian Rupee (INR)'  },
                    { label: 'Financial Year',  value: 'April – March'         },
                    { label: 'Country',         value: 'India 🇮🇳'            },
                    { label: 'Number Format',   value: '1,00,000 (Indian)'     },
                    { label: 'Date Format',     value: 'DD/MM/YYYY'            },
                    { label: 'Tax Regime',      value: 'Indian Income Tax Act' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Regional settings are fixed for Indian users. More customisation coming soon.</p>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {tab === 'appearance' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Theme</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'dark',   label: 'Dark',   icon: Moon,    desc: 'Premium dark look' },
                    { id: 'light',  label: 'Light',  icon: Sun,     desc: 'Clean light mode'  },
                    { id: 'system', label: 'System', icon: Monitor, desc: 'Matches your OS'   },
                  ].map(t => (
                    <button key={t.id} onClick={() => applyTheme(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                        theme === t.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/8 hover:border-white/16 hover:bg-white/4'
                      )}>
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center',
                        theme === t.id ? 'bg-blue-500/20' : 'bg-white/5')}>
                        <t.icon className={cn('h-4 w-4', theme === t.id ? 'text-blue-400' : 'text-muted-foreground')} />
                      </div>
                      <span className={cn('text-xs font-medium', theme === t.id ? 'text-blue-400' : 'text-white')}>
                        {t.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Theme change applies immediately and is saved in your browser.</p>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">Display</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Compact Mode',    desc: 'Reduce spacing for more data on screen' },
                    { label: 'Animations',      desc: 'Enable smooth transitions and effects'  },
                    { label: 'Show Balances',   desc: 'Show account balances on sidebar'       },
                  ].map((item, i) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch defaultChecked={i !== 0} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {tab === 'security' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Change Password</h2>
                <p className="text-xs text-muted-foreground">
                  We will send a secure password reset link to <span className="text-white">{user?.email}</span>
                </p>
                {resetSent ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Reset email sent! Check your inbox.
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={sendPasswordReset}>
                    Send Password Reset Email
                  </Button>
                )}
              </div>

              <div className="glass-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Session</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-muted-foreground">Signed in as</span>
                    <span className="text-white font-medium">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-muted-foreground">Account created</span>
                    <span className="text-white font-medium">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Last sign in</span>
                    <span className="text-white font-medium">
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={handleLogout} className="gap-1.5">
                  <LogOut className="h-3.5 w-3.5" /> Sign Out of All Devices
                </Button>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">Data Privacy</h2>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• Your financial data is stored in your own Supabase database.</p>
                  <p>• We do not share your data with any third parties.</p>
                  <p>• AI queries are processed by Groq and are not stored by us.</p>
                  <p>• All connections use HTTPS encryption.</p>
                </div>
              </div>
            </div>
          )}

          {/* ABOUT */}
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5 space-y-4 text-center">
                <div className="text-5xl">💰</div>
                <div>
                  <h2 className="text-lg font-bold text-white">FinanceOS</h2>
                  <p className="text-xs text-muted-foreground mt-1">Version 0.1.0 · Built for India 🇮🇳</p>
                </div>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  A comprehensive personal finance operating system — track income, expenses, debt, investments, insurance, and goals all in one place.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">Tech Stack</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Frontend',   value: 'Next.js 15 + TypeScript' },
                    { label: 'Database',   value: 'Supabase (PostgreSQL)'   },
                    { label: 'AI',         value: 'Groq — Llama 3 (Free)'  },
                    { label: 'Charts',     value: 'Recharts'                },
                    { label: 'Styling',    value: 'Tailwind CSS'            },
                    { label: 'Auth',       value: 'Supabase Auth'           },
                    { label: 'Storage',    value: 'Supabase Storage'        },
                    { label: 'Hosting',    value: 'Vercel'                  },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg bg-white/4 p-3 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className="text-xs font-medium text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-white">Legal</h3>
                <p className="text-xs text-muted-foreground">
                  FinanceOS is a personal finance tool. It does not provide investment advice. All financial decisions should be made in consultation with a qualified financial advisor. Past performance does not guarantee future results.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
