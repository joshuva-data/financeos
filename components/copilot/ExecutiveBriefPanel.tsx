'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, ShieldAlert, Lightbulb, CalendarClock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExecutiveBrief, Recommendation } from '@/lib/ai/types'

function fmtINR(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function ExecutiveBriefPanel() {
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/copilot/brief')
      if (!res.ok) throw new Error('Failed to load brief')
      const data = await res.json()
      setBrief(data.brief)
      setRecommendations(data.recommendations ?? [])
    } catch {
      setError('Could not load your Executive Brief. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Building your brief…
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-muted-foreground">{error ?? 'No data available yet.'}</p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Headline */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Executive Financial Brief</p>
            <h2 className="text-base font-semibold leading-snug">{brief.headline}</h2>
            <p className="text-sm text-muted-foreground mt-2">{brief.summary}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums">{brief.healthScore}</p>
            <p className="text-[10px] text-muted-foreground">health score</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="mt-3 h-7 px-2 text-xs" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Strengths / Risks / Opportunities */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BriefColumn icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} title="Strengths" items={brief.strengths} empty="None detected yet" />
        <BriefColumn icon={<ShieldAlert className="h-4 w-4 text-red-500" />} title="Risks" items={brief.risks} empty="No major risks" />
        <BriefColumn icon={<Lightbulb className="h-4 w-4 text-amber-500" />} title="Opportunities" items={brief.opportunities} empty="Nothing new right now" />
      </div>

      {/* Upcoming events */}
      {brief.upcomingEvents.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Upcoming events</h3>
          </div>
          <div className="space-y-2">
            {brief.upcomingEvents.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span>{e.label}</span>
                <span className="text-muted-foreground text-xs">
                  {e.amount ? `${fmtINR(e.amount)} · ` : ''}{e.daysLeft === 0 ? 'today' : `in ${e.daysLeft}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map(r => (
              <div key={r.id} className="rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{r.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{r.confidence} confidence</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{r.why}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-xs font-medium text-primary">→ {r.nextAction}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Sources: {r.sources.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BriefColumn({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
              <span className="text-foreground/40">•</span> {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
