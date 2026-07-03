'use client'

import { useState, useRef } from 'react'
import { Upload, Zap, CheckCircle, Clock, AlertCircle, RefreshCw,
  FileSpreadsheet, Mail, Link2, BarChart3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fmtDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-gray-500',  icon: Clock       },
  processing: { label: 'Processing', color: 'text-blue-500',  icon: RefreshCw   },
  completed:  { label: 'Completed',  color: 'text-green-600', icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'text-red-500',   icon: AlertCircle },
  partial:    { label: 'Partial',    color: 'text-yellow-600',icon: AlertCircle },
}

const CONNECTORS = [
  {
    id: 'excel',
    label: 'Excel / CSV Import',
    icon: FileSpreadsheet,
    color: 'text-green-600',
    description: 'Upload your Finance Tracker, insurance, debt, and receivable sheets',
    status: 'available',
    setupNote: null,
  },
  {
    id: 'gmail',
    label: 'Gmail Parser',
    icon: Mail,
    color: 'text-red-500',
    description: 'Auto-parse bank alerts, salary credits, and transaction emails',
    status: 'setup_required',
    setupNote: 'Requires Google OAuth setup in Supabase Auth settings',
  },
  {
    id: 'angel_one',
    label: 'Angel One',
    icon: BarChart3,
    color: 'text-orange-500',
    description: 'Sync your stock portfolio and trade history via Smart API',
    status: 'setup_required',
    setupNote: 'Requires Angel One Smart API key from your Angel One account',
  },
  {
    id: 'indmoney',
    label: 'INDmoney',
    icon: Link2,
    color: 'text-blue-500',
    description: 'Sync mutual funds and net worth from INDmoney',
    status: 'coming_soon',
    setupNote: 'INDmoney public API not yet available',
  },
]

interface Props { jobs: any[]; providers: any[]; userId: string }

export function AutomationModule({ jobs: initialJobs, providers, userId }: Props) {
  const [tab, setTab]   = useState('import')
  const [jobs, setJobs] = useState(initialJobs)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const completedJobs  = jobs.filter(j => j.status === 'completed')
  const failedJobs     = jobs.filter(j => j.status === 'failed')
  const totalImported  = completedJobs.reduce((s, j) => s + (j.records_imported ?? 0), 0)

  const handleFile = async (file: File) => {
    if (!file) return
    const allowed = ['.xlsx', '.xls', '.csv']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error('Only Excel (.xlsx, .xls) and CSV files are supported')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()

      // Create import job record
      const { data: job, error } = await supabase.from('import_jobs').insert({
        user_id:     userId,
        source_type: ext === '.csv' ? 'csv' : 'excel',
        source_name: file.name,
        status:      'processing',
      }).select().single()

      if (error) { toast.error(error.message); return }

      // Upload file to storage
      const path = `${userId}/imports/${Date.now()}-${file.name}`
      await supabase.storage.from('statement-uploads').upload(path, file)

      // Update job to completed (actual parsing would happen in a server function)
      await supabase.from('import_jobs').update({
        status: 'completed',
        records_imported: 0,
      }).eq('id', job.id)

      const updatedJob = { ...job, status: 'completed', records_imported: 0 }
      setJobs(prev => [updatedJob, ...prev])

      toast.success(`${file.name} uploaded! Manual data entry still required for now — automated parsing coming soon.`)
    } catch (e) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Automation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jobs.length} jobs · {totalImported} records imported
          </p>
        </div>
        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
          <Zap className="h-3 w-3 mr-1" /> Smart Import
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Jobs', value: String(jobs.length),           icon: RefreshCw,  color: 'text-blue-600'  },
          { label: 'Completed',  value: String(completedJobs.length),  icon: CheckCircle,color: 'text-green-600' },
          { label: 'Failed',     value: String(failedJobs.length),     icon: AlertCircle,color: failedJobs.length > 0 ? 'text-red-500' : 'text-gray-400' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-4 space-y-4">
          <input ref={fileRef} type="file" className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={cn(
              'rounded-xl border-2 border-dashed p-10 text-center space-y-4 transition-colors cursor-pointer',
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-border/60 bg-muted/20 hover:border-blue-300 hover:bg-muted/30'
            )}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                {uploading
                  ? <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                  : <Upload className="h-6 w-6 text-blue-600" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {uploading ? 'Uploading…' : 'Drop your Excel or CSV file here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx, .xls, .csv · Click to browse
                </p>
              </div>
              {!uploading && (
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Browse Files
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Supported File Types
            </p>
            {[
              { label: 'Finance Tracker Excel',    ext: '.xlsx' },
              { label: 'Bank Statement CSV',        ext: '.csv'  },
              { label: 'Insurance Policy Sheet',    ext: '.xlsx' },
              { label: 'Investment Statement',      ext: '.xlsx' },
              { label: 'Salary Slip Export',        ext: '.xlsx' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{item.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{item.ext}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="connectors" className="mt-4 space-y-3">
          {CONNECTORS.map(connector => (
            <div key={connector.id}
              className={cn('rounded-xl border border-border/50 bg-card p-4',
                connector.status === 'coming_soon' && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <connector.icon className={cn('h-5 w-5 flex-shrink-0', connector.color)} />
                  <div>
                    <p className="text-sm font-semibold">{connector.label}</p>
                    <p className="text-xs text-muted-foreground">{connector.description}</p>
                    {connector.setupNote && (
                      <p className="text-xs text-amber-600 mt-1">⚠ {connector.setupNote}</p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {connector.status === 'available' && (
                    <Button size="sm" variant="outline"
                      onClick={() => { fileRef.current?.click(); setTab('import') }}>
                      Use
                    </Button>
                  )}
                  {connector.status === 'setup_required' && (
                    <Badge variant="secondary" className="text-xs text-amber-700 bg-amber-50">
                      Setup Required
                    </Badge>
                  )}
                  {connector.status === 'coming_soon' && (
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">How to set up Gmail / Angel One</p>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>Gmail:</strong> Go to Supabase → Auth → Providers → Enable Google → add OAuth credentials from Google Console</p>
              <p><strong>Angel One:</strong> Login to Angel One → My Profile → API Access → Generate Smart API key → add as ANGEL_ONE_API_KEY in .env.local</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="text-3xl">📋</div>
              <p className="text-sm text-muted-foreground">No import jobs yet</p>
            </div>
          ) : jobs.map((job: any) => {
            const cfg = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG.pending
            return (
              <div key={job.id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{job.source_name ?? job.source_type}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">{job.source_type}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(job.created_at)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn('text-xs', cfg.color)}>
                    <cfg.icon className="h-3 w-3 mr-1" />{cfg.label}
                  </Badge>
                  {job.records_imported > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{job.records_imported} records</p>
                  )}
                </div>
              </div>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}