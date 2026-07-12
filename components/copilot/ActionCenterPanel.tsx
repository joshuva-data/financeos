'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, X, Sparkles, FileText, Bell, Zap, Target, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type CopilotAction = Database['public']['Tables']['copilot_actions']['Row']

const ACTION_ICON: Record<string, React.ReactNode> = {
  categorize_transactions: <Sparkles className="h-4 w-4" />,
  create_reminder:         <Bell className="h-4 w-4" />,
  generate_report:         <FileText className="h-4 w-4" />,
  suggest_automation:      <Zap className="h-4 w-4" />,
  update_goal:             <Target className="h-4 w-4" />,
  flag_for_review:         <Flag className="h-4 w-4" />,
}

export function ActionCenterPanel() {
  const [actions, setActions] = useState<CopilotAction[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/copilot/actions?status=proposed')
      const data = await res.json()
      setActions(data.actions ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const resolve = async (id: string, decision: 'confirm' | 'reject') => {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/copilot/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) setActions(prev => prev.filter(a => a.id !== id))
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading pending actions…
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="text-sm font-medium">No pending actions</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          When the Copilot spots something it can do for you — a reminder, a report, an automation — it'll show up here for your confirmation before anything runs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-8">
      {actions.map(action => (
        <div key={action.id} className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {ACTION_ICON[action.action_type] ?? <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{action.title}</p>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full shrink-0',
                  action.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-600' :
                  action.confidence === 'Medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                )}>{action.confidence} confidence</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
              <p className="text-xs text-muted-foreground/80 mt-1.5 italic">Why: {action.why}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Sources: {action.sources.join(', ')}</p>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs"
                  disabled={resolvingId === action.id}
                  onClick={() => resolve(action.id, 'confirm')}
                >
                  {resolvingId === action.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs"
                  disabled={resolvingId === action.id}
                  onClick={() => resolve(action.id, 'reject')}
                >
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
