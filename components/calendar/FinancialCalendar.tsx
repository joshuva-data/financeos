'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, List, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CalendarEvent } from '@/types/database'
import { fmtINR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

type ViewMode = 'month' | 'agenda'

const EVENT_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  emi_due:            { bg: 'bg-negative/10', text: 'text-negative', dot: 'bg-negative', label: 'EMI' },
  insurance_renewal:  { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'Insurance' },
  tax_deadline:       { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', label: 'Tax' },
  rent_due:           { bg: 'bg-sky-500/10', text: 'text-sky-500', dot: 'bg-sky-500', label: 'Rent' },
  receivable_due:     { bg: 'bg-positive/10', text: 'text-positive', dot: 'bg-positive', label: 'Collect' },
  goal_milestone:     { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary', label: 'Goal' },
  investment_maturity:{ bg: 'bg-violet-500/10', text: 'text-violet-500', dot: 'bg-violet-500', label: 'Maturity' },
  custom:             { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Event' },
}

interface FinancialCalendarProps { events: CalendarEvent[] }

export function FinancialCalendar({ events }: FinancialCalendarProps) {
  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState<string | null>(null)

  const year = current.getFullYear()
  const month = current.getMonth()

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      const d = e.event_date.split('T')[0]
      map[d] = [...(map[d] ?? []), e]
    })
    return map
  }, [events])

  const prevMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

  const cells: { date: string; day: number; isCurrentMonth: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    cells.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: `${year}-${String(month + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false })
  }

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : []

  const upcoming = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date))
    .filter(e => e.event_date >= todayStr && !e.is_completed).slice(0, 20)

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Financial Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted/50 p-1">
            {([['month', Calendar], ['agenda', LayoutList]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all', view === v ? 'bg-card shadow-sm border border-border/50 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-3.5 w-3.5" />{v === 'month' ? 'Month' : 'Agenda'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_STYLES).filter(([k]) => k !== 'custom').map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('h-2 w-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </div>
        ))}
      </div>

      {view === 'month' && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <button onClick={prevMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border/40">
            {DAYS.map(d => <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const dayEvents = eventsByDate[cell.date] ?? []
              const isToday = cell.date === todayStr
              const isSelected = cell.date === selected
              return (
                <div key={i} onClick={() => setSelected(cell.date === selected ? null : cell.date)}
                  className={cn('min-h-[80px] border-b border-r border-border/30 p-1.5 cursor-pointer hover:bg-muted/10 transition-colors last:border-r-0', !cell.isCurrentMonth && 'opacity-30', isSelected && 'bg-primary/5')}>
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => {
                      const cfg = EVENT_STYLES[e.event_type] ?? EVENT_STYLES.custom
                      return (
                        <div key={e.id} className={cn('rounded px-1 py-0.5 text-[9px] font-medium truncate', cfg.bg, cfg.text)}>
                          {e.title}
                        </div>
                      )
                    })}
                    {dayEvents.length > 2 && <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected day panel */}
      <AnimatePresence>
        {selected && selectedEvents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">{new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {selectedEvents.map(e => <CalendarEventRow key={e.id} event={e} />)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agenda view */}
      {view === 'agenda' && (
        <div className="space-y-2">
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            </div>
          ) : (
            upcoming.map((event, i) => {
              const showDate = i === 0 || upcoming[i - 1].event_date.split('T')[0] !== event.event_date.split('T')[0]
              return (
                <div key={event.id}>
                  {showDate && (
                    <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 py-1.5 mb-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  )}
                  <CalendarEventRow event={event} />
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function CalendarEventRow({ event }: { event: CalendarEvent }) {
  const cfg = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.custom
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', cfg.bg, 'border-transparent')}>
      <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{event.title}</p>
        {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
      </div>
      {event.amount && <p className={cn('text-sm font-semibold tabular-nums flex-shrink-0', cfg.text)}>{fmtINR(event.amount)}</p>}
      <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', cfg.text)}>{EVENT_STYLES[event.event_type]?.label ?? 'Event'}</Badge>
    </div>
  )
}