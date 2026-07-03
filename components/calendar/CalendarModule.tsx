'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, Shield, Users, Target, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fmtINR } from '@/lib/utils/currency'

interface CalendarEvent {
  date: string
  type: 'emi' | 'insurance' | 'receivable' | 'goal' | 'tithe'
  label: string
  amount?: number
  urgent?: boolean
}

const EVENT_CONFIG = {
  emi:        { icon: CreditCard, color: '#ef4444', bg: 'bg-red-500/15',    label: 'EMI'        },
  insurance:  { icon: Shield,     color: '#f59e0b', bg: 'bg-yellow-500/15', label: 'Renewal'    },
  receivable: { icon: Users,      color: '#3b82f6', bg: 'bg-blue-500/15',   label: 'Receivable' },
  goal:       { icon: Target,     color: '#10b981', bg: 'bg-green-500/15',  label: 'Goal'       },
  tithe:      { icon: Heart,      color: '#ec4899', bg: 'bg-pink-500/15',   label: 'Tithe'      },
}

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface Props {
  debts:       any[]
  insurance:   any[]
  receivables: any[]
  goals:       any[]
  tithe:       any[]
}

export function CalendarModule({ debts, insurance, receivables, goals, tithe }: Props) {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  // Build all events
  const events: CalendarEvent[] = [
    ...debts.filter(d => d.next_emi_date).map(d => ({
      date:   d.next_emi_date,
      type:   'emi' as const,
      label:  `${d.lender_name} EMI`,
      amount: d.emi_amount,
      urgent: new Date(d.next_emi_date).getTime() - Date.now() < 3 * 86400000,
    })),
    ...insurance.filter(p => p.renewal_date).map(p => ({
      date:   p.renewal_date,
      type:   'insurance' as const,
      label:  p.policy_name,
      amount: p.annual_premium,
      urgent: new Date(p.renewal_date).getTime() - Date.now() < 7 * 86400000,
    })),
    ...receivables.filter(r => r.due_date).map(r => ({
      date:   r.due_date,
      type:   'receivable' as const,
      label:  `${r.from_name}`,
      amount: r.balance_due,
      urgent: r.status === 'overdue',
    })),
    ...goals.filter(g => g.target_date).map(g => ({
      date:   g.target_date,
      type:   'goal' as const,
      label:  g.name,
      amount: g.target_amount - g.current_amount,
    })),
  ]

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date?.startsWith(dateStr))
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []

  // Upcoming events (next 30 days)
  const upcoming = events
    .filter(e => {
      const d = new Date(e.date)
      return d >= today && d <= new Date(Date.now() + 30 * 86400000)
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Financial Calendar</h1>
        <p className="text-xs text-muted-foreground mt-0.5">EMIs, renewals, goals, and receivables at a glance</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Calendar grid */}
        <div className="xl:col-span-2 glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5"
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-white/5"
                onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5"
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayEvents = getEventsForDay(day)
              const isToday   = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const isSelected = day === selectedDay
              const hasUrgent  = dayEvents.some(e => e.urgent)
              return (
                <button key={day} onClick={() => setSelectedDay(day)}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative',
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday    ? 'border border-blue-500 text-blue-400' :
                    dayEvents.length > 0 ? 'bg-white/4 text-white hover:bg-white/8' :
                    'text-muted-foreground hover:bg-white/4 hover:text-white'
                  )}>
                  <span className="font-medium">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <div key={i} className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: EVENT_CONFIG[e.type].color }} />
                      ))}
                    </div>
                  )}
                  {hasUrgent && (
                    <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day events */}
          {selectedDay && (
            <div className="border-t border-white/6 pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                {selectedEvents.length > 0
                  ? `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''} on ${MONTHS[month]} ${selectedDay}`
                  : `No events on ${MONTHS[month]} ${selectedDay}`
                }
              </p>
              <div className="space-y-2">
                {selectedEvents.map((e, i) => {
                  const cfg = EVENT_CONFIG[e.type]
                  return (
                    <div key={i} className={cn('flex items-center gap-3 rounded-lg p-3', cfg.bg)}>
                      <cfg.icon className="h-4 w-4 flex-shrink-0" style={{ color: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{e.label}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{cfg.label}</p>
                      </div>
                      {e.amount && (
                        <p className="text-xs font-semibold text-white">{fmtINR(e.amount)}</p>
                      )}
                      {e.urgent && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Urgent</Badge>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Upcoming (30 days)</h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No events in the next 30 days</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 8).map((e, i) => {
                  const cfg  = EVENT_CONFIG[e.type]
                  const days = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/4 transition-colors">
                      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                        <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{e.label}</p>
                        <p className="text-[10px] text-muted-foreground">{e.amount ? fmtINR(e.amount) : ''}</p>
                      </div>
                      <span className={cn('text-[10px] font-medium flex-shrink-0',
                        days <= 3 ? 'text-red-400' : days <= 7 ? 'text-yellow-400' : 'text-muted-foreground')}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Legend</p>
            {Object.entries(EVENT_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}