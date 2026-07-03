'use client'

import { useState } from 'react'

const NOTIF_SETTINGS = [
  { key: 'insurance_renewal', label: 'Insurance Renewals', desc: '30, 14, 7 days before renewal' },
  { key: 'emi_due', label: 'EMI Reminders', desc: '5 days before each EMI' },
  { key: 'rent_collection', label: 'Rent Collection', desc: 'When rent is due or overdue' },
  { key: 'tax_deadline', label: 'Tax Deadlines', desc: 'Advance tax and ITR filing dates' },
  { key: 'goal_milestone', label: 'Goal Milestones', desc: 'When goals hit 25%, 50%, 75%, 100%' },
  { key: 'investment_maturity', label: 'Investment Maturity', desc: 'FD/RD maturity alerts' },
  { key: 'ai_insights', label: 'AI Insights', desc: 'Financial anomalies and recommendations' },
]

export function NotificationSettings({ userId: _ }: { userId: string }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(NOTIF_SETTINGS.map(s => [s.key, true])))

  return (
    <SectionCard title="Notification Preferences" description="Choose what alerts you receive">
      <div className="space-y-1">
        {NOTIF_SETTINGS.map(s => (
          <div key={s.key} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </div>
            <Toggle checked={enabled[s.key]} onChange={v => setEnabled(p => ({ ...p, [s.key]: v }))} />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}