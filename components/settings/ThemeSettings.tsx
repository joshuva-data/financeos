'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const modes = [
    { id: 'light', label: 'Light', icon: Sun, desc: 'Clean white interface' },
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { id: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS' },
  ]
  return (
    <SectionCard title="Appearance" description="Customize how FinanceOS looks">
      <div className="grid grid-cols-3 gap-3">
        {modes.map(m => (
          <button key={m.id} onClick={() => setTheme(m.id)}
            className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 transition-all', theme === m.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border')}>
            <m.icon className={cn('h-5 w-5', theme === m.id ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-medium', theme === m.id ? 'text-primary' : 'text-foreground')}>{m.label}</span>
            <span className="text-xs text-muted-foreground text-center">{m.desc}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  )
}