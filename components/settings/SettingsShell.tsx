'use client'

import { useState } from 'react'
import { User, Palette, Bell, Link2, Shield, Download, Upload, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProfileSettings } from './ProfileSettings'
import { ThemeSettings } from './ThemeSettings'
import { NotificationSettings } from './NotificationSettings'
import { IntegrationHub } from './IntegrationHub'
import { SecuritySettings } from './SecuritySettings'
import { BackupSettings } from './BackupSettings'
import { ImportCenter } from './ImportCenter'
import type { Profile } from '@/types/database'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'backup', label: 'Backup & Export', icon: Download },
  { id: 'import', label: 'Import Data', icon: Upload },
] as const

type TabId = (typeof TABS)[number]['id']

interface SettingsShellProps { profile: Profile | null; userId: string; userEmail: string }

export function SettingsShell({ profile, userId, userEmail }: SettingsShellProps) {
  const [active, setActive] = useState<TabId>('profile')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account, preferences, and integrations</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="sm:w-48 flex-shrink-0">
          <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActive(tab.id)}
                className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap sm:w-full text-left transition-all',
                  active === tab.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                <tab.icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active === 'profile' && <ProfileSettings profile={profile} userId={userId} userEmail={userEmail} />}
          {active === 'appearance' && <ThemeSettings />}
          {active === 'notifications' && <NotificationSettings userId={userId} />}
          {active === 'integrations' && <IntegrationHub userId={userId} />}
          {active === 'security' && <SecuritySettings userEmail={userEmail} />}
          {active === 'backup' && <BackupSettings userId={userId} />}
          {active === 'import' && <ImportCenter userId={userId} />}
        </div>
      </div>
    </div>
  )
}