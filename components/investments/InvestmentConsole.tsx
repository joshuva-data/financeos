'use client'

import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, BarChart3, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddInvestmentForm } from '@/components/forms/AddInvestmentForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fmtINR } from '@/lib/utils/currency'

const TYPE_ICONS: Record<string, string> = {
  mutual_fund: '📊', stock: '📈', fd: '🏦', rd: '📅', ppf: '🏛️',
  nps: '🏛️', elss: '💰', gold: '🪙', real_estate: '🏠', crypto: '₿',
  bonds: '📜', etf: '📉', ulip: '🛡️', other: '💼',
}

interface Investment {
  id: string
  name: string
  investment_type: string
  invested_amount: number
  current_value: number | null
  units?: number | null
  nav?: number | null
  purchase_date?: string | null
  maturity_date?: string | null
  expected_return?: number | null
  folio_number?: string | null
}

interface Props { investments: Investment[] }

export function InvestmentConsole({ investments: initial }: Props) {
  const [investments, setInvestments] = useState(initial)
  const [showAdd, setShowAdd]         = useState(false)
  const [deleting, setDeleting]       = useState<string | null>(null)

  const totalInvested = investments.reduce((s, i) => s + i.invested_amount, 0)
  const totalCurrent  = investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalGain     = totalCurrent - totalInvested
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0
  const isGain        = totalGain >= 0

  const byType = investments.reduce<Record<string, number>>((acc, i) => {
    acc[i.investment_type] = (acc[i.investment_type] ?? 0) + (i.current_value ?? i.invested_amount)
    return acc
  }, {})

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment? This cannot be undone.')) return
    setDeleting(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('investments').delete().eq('id', id)
      if (error) { toast.error(error.message); return }
      setInvestments(prev => prev.filter(i => i.id !== id))
      toast.success('Investment deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Investments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{investments.length} investments</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Investment
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Invested',  value: fmtINR(totalInvested), color: 'text-white'       },
          { label: 'Current Value',   value: fmtINR(totalCurrent),  color: 'text-white'       },
          { label: 'Total Gain/Loss', value: `${isGain ? '+' : ''}${fmtINR(totalGain)}`, color: isGain ? 'text-green-400' : 'text-red-400' },
          { label: 'Return %',        value: `${isGain ? '+' : ''}${gainPct.toFixed(1)}%`, color: isGain ? 'text-green-400' : 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl p-4 space-y-2">
            <p className="metric-label">{item.label}</p>
            <p className={cn('text-xl font-bold tabular-nums', item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* By type */}
      {Object.keys(byType).length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">By Type</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(byType).map(([type, value]) => (
              <div key={type} className="rounded-lg bg-white/4 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{TYPE_ICONS[type] ?? '💼'}</span>
                  <span className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-semibold text-white tabular-nums">{fmtINR(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment list */}
      <div className="space-y-3">
        {investments.length === 0 ? (
          <div className="glass-card rounded-xl flex flex-col items-center justify-center py-16 gap-4">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">No investments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your mutual funds, stocks, FDs, and more</p>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add First Investment
            </Button>
          </div>
        ) : investments.map(inv => {
          const current  = inv.current_value ?? inv.invested_amount
          const gain     = current - inv.invested_amount
          const gainPct  = inv.invested_amount > 0 ? (gain / inv.invested_amount) * 100 : 0
          const positive = gain >= 0
          return (
            <div key={inv.id} className="glass-card rounded-xl p-5 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0">{TYPE_ICONS[inv.investment_type] ?? '💼'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{inv.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {inv.investment_type.replace('_', ' ')}
                      </Badge>
                      {inv.units && <span className="text-xs text-muted-foreground">{inv.units} units</span>}
                      {inv.folio_number && <span className="text-xs text-muted-foreground">Folio: {inv.folio_number}</span>}
                      {inv.maturity_date && (
                        <span className="text-xs text-muted-foreground">
                          Matures {new Date(inv.maturity_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base font-bold text-white tabular-nums">{fmtINR(current)}</p>
                    <p className="text-xs text-muted-foreground">invested: {fmtINR(inv.invested_amount)}</p>
                    <p className={cn('text-xs font-medium tabular-nums mt-0.5', positive ? 'text-green-400' : 'text-red-400')}>
                      {positive ? '↑' : '↓'} {fmtINR(Math.abs(gain))} ({Math.abs(gainPct).toFixed(1)}%)
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    disabled={deleting === inv.id}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {inv.expected_return && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground">
                  Expected return: <span className="text-green-400 font-medium">{inv.expected_return}% p.a.</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <AddInvestmentForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
