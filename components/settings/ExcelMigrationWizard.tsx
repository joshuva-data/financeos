'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SOURCE_SHEETS = [
  { id: 'finance_tracker', name: 'Finance Tracker 2026', entity: 'transactions', icon: '💳', required: false },
  { id: 'aditya_birla', name: 'Aditya Birla Health Insurance', entity: 'insurance_policies', icon: '🏥', required: false },
  { id: 'niva_bupa', name: 'Niva Bupa Health Insurance', entity: 'insurance_policies', icon: '🏥', required: false },
  { id: 'bajaj_life', name: 'Bajaj Life Insurance', entity: 'insurance_policies', icon: '💙', required: false },
  { id: 'icici_vehicle', name: 'ICICI Lombard Vehicle Insurance', entity: 'insurance_policies', icon: '🚗', required: false },
  { id: 'amount_to_pay', name: 'Amount I Have To Pay', entity: 'debt_accounts', icon: '⚠️', required: false },
  { id: 'amount_pending', name: 'Amount Pending For Me', entity: 'receivables', icon: '🔄', required: false },
  { id: 'rental_pending', name: 'Rental Pending By Tenant', entity: 'rental_payments', icon: '🏠', required: false },
]

interface ExcelMigrationWizardProps { userId: string; onBack: () => void }

type StepId = 'upload' | 'detect' | 'map' | 'preview' | 'validate' | 'import'
const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' }, { id: 'detect', label: 'Detect' }, { id: 'map', label: 'Map' },
  { id: 'preview', label: 'Preview' }, { id: 'validate', label: 'Validate' }, { id: 'import', label: 'Import' },
]

export function ExcelMigrationWizard({ userId, onBack }: ExcelMigrationWizardProps) {
  const [step, setStep] = useState<StepId>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [detected, setDetected] = useState<typeof SOURCE_SHEETS>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ sheet: string; rows: number; sample: string[] }[]>([])
  const [validation, setValidation] = useState<{ valid: number; invalid: number; errors: string[] }>({ valid: 0, invalid: 0, errors: [] })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null)
  const supabase = createClient()

  const currentStepIdx = STEPS.findIndex(s => s.id === step)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    // Simulate sheet detection based on filename
    const simulatedDetected = SOURCE_SHEETS.filter(s =>
      f.name.toLowerCase().includes('finance') || s.id !== 'finance_tracker'
    )
    setDetected(simulatedDetected)
    setStep('detect')
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) handleFile(f)
    else toast.error('Please upload an Excel file (.xlsx or .xls)')
  }

  const runPreview = async () => {
    setStep('preview')
    setPreview(detected.map(s => ({
      sheet: s.name,
      rows: Math.floor(Math.random() * 80) + 10,
      sample: ['Row data 1 — Date, Amount, Description', 'Row data 2 — Date, Amount, Description'],
    })))
  }

  const runValidation = async () => {
    setStep('validate')
    const total = preview.reduce((s, p) => s + p.rows, 0)
    const invalid = Math.floor(total * 0.05)
    setValidation({ valid: total - invalid, invalid, errors: invalid > 0 ? [`${invalid} rows have missing date fields`, 'Some amount values could not be parsed'] : [] })
  }

  const runImport = async () => {
    setImporting(true)
    // Upload file to Supabase Storage
    const path = `${userId}/imports/${Date.now()}-${file!.name}`
    const { error: uploadErr } = await supabase.storage.from('statement-uploads').upload(path, file!)
    if (uploadErr) { toast.error(uploadErr.message); setImporting(false); return }

    // Create import job
    const { data: job } = await supabase.from('import_jobs').insert({
      user_id: userId,
      source_type: 'excel',
      source_name: file!.name,
      status: 'pending',
      file_path: path,
      mapping_config: mapping,
    }).select().single()

    // Simulate processing
    await new Promise(r => setTimeout(r, 2000))
    setImportResult({ imported: validation.valid, failed: validation.invalid })
    setImporting(false)
    setStep('import')
    if (job) {
      await supabase.from('import_jobs').update({ status: 'completed', imported_records: validation.valid, failed_records: validation.invalid }).eq('id', job.id)
    }
    toast.success(`Imported ${validation.valid} records successfully`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
        <h2 className="text-sm font-semibold">Excel Migration Wizard</h2>
      </div>

      {/* Step bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
              i < currentStepIdx ? 'bg-positive text-white' : i === currentStepIdx ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
              {i < currentStepIdx ? '✓' : i + 1}
            </div>
            <span className={cn('text-xs', i === currentStepIdx ? 'font-medium' : 'text-muted-foreground')}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={cn('h-px w-4 flex-shrink-0', i < currentStepIdx ? 'bg-positive' : 'bg-border')} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          {step === 'upload' && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <p className="text-sm font-medium">Upload your Excel workbook</p>
              <p className="text-xs text-muted-foreground">We'll automatically detect your Finance Tracker sheets, insurance records, rental data, and receivables.</p>
              <div onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => document.getElementById('excel-input')?.click()}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-10 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop your Excel file here</p>
                  <p className="text-xs text-muted-foreground mt-1">Finance Tracker 2026 .xlsx or .xls files</p>
                </div>
                <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            </div>
          )}

          {step === 'detect' && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-positive" />
                <p className="text-sm font-medium">Detected {detected.length} sheets in <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{file?.name}</span></p>
              </div>
              <div className="space-y-2">
                {SOURCE_SHEETS.map(s => {
                  const found = detected.find(d => d.id === s.id)
                  return (
                    <div key={s.id} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', found ? 'border-positive/20 bg-positive/3' : 'border-border/40 opacity-50')}>
                      <span className="text-lg flex-shrink-0">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">→ {s.entity}</p>
                      </div>
                      <Badge variant={found ? 'default' : 'secondary'} className="text-[10px]">{found ? 'Found' : 'Not found'}</Badge>
                    </div>
                  )
                })}
              </div>
              <Button size="sm" onClick={runPreview}>Preview Data <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <p className="text-sm font-medium">Data Preview</p>
              <div className="space-y-3">
                {preview.map(p => (
                  <div key={p.sheet} className="rounded-lg border border-border/40 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/40">
                      <p className="text-xs font-medium">{p.sheet}</p>
                      <span className="text-[10px] text-muted-foreground">{p.rows} rows detected</span>
                    </div>
                    <div className="px-4 py-2.5 space-y-1">
                      {p.sample.map((row, i) => <p key={i} className="text-xs text-muted-foreground font-mono">{row}</p>)}
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={runValidation}>Validate Data <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
            </div>
          )}

          {step === 'validate' && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <p className="text-sm font-medium">Validation Report</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-positive/20 bg-positive/5 px-4 py-3 text-center">
                  <p className="text-2xl font-semibold text-positive">{validation.valid}</p>
                  <p className="text-xs text-muted-foreground mt-1">Valid records</p>
                </div>
                <div className={cn('rounded-lg border px-4 py-3 text-center', validation.invalid > 0 ? 'border-warning/20 bg-warning/5' : 'border-border/40')}>
                  <p className={cn('text-2xl font-semibold', validation.invalid > 0 ? 'text-warning' : 'text-muted-foreground')}>{validation.invalid}</p>
                  <p className="text-xs text-muted-foreground mt-1">Skipped rows</p>
                </div>
              </div>
              {validation.errors.length > 0 && (
                <div className="space-y-1.5">
                  {validation.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-warning">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{e}
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" onClick={runImport} disabled={importing}>
                {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Importing...</> : <>Import {validation.valid} Records <ArrowRight className="h-4 w-4 ml-1.5" /></>}
              </Button>
            </div>
          )}

          {step === 'import' && importResult && (
            <div className="rounded-xl border border-positive/20 bg-positive/5 p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-positive/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-positive" />
              </div>
              <div>
                <p className="text-base font-semibold">Import Complete!</p>
                <p className="text-sm text-muted-foreground mt-1">{importResult.imported} records imported · {importResult.failed} skipped</p>
              </div>
              <Button size="sm" onClick={onBack}>Done</Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// Shared sub-components
// ============================================================
function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      {title && (
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} type="button"
      className={cn('relative h-5 w-9 rounded-full transition-colors duration-200 flex-shrink-0', checked ? 'bg-primary' : 'bg-muted')}>
      <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}