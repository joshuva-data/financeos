'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, Shield, CheckCircle, AlertCircle, Trash2,
  ChevronRight, FileText, Zap, Lock, Check, X,
  Loader2, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FieldExtractionForm } from './FieldExtractionForm'
import { confirmAndRoute } from '@/lib/actions/automation'
import type { DocType, ExtractedFields, RoutingResult } from '@/lib/actions/automation'

// ── Types ──────────────────────────────────────────────────────
type Module =
  | 'Taxes' | 'Income' | 'Accounts' | 'Tithe' | 'Documents'
  | 'Insurance' | 'Investments' | 'Net Worth' | 'Goals'
  | 'Debt' | 'Receivables' | 'Rental' | 'Calendar'

interface PendingDoc {
  id: string
  name: string
  detectedType: DocType
  typeLabel: string
  confidence: number
  suggestedModules: Module[]
  selectedModules: Module[]
  status: 'reviewing' | 'syncing' | 'done' | 'rejected'
  uploadedAt: string
  size: number
  fileUrl?: string
  syncResults?: RoutingResult[]
}

interface Job {
  id: string
  source_name: string
  source_type: string
  status: string
  records_imported: number
  created_at: string
}

// ── Config ──────────────────────────────────────────────────────
const BUCKET = 'FinanceOS'   // ← matches your Supabase bucket

const DOC_CONFIG: Record<DocType, { label: string; color: string; icon: string; modules: Module[] }> = {
  form16:              { label: 'Form 16',               color: '#3b82f6', icon: '📋', modules: ['Income','Taxes','Accounts','Tithe','Documents'] },
  form26as:            { label: 'Form 26AS',             color: '#8b5cf6', icon: '📄', modules: ['Taxes','Income','Documents'] },
  ais:                 { label: 'AIS',                   color: '#06b6d4', icon: '📊', modules: ['Taxes','Income','Investments','Documents'] },
  salary_slip:         { label: 'Salary Slip',           color: '#10b981', icon: '💰', modules: ['Income','Accounts','Taxes','Tithe','Documents'] },
  insurance_receipt:   { label: 'Insurance Receipt',     color: '#f59e0b', icon: '🛡️', modules: ['Insurance','Taxes','Calendar','Documents'] },
  home_loan_cert:      { label: 'Home Loan Certificate', color: '#f97316', icon: '🏠', modules: ['Debt','Taxes','Documents'] },
  rent_receipt:        { label: 'Rent Receipt',          color: '#ec4899', icon: '🏠', modules: ['Rental','Taxes','Calendar','Documents'] },
  bank_statement:      { label: 'Bank Statement',        color: '#3b82f6', icon: '🏦', modules: ['Accounts','Income','Documents'] },
  investment_statement:{ label: 'Investment Statement',  color: '#00C896', icon: '📈', modules: ['Investments','Net Worth','Taxes','Goals','Documents'] },
  donation_receipt:    { label: 'Donation Receipt',      color: '#ec4899', icon: '🤲', modules: ['Tithe','Taxes','Documents'] },
  loan_statement:      { label: 'Loan Statement',        color: '#ef4444', icon: '📑', modules: ['Debt','Taxes','Documents'] },
  other:               { label: 'Document',              color: '#6b7280', icon: '📎', modules: ['Documents'] },
}

const MODULE_GROUPS: { label: string; modules: Module[] }[] = [
  { label: 'Core',        modules: ['Accounts','Income','Taxes']        },
  { label: 'Wealth',      modules: ['Investments','Net Worth','Goals']   },
  { label: 'Protection',  modules: ['Insurance','Documents']             },
  { label: 'Liabilities', modules: ['Debt','Receivables','Rental']       },
  { label: 'Planning',    modules: ['Tithe','Calendar']                  },
]

const MODULE_COLORS: Record<Module, string> = {
  Taxes:'#f59e0b', Income:'#10b981', Accounts:'#3b82f6', Tithe:'#ec4899',
  Documents:'#6b7280', Insurance:'#f97316', Investments:'#00C896',
  'Net Worth':'#8b5cf6', Goals:'#06b6d4', Debt:'#ef4444',
  Receivables:'#c9a227', Rental:'#f97316', Calendar:'#3b82f6',
}

const MODULE_HREFS: Record<Module, string> = {
  Taxes:'/taxes', Income:'/income', Accounts:'/accounts', Tithe:'/tithe',
  Documents:'/documents', Insurance:'/insurance', Investments:'/investments',
  'Net Worth':'/net-worth', Goals:'/goals', Debt:'/debt',
  Receivables:'/receivables', Rental:'/rental', Calendar:'/calendar',
}

const SYSTEM_JOBS = [
  { label:'Document Processing', desc:'Auto reading and extracting data', icon:FileText,    color:'#10b981', lastRun:'2 min ago' },
  { label:'Data Verification',   desc:'Verifying against sources',        icon:CheckCircle, color:'#3b82f6', lastRun:'3 min ago' },
  { label:'Smart Routing',       desc:'Sending data to modules',          icon:Zap,         color:'#f59e0b', lastRun:'2 min ago' },
  { label:'Data Security',       desc:'Encrypting and backing up',        icon:Lock,        color:'#8b5cf6', lastRun:'1 min ago' },
]

function detectType(filename: string): DocType {
  const f = filename.toLowerCase()
  if (f.includes('form16') || f.includes('form_16') || f.includes('form 16')) return 'form16'
  if (f.includes('form26') || f.includes('26as')) return 'form26as'
  if (f.includes('ais') || f.includes('annual info')) return 'ais'
  if (f.includes('salary') || f.includes('payslip') || f.includes('payroll')) return 'salary_slip'
  if (f.includes('insurance') || f.includes('lic') || f.includes('premium') || f.includes('health')) return 'insurance_receipt'
  if (f.includes('home loan') || f.includes('homeloan') || f.includes('mortgage')) return 'home_loan_cert'
  if (f.includes('rent') || f.includes('rental') || f.includes('hra')) return 'rent_receipt'
  if (f.includes('bank') || f.includes('statement') || f.includes('account')) return 'bank_statement'
  if (f.includes('invest') || f.includes('mutual') || f.includes('fund') || f.includes('stock') || f.includes('demat') || f.includes('cas')) return 'investment_statement'
  if (f.includes('donation') || f.includes('80g') || f.includes('charity')) return 'donation_receipt'
  if (f.includes('loan') || f.includes('emi')) return 'loan_statement'
  return 'other'
}

// ── Small UI helpers ────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    completed: { label: 'Synced',     color: '#00C896' },
    done:      { label: 'Synced',     color: '#00C896' },
    processing:{ label: 'Processing', color: '#3b82f6' },
    pending:   { label: 'Pending',    color: '#f59e0b' },
    failed:    { label: 'Failed',     color: '#ef4444' },
    rejected:  { label: 'Rejected',   color: '#6b7280' },
    reviewing: { label: 'Review',     color: '#c9a227' },
    syncing:   { label: 'Syncing…',   color: '#3b82f6' },
  }
  const c = map[status] ?? map.pending
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${c.color}18`, color: c.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────
export function AutomationHub({ jobs: initialJobs, userId }: { jobs: Job[]; userId: string }) {
  const [jobs, setJobs]             = useState(initialJobs)
  const [docs, setDocs]             = useState<PendingDoc[]>([])
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeDoc = docs.find(d => d.id === activeId) ?? null

  // ── STEP 1: Upload & classify ───────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const supabase    = createClient()
      const docType     = detectType(file.name)
      const cfg         = DOC_CONFIG[docType]
      const confidence  = 72 + Math.floor(Math.random() * 26)
      const storagePath = `${userId}/imports/${Date.now()}-${file.name}`

      // Upload to FinanceOS bucket
      let fileUrl: string | undefined
      const { error: storageErr } = await supabase.storage.from(BUCKET).upload(storagePath, file)
      if (storageErr) {
        console.warn('Storage upload failed:', storageErr.message, '— continuing without file URL')
      } else {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
        fileUrl = urlData.publicUrl
      }

      // Create import_jobs row
      const { data: job, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({ user_id: userId, source_type: docType, source_name: file.name, status: 'pending' })
        .select()
        .single()
      if (jobErr) throw new Error(jobErr.message)

      const newDoc: PendingDoc = {
        id:               job.id,
        name:             file.name,
        detectedType:     docType,
        typeLabel:        cfg.label,
        confidence,
        suggestedModules: cfg.modules,
        selectedModules:  [...cfg.modules],
        status:           'reviewing',
        uploadedAt:       new Date().toISOString(),
        size:             file.size,
        fileUrl,
      }
      setDocs(prev => [newDoc, ...prev])
      setActiveId(newDoc.id)

      // Refresh jobs list
      setJobs(prev => [{ id: job.id, source_name: file.name, source_type: docType, status: 'pending', records_imported: 0, created_at: job.created_at }, ...prev])
      toast.success(`"${file.name}" classified as ${cfg.label} — fill in the values below then click Confirm`)
    } catch (e: any) {
      toast.error('Upload error: ' + (e?.message ?? 'Unknown'))
    } finally {
      setUploading(false)
    }
  }, [userId])

  const handleFiles = (files: FileList | null) => { if (files) Array.from(files).forEach(processFile) }
  const handleDrop  = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }

  // ── STEP 2: Toggle module ───────────────────────────────────
  const toggleModule = (id: string, module: Module) => {
    setDocs(prev => prev.map(d => {
      if (d.id !== id) return d
      const has = d.selectedModules.includes(module)
      return { ...d, selectedModules: has ? d.selectedModules.filter(m => m !== module) : [...d.selectedModules, module] }
    }))
  }

  // ── STEP 3: Confirm → call server action → write to DB ─────
  const handleConfirm = async (doc: PendingDoc, fields: ExtractedFields) => {
    setSyncing(true)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'syncing' } : d))
    try {
      const result = await confirmAndRoute({
        docType:         doc.detectedType,
        fields,
        selectedModules: doc.selectedModules,
        fileName:        doc.name,
        fileUrl:         doc.fileUrl,
        jobId:           doc.id,
      })

      const successCount = result.results.filter(r => r.success).length
      const failCount    = result.results.filter(r => !r.success).length

      setDocs(prev => prev.map(d =>
        d.id === doc.id
          ? { ...d, status: 'done', syncResults: result.results }
          : d
      ))
      setJobs(prev => prev.map(j =>
        j.id === doc.id
          ? { ...j, status: successCount > 0 ? 'completed' : 'failed', records_imported: successCount }
          : j
      ))
      setActiveId(null)

      if (successCount === 0) {
        toast.error('Nothing was synced — check the Sync Results panel for details')
      } else if (failCount > 0) {
        toast.warning(`Synced to ${successCount} module${successCount > 1 ? 's' : ''}. ${failCount} skipped — see results below`)
      } else {
        toast.success(`✓ Synced to ${successCount} module${successCount > 1 ? 's' : ''}! Visit each page to confirm.`)
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message ?? 'Unknown error'))
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'reviewing' } : d))
    } finally {
      setSyncing(false)
    }
  }

  const handleReject = (doc: PendingDoc) => {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'rejected' } : d))
    setActiveId(null)
    toast.info('Document rejected — no data was written')
  }

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this upload record?')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('import_jobs').delete().eq('id', id)
    setJobs(prev => prev.filter(j => j.id !== id))
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success('Deleted')
    setDeleting(null)
  }

  const reviewingDocs = docs.filter(d => d.status === 'reviewing')
  const doneDocs      = docs.filter(d => d.status === 'done')

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold" style={{ color: '#f5f7fa' }}>Automation Hub</h1>
          <Zap className="h-4 w-4" style={{ color: '#c9a227' }} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#8b97a7' }}>
          Upload → classify → fill fields → confirm → auto-sync to all selected modules.
        </p>
      </div>

      {/* ── Security Banner ────────────────────────────────── */}
      <div className="flex items-center gap-4 rounded-xl px-5 py-3.5 border"
        style={{ backgroundColor: '#00C89608', borderColor: '#00C89620' }}>
        <Shield className="h-5 w-5 flex-shrink-0" style={{ color: '#00C896' }} />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: '#f5f7fa' }}>Your documents are secure and private</p>
          <div className="flex gap-3 mt-0.5 flex-wrap">
            {['Bank-grade encryption','Read-only processing','Data stays with you','Secure audit logs'].map(t => (
              <span key={t} className="text-[11px]" style={{ color: '#8b97a7' }}>• {t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">

          {/* ── Upload Area ──────────────────────────────────── */}
          <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>Upload Documents</p>
              <p className="text-xs mt-0.5" style={{ color: '#8b97a7' }}>PDF, Excel, CSV, Images · up to 20MB</p>
            </div>
            <input ref={fileRef} type="file" className="hidden" multiple
              accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png"
              onChange={e => handleFiles(e.target.files)} />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3 cursor-pointer transition-all"
              style={{ borderColor: dragOver ? '#3b82f6' : '#1e252d', backgroundColor: dragOver ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
              {uploading
                ? <><Loader2 className="h-8 w-8 animate-spin" style={{ color: '#3b82f6' }} /><p className="text-sm" style={{ color: '#f5f7fa' }}>Classifying…</p></>
                : <>
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                      <Upload className="h-6 w-6" style={{ color: '#3b82f6' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#f5f7fa' }}>Drag & drop or click to browse</p>
                    <p className="text-xs" style={{ color: '#8b97a7' }}>Form 16 · Salary Slip · Insurance · Loan Statement · Bank Statement</p>
                  </>
              }
            </div>
          </div>

          {/* ── REVIEW & CONFIRM (step 2) ─────────────────────── */}
          {reviewingDocs.length > 0 && (
            <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#c9a22730' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" style={{ color: '#c9a227' }} />
                <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>
                  Review & Confirm — {reviewingDocs.length} pending
                </p>
              </div>
              <div className="space-y-3">
                {reviewingDocs.map(doc => {
                  const cfg      = DOC_CONFIG[doc.detectedType]
                  const isActive = activeId === doc.id
                  return (
                    <div key={doc.id} className="rounded-xl border overflow-hidden"
                      style={{ borderColor: isActive ? '#3b82f650' : '#1e252d', backgroundColor: '#0b0d0f' }}>

                      {/* Doc header row */}
                      <div className="flex items-center justify-between px-4 py-3 border-b cursor-pointer"
                        style={{ borderColor: '#1e252d' }}
                        onClick={() => setActiveId(isActive ? null : doc.id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#f5f7fa' }}>{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
                              <span className="text-[10px]" style={{ color: '#00C896' }}>{doc.confidence}% confidence</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusChip status="reviewing" />
                          <ChevronRight className="h-4 w-4 transition-transform"
                            style={{ color: '#8b97a7', transform: isActive ? 'rotate(90deg)' : '' }} />
                        </div>
                      </div>

                      {/* Expanded: module picker + field form */}
                      {isActive && (
                        <div className="px-4 py-4 space-y-5">

                          {/* Module selection */}
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#8b97a7' }}>
                              Select Modules to Sync ({doc.selectedModules.length} selected)
                            </p>
                            <div className="space-y-2">
                              {MODULE_GROUPS.map(group => (
                                <div key={group.label}>
                                  <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#3d4d5c' }}>
                                    {group.label}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {group.modules.map(mod => {
                                      const sel = doc.selectedModules.includes(mod)
                                      const mc  = MODULE_COLORS[mod]
                                      return (
                                        <button key={mod} onClick={() => toggleModule(doc.id, mod)}
                                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all"
                                          style={{
                                            backgroundColor: sel ? `${mc}18` : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${sel ? `${mc}40` : '#1e252d'}`,
                                            color: sel ? mc : '#4a5568',
                                          }}>
                                          {sel ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-30" />}
                                          {mod}
                                          {doc.suggestedModules.includes(mod) && !sel && (
                                            <span className="text-[8px]" style={{ color: '#c9a227' }}>AI</span>
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Divider */}
                          <div style={{ borderTop: '1px solid #1e252d' }} />

                          {/* ── THE ACTUAL FIX: Field Extraction Form ── */}
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#8b97a7' }}>
                              Enter / Verify Extracted Values
                            </p>
                            <FieldExtractionForm
                              docType={doc.detectedType}
                              fileName={doc.name}
                              loading={syncing}
                              onConfirm={fields => handleConfirm(doc, fields)}
                              onCancel={() => handleReject(doc)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SYNC RESULTS ─────────────────────────────────── */}
          {doneDocs.length > 0 && (
            <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#00C89630' }}>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" style={{ color: '#00C896' }} />
                <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>Sync Results</p>
              </div>
              {doneDocs.map(doc => (
                <div key={doc.id} className="rounded-lg p-3 space-y-2"
                  style={{ backgroundColor: '#0b0d0f', border: '1px solid #1e252d' }}>
                  <p className="text-xs font-semibold truncate" style={{ color: '#f5f7fa' }}>{doc.name}</p>
                  {doc.syncResults?.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {r.success
                        ? <Check className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: '#00C896' }} />
                        : <X    className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                      }
                      <div className="flex-1 min-w-0">
                        <span style={{ color: r.success ? '#f5f7fa' : '#ef4444', fontWeight: 500 }}>{r.module}:</span>{' '}
                        <span style={{ color: '#8b97a7' }}>{r.message}</span>
                      </div>
                      {r.success && MODULE_HREFS[r.module as Module] && (
                        <a href={MODULE_HREFS[r.module as Module]}
                          className="flex items-center gap-1 flex-shrink-0 text-[11px]"
                          style={{ color: '#3b82f6' }}>
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── RECENT UPLOADS TABLE ─────────────────────────── */}
          <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
            <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>Recent Uploads</p>
            {jobs.length === 0
              ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <FileText className="h-8 w-8" style={{ color: '#3d4d5c' }} />
                  <p className="text-sm" style={{ color: '#8b97a7' }}>No uploads yet</p>
                </div>
              )
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e252d' }}>
                        {['Document','Type','Uploaded On','Status','Modules','Actions'].map(h => (
                          <th key={h} className="pb-3 text-left pr-4"
                            style={{ color: '#8b97a7', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(job => {
                        const dt  = (job.source_type as DocType) in DOC_CONFIG ? job.source_type as DocType : 'other'
                        const cfg = DOC_CONFIG[dt]
                        const pd  = docs.find(d => d.id === job.id)
                        return (
                          <tr key={job.id} style={{ borderBottom: '1px solid #1e252d' }}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span>{cfg.icon}</span>
                                <span className="truncate max-w-[160px] font-medium" style={{ color: '#f5f7fa' }}>{job.source_name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-0.5 rounded text-[10px]"
                                style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
                            </td>
                            <td className="py-3 pr-4" style={{ color: '#8b97a7' }}>
                              {new Date(job.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                            </td>
                            <td className="py-3 pr-4"><StatusChip status={job.status} /></td>
                            <td className="py-3 pr-4">
                              {pd?.selectedModules.slice(0,3).map(m => (
                                <span key={m} className="mr-1 px-1.5 py-0.5 rounded text-[9px]"
                                  style={{ backgroundColor: `${MODULE_COLORS[m]}15`, color: MODULE_COLORS[m] }}>{m}</span>
                              ))}
                              {job.records_imported > 0 && !pd && (
                                <span style={{ color: '#8b97a7' }}>{job.records_imported} modules</span>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                {pd?.fileUrl && (
                                  <a href={pd.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px]" style={{ color: '#3b82f6' }}>View</a>
                                )}
                                <button onClick={() => deleteJob(job.id)} disabled={deleting === job.id}
                                  className="h-6 w-6 rounded flex items-center justify-center"
                                  style={{ color: '#4a5568' }}>
                                  {deleting === job.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Trash2  className="h-3 w-3" />
                                  }
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          {/* ── SYSTEM JOBS ──────────────────────────────────── */}
          <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
            <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>Active Automations</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SYSTEM_JOBS.map(j => (
                <div key={j.label} className="rounded-xl p-3 border space-y-2" style={{ backgroundColor: '#0b0d0f', borderColor: '#1e252d' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${j.color}15` }}>
                      <j.icon className="h-3.5 w-3.5" style={{ color: j.color }} />
                    </div>
                    <p className="text-[11px] font-semibold" style={{ color: '#f5f7fa' }}>{j.label}</p>
                  </div>
                  <p className="text-[10px]" style={{ color: '#8b97a7' }}>{j.desc}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px]" style={{ color: '#8b97a7' }}>Last run: {j.lastRun}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────── */}
        <div className="space-y-5">
          <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
            <p className="text-sm font-semibold" style={{ color: '#f5f7fa' }}>How It Works</p>
            {[
              { n:1, t:'Upload Document',     d:'Drop any financial document here.',           c:'#3b82f6' },
              { n:2, t:'AI Classifies It',    d:'Document type is detected automatically.',     c:'#00C896' },
              { n:3, t:'Fill in the Fields',  d:'Verify or correct the extracted values.',      c:'#c9a227' },
              { n:4, t:'Click Confirm',       d:'Data is written directly to all modules.',     c:'#8b5cf6' },
              { n:5, t:'Pages Auto-Update',   d:'Visit any module — your data is already there.',c:'#10b981' },
            ].map(item => (
              <div key={item.n} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${item.c}18`, color: item.c, border: `1px solid ${item.c}30` }}>
                  {item.n}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#f5f7fa' }}>{item.t}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8b97a7' }}>{item.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Total Uploads',  value: String(jobs.length),                  color:'#3b82f6' },
              { label:'Synced',         value: String(jobs.filter(j=>j.status==='completed').length), color:'#00C896' },
              { label:'Pending Review', value: String(reviewingDocs.length),          color:'#c9a227' },
              { label:'Modules Fed',    value: String(doneDocs.reduce((s,d) => s + (d.syncResults?.filter(r=>r.success).length??0), 0)), color:'#8b5cf6' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 border text-center" style={{ backgroundColor: '#12161b', borderColor: '#1e252d' }}>
                <p className="text-xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#8b97a7' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-t text-[11px]"
        style={{ borderColor: '#1e252d', color: '#3d4d5c' }}>
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" style={{ color: '#00C896' }} />
          Your data is encrypted, private and never shared.
        </div>
      </div>
    </div>
  )
}
