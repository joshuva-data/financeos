'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Loader2, Link2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type IntegrationStatus = 'connected' | 'not_connected' | 'syncing' | 'error'

interface Integration {
  id: string; name: string; description: string; icon: string
  status: IntegrationStatus; lastSync?: string; category: string
}

const INTEGRATIONS: Integration[] = [
  { id: 'angel_one', name: 'Angel One', description: 'Sync stocks and portfolio from Angel One SmartAPI', icon: '📈', status: 'not_connected', category: 'Investments' },
  { id: 'indmoney', name: 'INDmoney', description: 'Import mutual funds and portfolio from INDmoney', icon: '💰', status: 'not_connected', category: 'Investments' },
  { id: 'gmail', name: 'Gmail', description: 'Parse bank emails, insurance alerts, and statements', icon: '📧', status: 'not_connected', category: 'Automation' },
  { id: 'csv', name: 'CSV Import', description: 'Import transactions from any bank CSV export', icon: '📄', status: 'connected', lastSync: '2026-05-28', category: 'Import' },
  { id: 'excel', name: 'Excel Import', description: 'Migrate from Finance Tracker and insurance sheets', icon: '📊', status: 'connected', lastSync: '2026-05-20', category: 'Import' },
  { id: 'pdf', name: 'PDF Parser', description: 'Extract data from bank and insurance statements', icon: '📑', status: 'not_connected', category: 'Import' },
]

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: 'Connected', color: 'text-positive bg-positive/10', icon: CheckCircle2 },
  not_connected: { label: 'Not Connected', color: 'text-muted-foreground bg-muted', icon: XCircle },
  syncing: { label: 'Syncing...', color: 'text-primary bg-primary/10', icon: RefreshCw },
  error: { label: 'Error', color: 'text-destructive bg-destructive/10', icon: XCircle },
}

export function IntegrationHub({ userId: _ }: { userId: string }) {
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [syncing, setSyncing] = useState<string | null>(null)

  const updateStatus = (id: string, status: IntegrationStatus) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const connect = async (id: string) => {
    updateStatus(id, 'syncing')
    await new Promise(r => setTimeout(r, 1500))
    updateStatus(id, 'connected')
  }

  const disconnect = (id: string) => updateStatus(id, 'not_connected')

  const sync = async (id: string) => {
    setSyncing(id); updateStatus(id, 'syncing')
    await new Promise(r => setTimeout(r, 2000))
    setSyncing(null); updateStatus(id, 'connected')
  }

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))]

  return (
    <div className="space-y-5">
      {categories.map(cat => (
        <SectionCard key={cat} title={cat} description="">
          <div className="space-y-2">
            {integrations.filter(i => i.category === cat).map(integ => {
              const cfg = STATUS_CONFIG[integ.status]
              const StatusIcon = cfg.icon
              return (
                <div key={integ.id} className="flex items-center gap-4 rounded-xl border border-border/40 px-4 py-3.5">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">{integ.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{integ.name}</p>
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md', cfg.color)}>
                        <StatusIcon className={cn('h-3 w-3', integ.status === 'syncing' && 'animate-spin')} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{integ.description}</p>
                    {integ.lastSync && integ.status === 'connected' && (
                      <p className="text-[10px] text-muted-foreground mt-1">Last sync: {new Date(integ.lastSync).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {integ.status === 'connected' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => sync(integ.id)} disabled={syncing === integ.id}>
                          {syncing === integ.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => disconnect(integ.id)}>
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {integ.status === 'not_connected' && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => connect(integ.id)}>
                        <Link2 className="h-3 w-3 mr-1.5" /> Connect
                      </Button>
                    )}
                    {integ.status === 'syncing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      ))}
    </div>
  )
}