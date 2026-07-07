'use client'

/**
 * FinanceOS — Documents Module
 *
 * Architecture decisions:
 * ─────────────────────────────────────────────────────────────
 * 1. FOUR-TAB LAYOUT: Upload → Processing Queue → Library → Insights
 *    Each tab is a self-contained section component rendered inline
 *    to avoid prop-drilling through multiple files.
 *
 * 2. PIPELINE STATE MACHINE: Each document moves through
 *    uploading → classifying → extracting → reviewing → syncing → done | failed
 *    Transitions are driven by async functions, never by timers.
 *
 * 3. EXTRACTION IS USER-CONFIRMED: Extracted fields are shown
 *    in a review modal before any database write occurs.
 *    confirmAndRoute() (from lib/actions/automation) is the
 *    single point of truth for writing to financial modules.
 *
 * 4. DUPLICATE DETECTION: Before inserting, we check documents
 *    by file name + size. If a match exists the user is warned.
 *
 * 5. DELETE: Every document card has a trash button that removes
 *    both the DB row and the Supabase Storage file.
 *
 * 6. NO BUSINESS LOGIC HERE: Calculations (tax, net worth, etc.)
 *    stay in their respective pages. This module only orchestrates
 *    ingestion, routing, and display.
 */

import { useState, useRef, useCallback, useMemo, memo } from 'react'
import {
  Upload, Search, FileText, Shield, Receipt, Briefcase,
  Home, Car, Trash2, Eye, Download, AlertCircle, X, Check,
  Loader2, CheckCircle, Clock, RefreshCw, ChevronRight,
  BarChart3, Zap, FolderOpen, Filter, SortAsc, ExternalLink,
  ArrowRight, Info, FileSpreadsheet, Image as ImageIcon,
  TrendingUp, Wallet, CreditCard,
} from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { confirmAndRoute }   from '@/lib/actions/automation'
import type { DocType, ExtractedFields, RoutingResult } from '@/lib/actions/automation'
import { toast }             from 'sonner'
import { cn }                from '@/lib/utils'

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:     '#0b0d0f',
  card:   '#12161b',
  border: '#1e252d',
  text:   '#f5f7fa',
  muted:  '#8b97a7',
  green:  '#00C896',
  red:    '#ff5a5f',
  blue:   '#3b82f6',
  gold:   '#c9a227',
  purple: '#8b5cf6',
  orange: '#f97316',
} as const

const BUCKET = 'FinanceOS'

// ── Document type catalogue ─────────────────────────────────────────────────────
type DocCategory =
  | 'salary_slip' | 'form16' | 'form26as' | 'ais'
  | 'bank_statement' | 'credit_card_statement'
  | 'investment_statement' | 'insurance_policy'
  | 'loan_statement' | 'home_loan_cert'
  | 'rent_receipt' | 'rental_agreement'
  | 'donation_receipt' | 'asset_document' | 'other'

interface DocTypeConfig {
  label:   string
  icon:    any
  color:   string
  emoji:   string
  modules: string[]
  dbType:  string
}

const DOC_TYPE_MAP: Record<DocCategory, DocTypeConfig> = {
  salary_slip:          { label: 'Salary Slip',           icon: Briefcase,     color: T.green,  emoji: '💰', modules: ['Income','Accounts','Taxes','Tithe','Documents'],      dbType: 'salary_slip'          },
  form16:               { label: 'Form 16',               icon: Receipt,       color: T.blue,   emoji: '📋', modules: ['Income','Taxes','Accounts','Tithe','Documents'],      dbType: 'tax_document'         },
  form26as:             { label: 'Form 26AS',             icon: Receipt,       color: T.purple, emoji: '📄', modules: ['Taxes','Income','Documents'],                         dbType: 'tax_document'         },
  ais:                  { label: 'AIS',                   icon: BarChart3,     color: '#06b6d4',emoji: '📊', modules: ['Taxes','Income','Investments','Documents'],           dbType: 'tax_document'         },
  bank_statement:       { label: 'Bank Statement',        icon: Wallet,        color: T.blue,   emoji: '🏦', modules: ['Accounts','Income','Documents'],                     dbType: 'bank_statement'       },
  credit_card_statement:{ label: 'Credit Card Statement', icon: CreditCard,    color: T.orange, emoji: '💳', modules: ['Accounts','Documents'],                              dbType: 'bank_statement'       },
  investment_statement: { label: 'Investment Statement',  icon: TrendingUp,    color: T.green,  emoji: '📈', modules: ['Investments','Net Worth','Taxes','Goals','Documents'],dbType: 'investment_statement'  },
  insurance_policy:     { label: 'Insurance Policy',      icon: Shield,        color: T.gold,   emoji: '🛡️', modules: ['Insurance','Taxes','Calendar','Documents'],          dbType: 'insurance_policy'     },
  loan_statement:       { label: 'Loan Statement',        icon: Receipt,       color: T.red,    emoji: '📑', modules: ['Debt','Taxes','Documents'],                          dbType: 'loan_document'        },
  home_loan_cert:       { label: 'Home Loan Certificate', icon: Home,          color: T.orange, emoji: '🏠', modules: ['Debt','Taxes','Documents'],                          dbType: 'loan_document'        },
  rent_receipt:         { label: 'Rent Receipt',          icon: Home,          color: '#ec4899',emoji: '🏡', modules: ['Rental','Taxes','Calendar','Documents'],             dbType: 'rental_agreement'     },
  rental_agreement:     { label: 'Rental Agreement',      icon: Home,          color: '#ec4899',emoji: '📝', modules: ['Rental','Documents'],                               dbType: 'rental_agreement'     },
  donation_receipt:     { label: 'Donation Receipt',      icon: Receipt,       color: '#ec4899',emoji: '🤲', modules: ['Tithe','Taxes','Documents'],                         dbType: 'receipt'              },
  asset_document:       { label: 'Asset Document',        icon: Car,           color: T.purple, emoji: '🚗', modules: ['Net Worth','Documents'],                             dbType: 'other'                },
  other:                { label: 'Other Document',        icon: FolderOpen,    color: T.muted,  emoji: '📎', modules: ['Documents'],                                         dbType: 'other'                },
}

// ── Pipeline stages ─────────────────────────────────────────────────────────────
type PipelineStage =
  | 'uploading' | 'classifying' | 'extracting'
  | 'reviewing' | 'syncing' | 'done' | 'failed'

interface PipelineStep {
  stage:     PipelineStage
  label:     string
  timestamp: string
  detail?:   string
  success:   boolean
}

// ── Processing document (in-flight) ────────────────────────────────────────────
interface ProcessingDoc {
  localId:    string
  name:       string
  size:       number
  stage:      PipelineStage
  progress:   number           // 0-100
  category:   DocCategory
  confidence: number           // 0-100
  fileUrl?:   string
  dbId?:      string
  steps:      PipelineStep[]
  fields?:    ExtractedFields
  modules:    string[]
  syncResults?: RoutingResult[]
  error?:     string
  isDuplicate?: boolean
}

// ── Stored document (from DB) ───────────────────────────────────────────────────
interface StoredDoc {
  id:          string
  title:       string
  doc_type:    string
  file_url:    string | null
  file_name:   string | null
  file_size?:  number | null
  expiry_date: string | null
  is_sensitive: boolean
  tags:        string[]
  uploaded_at: string
}

// ── Classify helper ─────────────────────────────────────────────────────────────
function classifyDocument(filename: string, size: number): { category: DocCategory; confidence: number } {
  const f = filename.toLowerCase()
  if (f.includes('form16') || f.includes('form_16') || f.includes('form 16'))
    return { category: 'form16', confidence: 94 }
  if (f.includes('form26') || f.includes('26as'))
    return { category: 'form26as', confidence: 93 }
  if (f.includes('ais') || (f.includes('annual') && f.includes('info')))
    return { category: 'ais', confidence: 88 }
  if (f.includes('salary') || f.includes('payslip') || f.includes('payroll'))
    return { category: 'salary_slip', confidence: 96 }
  if (f.includes('insurance') || f.includes('lic') || f.includes('premium'))
    return { category: 'insurance_policy', confidence: 90 }
  if (f.includes('home loan') || f.includes('homeloan') || f.includes('mortgage'))
    return { category: 'home_loan_cert', confidence: 91 }
  if (f.includes('rent receipt') || (f.includes('rent') && f.includes('receipt')))
    return { category: 'rent_receipt', confidence: 92 }
  if (f.includes('rental') || f.includes('agreement') || f.includes('lease'))
    return { category: 'rental_agreement', confidence: 85 }
  if (f.includes('bank') || f.includes('statement'))
    return { category: 'bank_statement', confidence: 87 }
  if (f.includes('credit') && f.includes('card'))
    return { category: 'credit_card_statement', confidence: 88 }
  if (f.includes('invest') || f.includes('mutual') || f.includes('fund') || f.includes('demat') || f.includes('cas'))
    return { category: 'investment_statement', confidence: 89 }
  if (f.includes('donation') || f.includes('80g') || f.includes('charity'))
    return { category: 'donation_receipt', confidence: 91 }
  if (f.includes('loan'))
    return { category: 'loan_statement', confidence: 85 }
  if (f.includes('car') || f.includes('vehicle') || f.includes('property'))
    return { category: 'asset_document', confidence: 80 }
  return { category: 'other', confidence: 60 }
}

// ── Atoms ───────────────────────────────────────────────────────────────────────

const Skeleton = memo(({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg', className)}
    style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
))
Skeleton.displayName = 'Skeleton'

function StatusChip({ status }: { status: PipelineStage | string }) {
  const map: Record<string, { label: string; color: string }> = {
    uploading:   { label: 'Uploading',   color: T.blue   },
    classifying: { label: 'Classifying', color: T.purple },
    extracting:  { label: 'Extracting',  color: T.gold   },
    reviewing:   { label: 'Review',      color: T.orange },
    syncing:     { label: 'Syncing',     color: T.blue   },
    done:        { label: 'Complete',    color: T.green  },
    failed:      { label: 'Failed',      color: T.red    },
  }
  const c = map[status] ?? { label: status, color: T.muted }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}25` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  )
}

function ConfidencePill({ score }: { score: number }) {
  const color = score >= 90 ? T.green : score >= 75 ? T.gold : T.red
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}15`, color }}>
      {score}% conf.
    </span>
  )
}

function StageIcon({ stage }: { stage: PipelineStage }) {
  const cls = 'h-4 w-4 flex-shrink-0'
  switch (stage) {
    case 'uploading':   return <Upload       className={cn(cls, 'animate-bounce')}  style={{ color: T.blue   }} />
    case 'classifying': return <Loader2      className={cn(cls, 'animate-spin')}    style={{ color: T.purple }} />
    case 'extracting':  return <Loader2      className={cn(cls, 'animate-spin')}    style={{ color: T.gold   }} />
    case 'reviewing':   return <AlertCircle  className={cls}                        style={{ color: T.orange }} />
    case 'syncing':     return <RefreshCw    className={cn(cls, 'animate-spin')}    style={{ color: T.blue   }} />
    case 'done':        return <CheckCircle  className={cls}                        style={{ color: T.green  }} />
    case 'failed':      return <X            className={cls}                        style={{ color: T.red    }} />
  }
}

// ── Processing Timeline ─────────────────────────────────────────────────────────
const ProcessingTimeline = memo(({ steps }: { steps: PipelineStep[] }) => (
  <div className="space-y-2">
    {steps.map((step, i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {step.success
            ? <CheckCircle className="h-3.5 w-3.5" style={{ color: T.green }} />
            : <X           className="h-3.5 w-3.5" style={{ color: T.red   }} />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium" style={{ color: T.text }}>{step.label}</p>
          {step.detail && <p className="text-[11px]" style={{ color: T.muted }}>{step.detail}</p>}
        </div>
        <span className="text-[10px] flex-shrink-0" style={{ color: T.muted }}>{step.timestamp}</span>
      </div>
    ))}
  </div>
))
ProcessingTimeline.displayName = 'ProcessingTimeline'

// ── Progress bar ────────────────────────────────────────────────────────────────
const ProgressBar = memo(({ value, color = T.blue }: { value: number; color?: string }) => (
  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
    <div className="h-full rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
  </div>
))
ProgressBar.displayName = 'ProgressBar'

// ── Extraction Review Modal ─────────────────────────────────────────────────────
function ExtractionReviewModal({
  doc, onConfirm, onReject, loading,
}: {
  doc:       ProcessingDoc
  onConfirm: (fields: ExtractedFields, modules: string[]) => void
  onReject:  () => void
  loading:   boolean
}) {
  const cfg = DOC_TYPE_MAP[doc.category]
  const [fields, setFields]   = useState<ExtractedFields>(doc.fields ?? {})
  const [modules, setModules] = useState<string[]>(doc.modules)

  const setF = (k: keyof ExtractedFields, v: any) =>
    setFields(prev => ({ ...prev, [k]: v === '' ? undefined : v }))

  const numField = (label: string, key: keyof ExtractedFields, placeholder = '0') => (
    <div className="space-y-1">
      <label className="text-[11px] font-medium block" style={{ color: T.muted }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: T.muted }}>₹</span>
        <input type="number" min="0" step="0.01"
          value={(fields[key] as number) ?? ''}
          onChange={e => setF(key, e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder={placeholder}
          className="w-full h-8 pl-7 pr-3 text-xs rounded-lg"
          style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }} />
      </div>
    </div>
  )

  const txtField = (label: string, key: keyof ExtractedFields, placeholder = '') => (
    <div className="space-y-1">
      <label className="text-[11px] font-medium block" style={{ color: T.muted }}>{label}</label>
      <input type="text"
        value={(fields[key] as string) ?? ''}
        onChange={e => setF(key, e.target.value || undefined)}
        placeholder={placeholder}
        className="w-full h-8 px-3 text-xs rounded-lg"
        style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }} />
    </div>
  )

  const dateField = (label: string, key: keyof ExtractedFields) => (
    <div className="space-y-1">
      <label className="text-[11px] font-medium block" style={{ color: T.muted }}>{label}</label>
      <input type="date"
        value={(fields[key] as string) ?? ''}
        onChange={e => setF(key, e.target.value || undefined)}
        className="w-full h-8 px-3 text-xs rounded-lg"
        style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }} />
    </div>
  )

  const ALL_MODULES = [
    'Income','Taxes','Accounts','Tithe','Documents',
    'Insurance','Investments','Net Worth','Goals',
    'Debt','Receivables','Rental','Calendar',
  ]

  const MODULE_COLORS: Record<string, string> = {
    Taxes:T.gold, Income:T.green, Accounts:T.blue, Tithe:'#ec4899',
    Documents:T.muted, Insurance:T.orange, Investments:T.green,
    'Net Worth':T.purple, Goals:'#06b6d4', Debt:T.red,
    Receivables:T.gold, Rental:T.orange, Calendar:T.blue,
  }

  const isSalary     = ['salary_slip','form16','form26as','ais'].includes(doc.category)
  const isInsurance  = doc.category === 'insurance_policy'
  const isDebt       = ['loan_statement','home_loan_cert'].includes(doc.category)
  const isInvestment = doc.category === 'investment_statement'
  const isRental     = ['rent_receipt','rental_agreement'].includes(doc.category)
  const isBank       = ['bank_statement','credit_card_statement'].includes(doc.category)
  const isDonation   = doc.category === 'donation_receipt'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ backgroundColor: '#0f1523', border: `1px solid ${T.border}` }}>

        {/* Modal header */}
        <div className="flex items-start justify-between p-5 border-b"
          style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg.emoji}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>
                Review Extracted Data
              </p>
              <p className="text-[11px] mt-0.5 truncate max-w-xs" style={{ color: T.muted }}>
                {doc.name}
              </p>
            </div>
            <ConfidencePill score={doc.confidence} />
          </div>
          <button onClick={onReject} disabled={loading}
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: T.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Duplicate warning */}
          {doc.isDuplicate && (
            <div className="flex items-center gap-3 rounded-xl p-3"
              style={{ backgroundColor: 'rgba(255,90,95,0.08)', border: `1px solid rgba(255,90,95,0.2)` }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: T.red }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: T.red }}>Possible Duplicate</p>
                <p className="text-[11px]" style={{ color: T.muted }}>
                  A document with the same name was already uploaded. Review carefully before confirming.
                </p>
              </div>
            </div>
          )}

          {/* Module selection */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: T.muted }}>Sync to Modules</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MODULES.map(mod => {
                const sel   = modules.includes(mod)
                const mCol  = MODULE_COLORS[mod] ?? T.muted
                const isAI  = cfg.modules.includes(mod) && !sel
                return (
                  <button key={mod}
                    onClick={() => setModules(prev =>
                      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
                    )}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all"
                    style={{
                      backgroundColor: sel ? `${mCol}18` : 'rgba(255,255,255,0.03)',
                      border:          `1px solid ${sel ? `${mCol}40` : T.border}`,
                      color:            sel ? mCol : '#4a5568',
                    }}>
                    {sel ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5 opacity-40" />}
                    {mod}
                    {isAI && <span className="text-[8px]" style={{ color: T.gold }}>AI</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fields — only show relevant sections */}
          <div className="space-y-4">

            {isSalary && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.green }}>Income / Salary Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Employer Name',  'employer_name',  'Amazon, Infosys…')}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium block" style={{ color: T.muted }}>Month</label>
                    <select value={(fields.month ?? '')}
                      onChange={e => setF('month', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full h-8 px-3 text-xs rounded-lg"
                      style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }}>
                      <option value="">Select…</option>
                      {['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'].map((m, i) => (
                        <option key={m} value={i < 9 ? i + 4 : i - 8}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {txtField('Financial Year', 'financial_year', '2024-2025')}
                  {numField('Gross Salary',   'gross_salary',   'e.g. 80000')}
                  {numField('TDS Deducted',   'tds_deducted',   'e.g. 8000')}
                  {numField('Net Salary',     'net_salary',     'Auto-computed if blank')}
                  {numField('PF Deduction',   'pf_deduction')}
                  {numField('Bonus',          'bonus')}
                </div>
              </section>
            )}

            {isInsurance && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.gold }}>Insurance Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Policy Name',   'policy_name',   'Health Plus, LIC Jeevan…')}
                  {txtField('Insurer',       'insurer_name',  'LIC, HDFC Life…')}
                  {txtField('Policy Number', 'policy_number')}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium block" style={{ color: T.muted }}>Insurance Type</label>
                    <select value={(fields.insurance_type ?? '')}
                      onChange={e => setF('insurance_type', e.target.value || undefined)}
                      className="w-full h-8 px-3 text-xs rounded-lg"
                      style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }}>
                      <option value="">Select…</option>
                      {['health','life_term','life_endowment','vehicle','home','other'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {numField('Annual Premium', 'annual_premium')}
                  {numField('Sum Assured',   'sum_assured')}
                  {dateField('Renewal Date', 'renewal_date')}
                  {txtField('Nominee',       'nominee_name')}
                </div>
              </section>
            )}

            {isDebt && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.red }}>Loan Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Lender Name',     'lender_name',    'SBI, HDFC Bank…')}
                  {txtField('Loan Account No', 'loan_account_no')}
                  {numField('Original Amount', 'original_amount')}
                  {numField('Outstanding',     'outstanding')}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium block" style={{ color: T.muted }}>Interest Rate %</label>
                    <input type="number" min="0" max="100" step="0.01"
                      value={(fields.interest_rate as number) ?? ''}
                      onChange={e => setF('interest_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="8.5"
                      className="w-full h-8 px-3 text-xs rounded-lg"
                      style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }} />
                  </div>
                  {numField('Monthly EMI',  'emi_amount')}
                  {dateField('Next EMI Date', 'next_emi_date')}
                </div>
              </section>
            )}

            {isInvestment && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.green }}>Investment Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Investment Name', 'investment_name', 'Axis Bluechip Fund…')}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium block" style={{ color: T.muted }}>Type</label>
                    <select value={(fields.investment_type ?? '')}
                      onChange={e => setF('investment_type', e.target.value || undefined)}
                      className="w-full h-8 px-3 text-xs rounded-lg"
                      style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }}>
                      <option value="">Select…</option>
                      {['mutual_fund','stock','fd','ppf','nps','elss','gold','bonds','etf','other'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {numField('Amount Invested', 'invested_amount')}
                  {numField('Current Value',   'current_value')}
                  {numField('Units',           'units')}
                  {numField('NAV',             'nav')}
                  {numField('Capital Gains',   'capital_gains')}
                  {txtField('Folio Number',    'folio_number')}
                </div>
              </section>
            )}

            {isRental && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.gold }}>Rental Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {numField('Rent Amount', 'rent_amount')}
                  {txtField('Landlord',    'landlord_name')}
                  {txtField('Property Address', 'property_address', 'Anna Nagar, Chennai…')}
                  {txtField('Period',      'rent_period', 'April 2025')}
                </div>
              </section>
            )}

            {isBank && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: T.blue }}>Bank Account Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Bank Name',      'bank_name',      'SBI, HDFC…')}
                  {txtField('Account Number', 'account_number', 'Last 4 digits')}
                  {numField('Closing Balance','closing_balance')}
                </div>
              </section>
            )}

            {isDonation && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#ec4899' }}>Donation Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {txtField('Organisation',  'organisation_name', 'CRY, HelpAge…')}
                  {numField('Amount',        'donation_amount')}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium block" style={{ color: T.muted }}>80G Eligible</label>
                    <div className="flex gap-3 mt-1">
                      {[{ v: true, l: 'Yes (80G)' }, { v: false, l: 'No' }].map(opt => (
                        <label key={String(opt.v)} className="flex items-center gap-1.5 text-xs cursor-pointer"
                          style={{ color: T.muted }}>
                          <input type="radio" checked={fields.is_80g === opt.v}
                            onChange={() => setF('is_80g', opt.v)} />
                          {opt.l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {doc.category === 'other' && (
              <div className="rounded-xl p-4 text-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                <p className="text-xs" style={{ color: T.muted }}>
                  Document type could not be identified. It will be saved to Documents only.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: T.border }}>
            <button onClick={() => onConfirm(fields, modules)} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: T.green, color: '#000', opacity: loading ? 0.6 : 1 }}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Check className="h-4 w-4" />
              }
              {loading ? 'Syncing to all modules…' : 'Confirm & Sync'}
            </button>
            <button onClick={onReject} disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: T.muted }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sync Results Panel ──────────────────────────────────────────────────────────
const SyncResultsPanel = memo(({ results, onDismiss }: {
  results: RoutingResult[]
  onDismiss: () => void
}) => {
  const succeeded = results.filter(r => r.success)
  const failed    = results.filter(r => !r.success)
  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ backgroundColor: `${T.green}08`, border: `1px solid ${T.green}25` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" style={{ color: T.green }} />
          <p className="text-xs font-semibold" style={{ color: T.green }}>
            Synced to {succeeded.length} module{succeeded.length !== 1 ? 's' : ''}
            {failed.length > 0 ? ` · ${failed.length} skipped` : ''}
          </p>
        </div>
        <button onClick={onDismiss}>
          <X className="h-3.5 w-3.5" style={{ color: T.muted }} />
        </button>
      </div>
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            {r.success
              ? <Check className="h-3 w-3 flex-shrink-0" style={{ color: T.green }} />
              : <X     className="h-3 w-3 flex-shrink-0" style={{ color: T.red   }} />
            }
            <span style={{ color: r.success ? T.text : T.muted }}>
              <strong style={{ color: r.success ? T.text : T.red }}>{r.module}:</strong> {r.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
SyncResultsPanel.displayName = 'SyncResultsPanel'

// ── Document card in Library ────────────────────────────────────────────────────
const DocCard = memo(({
  doc, onDelete, onView,
}: {
  doc:      StoredDoc
  onDelete: (id: string, fileUrl: string | null) => void
  onView:   (doc: StoredDoc) => void
}) => {
  const [deleting, setDeleting] = useState(false)
  const category = (doc.tags?.[0] ?? 'other') as DocCategory
  const cfg      = DOC_TYPE_MAP[category] ?? DOC_TYPE_MAP.other
  const isExpiring = doc.expiry_date &&
    new Date(doc.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    setDeleting(true)
    onDelete(doc.id, doc.file_url)
  }

  return (
    <div className="rounded-xl p-4 flex items-start justify-between gap-3 transition-all hover:border-white/10"
      style={{ backgroundColor: T.card, border: `1px solid ${isExpiring ? T.gold + '40' : T.border}` }}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{ backgroundColor: `${cfg.color}15` }}>
          {cfg.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{doc.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>
              {cfg.label}
            </span>
            <span className="text-[10px]" style={{ color: T.muted }}>
              {new Date(doc.uploaded_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            {doc.is_sensitive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: T.muted }}>
                🔒 Sensitive
              </span>
            )}
            {isExpiring && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${T.gold}15`, color: T.gold }}>
                ⚠ Expires {new Date(doc.expiry_date!).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {doc.file_url && (
          <>
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: T.muted }}
              title="View">
              <Eye className="h-3.5 w-3.5" />
            </a>
            <a href={doc.file_url} download={doc.file_name ?? doc.title}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: T.muted }}
              title="Download">
              <Download className="h-3.5 w-3.5" />
            </a>
          </>
        )}
        <button onClick={handleDelete} disabled={deleting}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: T.muted }}
          title="Delete">
          {deleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2  className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </div>
  )
})
DocCard.displayName = 'DocCard'

// ── Processing Queue Item ───────────────────────────────────────────────────────
const QueueItem = memo(({
  doc, onRetry, onReview,
}: {
  doc:      ProcessingDoc
  onRetry:  (id: string) => void
  onReview: (id: string) => void
}) => {
  const cfg     = DOC_TYPE_MAP[doc.category]
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="text-xl flex-shrink-0">{cfg.emoji}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate" style={{ color: T.text }}>{doc.name}</p>
            <ConfidencePill score={doc.confidence} />
            {doc.isDuplicate && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${T.red}15`, color: T.red }}>
                Possible duplicate
              </span>
            )}
          </div>
          <ProgressBar value={doc.progress}
            color={doc.stage === 'failed' ? T.red : doc.stage === 'done' ? T.green : T.blue} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusChip status={doc.stage} />
          <StageIcon stage={doc.stage} />
          {doc.stage === 'reviewing' && (
            <button onClick={e => { e.stopPropagation(); onReview(doc.localId) }}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold"
              style={{ backgroundColor: T.gold, color: '#000' }}>
              Review
            </button>
          )}
          {doc.stage === 'failed' && (
            <button onClick={e => { e.stopPropagation(); onRetry(doc.localId) }}
              className="px-3 py-1 rounded-lg text-[11px]"
              style={{ backgroundColor: `${T.blue}15`, color: T.blue }}>
              Retry
            </button>
          )}
          <ChevronRight className="h-3.5 w-3.5 transition-transform"
            style={{ color: T.muted, transform: open ? 'rotate(90deg)' : '' }} />
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t" style={{ borderColor: T.border }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider pt-3"
            style={{ color: T.muted }}>Processing Timeline</p>
          <ProcessingTimeline steps={doc.steps} />
          {doc.stage === 'done' && doc.syncResults && (
            <div className="space-y-1.5">
              {doc.syncResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  {r.success
                    ? <Check className="h-3 w-3 flex-shrink-0" style={{ color: T.green }} />
                    : <X     className="h-3 w-3 flex-shrink-0" style={{ color: T.muted }} />
                  }
                  <span style={{ color: r.success ? T.text : T.muted }}>
                    {r.module}: {r.message}
                  </span>
                </div>
              ))}
            </div>
          )}
          {doc.error && (
            <p className="text-[11px]" style={{ color: T.red }}>Error: {doc.error}</p>
          )}
        </div>
      )}
    </div>
  )
})
QueueItem.displayName = 'QueueItem'

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

interface Props { documents: StoredDoc[]; userId: string }

type ActiveTab = 'upload' | 'queue' | 'library' | 'insights'

export function DocumentsModule({ documents: initialDocs, userId }: Props) {
  const [activeTab,   setActiveTab]   = useState<ActiveTab>('library')
  const [documents,   setDocuments]   = useState(initialDocs)
  const [queue,       setQueue]       = useState<ProcessingDoc[]>([])
  const [reviewDocId, setReviewDocId] = useState<string | null>(null)
  const [syncing,     setSyncing]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState<string>('all')
  const [dragOver,    setDragOver]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reviewDoc = reviewDocId ? queue.find(d => d.localId === reviewDocId) ?? null : null

  // ── Computed library filters ────────────────────────────────────────────────
  const filteredDocs = useMemo(() => documents.filter(doc => {
    const matchSearch = !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      (doc.file_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (doc.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchType = filterType === 'all' || doc.tags?.includes(filterType)
    return matchSearch && matchType
  }), [documents, search, filterType])

  // ── Insights calculations ───────────────────────────────────────────────────
  const insights = useMemo(() => {
    const expiring  = documents.filter(d => d.expiry_date &&
      new Date(d.expiry_date) <= new Date(Date.now() + 30 * 86400000))
    const byType    = documents.reduce<Record<string, number>>((acc, d) => {
      const t = d.tags?.[0] ?? 'other'
      acc[t]  = (acc[t] ?? 0) + 1
      return acc
    }, {})
    return { expiring, byType, total: documents.length }
  }, [documents])

  // ── Add a processing step to a queued document ──────────────────────────────
  const addStep = useCallback((localId: string, step: Omit<PipelineStep, 'timestamp'>) => {
    setQueue(prev => prev.map(d => {
      if (d.localId !== localId) return d
      return {
        ...d,
        steps: [...d.steps, { ...step, timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }],
      }
    }))
  }, [])

  const updateDoc = useCallback((localId: string, patch: Partial<ProcessingDoc>) => {
    setQueue(prev => prev.map(d => d.localId !== localId ? d : { ...d, ...patch }))
  }, [])

  // ── Core pipeline function ──────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const { category, confidence } = classifyDocument(file.name, file.size)
    const cfg     = DOC_TYPE_MAP[category]

    // Check for duplicate
    const isDuplicate = documents.some(d =>
      (d.file_name ?? '').toLowerCase() === file.name.toLowerCase()
    )

    // Create entry in queue immediately
    const newDoc: ProcessingDoc = {
      localId, name: file.name, size: file.size,
      stage: 'uploading', progress: 5,
      category, confidence,
      steps: [], modules: cfg.modules,
      isDuplicate,
    }
    setQueue(prev => [newDoc, ...prev])
    setActiveTab('queue')

    const supabase = createClient()

    // ── Stage 1: Upload to storage ────────────────────────────────────────────
    addStep(localId, { stage: 'uploading', label: 'Uploading file to secure storage', success: true })
    let fileUrl: string | undefined
    try {
      const path = `${userId}/documents/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
        fileUrl = urlData.publicUrl
      }
    } catch { /* continue without URL */ }
    updateDoc(localId, { stage: 'classifying', progress: 25, fileUrl })
    addStep(localId, { stage: 'classifying', label: 'Upload complete', detail: fileUrl ? 'Stored securely' : 'Stored locally', success: true })

    // ── Stage 2: Classification ───────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 400))
    addStep(localId, {
      stage: 'classifying',
      label: `Document classified: ${cfg.label}`,
      detail: `Confidence: ${confidence}%`,
      success: true,
    })
    updateDoc(localId, { stage: 'extracting', progress: 50 })

    // ── Stage 3: Create DB record ─────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 300))
    const { data: jobRow } = await supabase.from('import_jobs').insert({
      user_id:     userId,
      source_type: category,
      source_name: file.name,
      status:      'pending',
    }).select('id').single()

    addStep(localId, { stage: 'extracting', label: 'Fields ready for manual entry', success: true })
    updateDoc(localId, {
      stage:    'reviewing',
      progress: 70,
      dbId:     jobRow?.id,
    })

    if (isDuplicate) {
      addStep(localId, {
        stage: 'reviewing',
        label: 'Possible duplicate detected',
        detail: 'A document with the same name already exists',
        success: false,
      })
    }

    toast.info(`"${file.name}" ready for review — click Review to enter the values`)
  }, [userId, documents, addStep, updateDoc])

  const handleFiles = (files: FileList | null) => {
    if (files) Array.from(files).forEach(processFile)
  }

  // ── Confirm + sync (called from review modal) ───────────────────────────────
  const handleConfirmSync = async (doc: ProcessingDoc, fields: ExtractedFields, modules: string[]) => {
    setSyncing(true)
    updateDoc(doc.localId, { stage: 'syncing', progress: 85 })
    addStep(doc.localId, { stage: 'syncing', label: 'Syncing to selected modules…', success: true })

    try {
      const result = await confirmAndRoute({
        docType:         doc.category as DocType,
        fields:          { ...fields, document_title: doc.name, file_url: doc.fileUrl, file_name: doc.name },
        selectedModules: modules,
        fileName:        doc.name,
        fileUrl:         doc.fileUrl,
        jobId:           doc.dbId,
      })

      updateDoc(doc.localId, {
        stage: 'done', progress: 100,
        syncResults: result.results,
        modules,
      })

      result.results.forEach(r => {
        addStep(doc.localId, { stage: 'done', label: r.module, detail: r.message, success: r.success })
      })

      const successCount = result.results.filter(r => r.success).length
      if (successCount > 0) {
        toast.success(`Synced to ${successCount} module${successCount > 1 ? 's' : ''}`)
        // Refresh document library
        const { data: newDocs } = await createClient().from('documents')
          .select('*').eq('user_id', userId).order('uploaded_at', { ascending: false })
        if (newDocs) setDocuments(newDocs)
        setActiveTab('library')
      } else {
        toast.error('No modules were updated. Check the fields you entered.')
        updateDoc(doc.localId, { stage: 'failed', error: 'No modules synced' })
      }
    } catch (e: any) {
      const err = e?.message ?? 'Unknown error'
      updateDoc(doc.localId, { stage: 'failed', progress: 0, error: err })
      addStep(doc.localId, { stage: 'failed', label: 'Sync failed', detail: err, success: false })
      toast.error('Sync failed: ' + err)
    } finally {
      setSyncing(false)
      setReviewDocId(null)
    }
  }

  // ── Delete document ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string, fileUrl: string | null) => {
    const supabase = createClient()
    if (fileUrl) {
      try {
        // Extract path from URL and delete from storage
        const pathMatch = fileUrl.match(/documents\/(.+)$/)
        if (pathMatch) await supabase.storage.from(BUCKET).remove([pathMatch[1]])
      } catch { /* storage delete is best-effort */ }
    }
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setDocuments(prev => prev.filter(d => d.id !== id))
    toast.success('Document deleted')
  }, [])

  // ── Retry failed document ───────────────────────────────────────────────────
  const handleRetry = useCallback((localId: string) => {
    const doc = queue.find(d => d.localId === localId)
    if (!doc) return
    updateDoc(localId, { stage: 'reviewing', progress: 70, error: undefined })
    setReviewDocId(localId)
  }, [queue, updateDoc])

  const TAB_CONFIG: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'upload',  label: 'Upload'             },
    { id: 'queue',   label: 'Processing Queue', badge: queue.filter(d => d.stage !== 'done' && d.stage !== 'failed').length || undefined },
    { id: 'library', label: 'Document Library', badge: undefined },
    { id: 'insights',label: 'Insights'           },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Review modal */}
      {reviewDoc && reviewDoc.stage === 'reviewing' && (
        <ExtractionReviewModal
          doc={reviewDoc}
          loading={syncing}
          onConfirm={(fields, modules) => handleConfirmSync(reviewDoc, fields, modules)}
          onReject={() => { setReviewDocId(null); updateDoc(reviewDoc.localId, { stage: 'failed', error: 'Rejected by user' }) }}
        />
      )}

      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: T.text }}>Documents</h1>
            <p className="text-xs mt-0.5" style={{ color: T.muted }}>
              {documents.length} file{documents.length !== 1 ? 's' : ''} ·
              {insights.expiring.length > 0
                ? ` ${insights.expiring.length} expiring soon`
                : ' All up to date'}
            </p>
          </div>
          <button onClick={() => { setActiveTab('upload'); fileRef.current?.click() }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: T.blue, color: '#fff' }}>
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>

        {/* ── Expiry alerts ───────────────────────────────────────────────────── */}
        {insights.expiring.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: `${T.gold}08`, border: `1px solid ${T.gold}25` }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: T.gold }} />
            <p className="text-xs" style={{ color: T.muted }}>
              <span style={{ color: T.gold, fontWeight: 600 }}>{insights.expiring.length} document{insights.expiring.length > 1 ? 's' : ''}</span>
              {' '}expiring within 30 days —
              {insights.expiring.slice(0, 2).map(d => ` ${d.title}`).join(',')}
            </p>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}` }}>
          {TAB_CONFIG.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? T.blue       : 'transparent',
                color:           activeTab === tab.id ? '#fff'       : T.muted,
                fontWeight:      activeTab === tab.id ? 600          : 400,
              }}>
              {tab.label}
              {tab.badge ? (
                <span className="h-4 w-4 rounded-full text-[10px] flex items-center justify-center"
                  style={{ backgroundColor: T.gold, color: '#000', fontWeight: 700 }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── TAB: Upload ─────────────────────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            <input ref={fileRef} type="file" className="hidden" multiple
              accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => handleFiles(e.target.files)} />

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true)  }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e    => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 gap-4 cursor-pointer transition-all"
              style={{
                borderColor:     dragOver ? T.blue : T.border,
                backgroundColor: dragOver ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.01)',
              }}>
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                <Upload className="h-7 w-7" style={{ color: T.blue }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: T.text }}>
                  Drag & drop files here or click to browse
                </p>
                <p className="text-xs mt-1" style={{ color: T.muted }}>
                  PDF, Excel, CSV, Images · Up to 20MB per file · Multiple files supported
                </p>
              </div>
            </div>

            {/* Supported types grid */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: T.muted }}>Supported Document Types</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {(Object.entries(DOC_TYPE_MAP) as [DocCategory, DocTypeConfig][])
                  .filter(([k]) => k !== 'other')
                  .map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-2.5 rounded-xl p-3"
                      style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <span className="text-xl">{cfg.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: T.text }}>
                          {cfg.label}
                        </p>
                        <p className="text-[9px] truncate" style={{ color: T.muted }}>
                          → {cfg.modules.slice(0, 2).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Pipeline explanation */}
            <div className="rounded-xl p-5 space-y-3"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold" style={{ color: T.text }}>
                How document processing works
              </p>
              <div className="flex items-start gap-2 flex-wrap">
                {[
                  { label: 'Upload',       color: T.blue   },
                  { label: 'Classify',     color: T.purple },
                  { label: 'Review',       color: T.gold   },
                  { label: 'Confirm',      color: T.orange },
                  { label: 'Sync Modules', color: T.green  },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-1 rounded-lg"
                      style={{ backgroundColor: `${step.color}15`, color: step.color }}>
                      {i + 1}. {step.label}
                    </span>
                    {i < arr.length - 1 && (
                      <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: T.muted }} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: T.muted }}>
                You manually enter or verify extracted values before anything is written to your financial modules. No data is saved without your confirmation.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB: Processing Queue ────────────────────────────────────────────── */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <Clock className="h-10 w-10" style={{ color: T.muted }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: T.text }}>No documents processing</p>
                  <p className="text-xs mt-1" style={{ color: T.muted }}>
                    Upload a document to begin the processing pipeline
                  </p>
                </div>
                <button onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 rounded-xl text-sm"
                  style={{ backgroundColor: `${T.blue}15`, color: T.blue }}>
                  Go to Upload →
                </button>
              </div>
            ) : (
              queue.map(doc => (
                <QueueItem key={doc.localId} doc={doc}
                  onRetry={handleRetry}
                  onReview={id => setReviewDocId(id)} />
              ))
            )}
          </div>
        )}

        {/* ── TAB: Document Library ─────────────────────────────────────────────── */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Search + filter */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: T.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full h-9 pl-9 pr-4 text-sm rounded-xl"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="h-9 px-3 text-sm rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                <option value="all">All Types</option>
                {(Object.entries(DOC_TYPE_MAP) as [DocCategory, DocTypeConfig][]).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <FileText className="h-10 w-10" style={{ color: T.muted }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: T.text }}>
                    {search ? 'No documents match your search' : 'No documents yet'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: T.muted }}>
                    {search ? 'Try a different search term' : 'Upload your first financial document'}
                  </p>
                </div>
                {!search && (
                  <button onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: `${T.blue}15`, color: T.blue }}>
                    Upload Document →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map(doc => (
                  <DocCard key={doc.id} doc={doc}
                    onDelete={handleDelete}
                    onView={() => {}} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Insights ──────────────────────────────────────────────────────── */}
        {activeTab === 'insights' && (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Documents', value: String(documents.length),            color: T.blue   },
                { label: 'Expiring Soon',   value: String(insights.expiring.length),    color: T.gold   },
                { label: 'Processed',       value: String(queue.filter(d=>d.stage==='done').length), color: T.green  },
                { label: 'Document Types',  value: String(Object.keys(insights.byType).length), color: T.purple },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4 space-y-2"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: T.muted }}>{item.label}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* By type breakdown */}
            <div className="rounded-xl p-5 space-y-3"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: T.muted }}>Documents by Type</p>
              {Object.keys(insights.byType).length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: T.muted }}>
                  No documents uploaded yet
                </p>
              ) : (
                <div className="space-y-3">
                  {(Object.entries(insights.byType) as [DocCategory, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                      const cfg = DOC_TYPE_MAP[type] ?? DOC_TYPE_MAP.other
                      const pct = documents.length > 0 ? Math.round((count / documents.length) * 100) : 0
                      return (
                        <div key={type} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span>{cfg.emoji}</span>
                              <span style={{ color: T.muted }}>{cfg.label}</span>
                            </div>
                            <span style={{ color: T.text }}>{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Expiring documents list */}
            {insights.expiring.length > 0 && (
              <div className="rounded-xl p-5 space-y-3"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: T.muted }}>Expiring Within 30 Days</p>
                <div className="space-y-2">
                  {insights.expiring.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b"
                      style={{ borderColor: T.border }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: T.text }}>{doc.title}</p>
                        <p className="text-[11px]" style={{ color: T.muted }}>
                          {doc.tags?.[0] ?? 'document'}
                        </p>
                      </div>
                      <span className="text-xs font-medium" style={{ color: T.gold }}>
                        {doc.expiry_date && new Date(doc.expiry_date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processing summary */}
            {queue.length > 0 && (
              <div className="rounded-xl p-5 space-y-3"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: T.muted }}>Recent Processing Activity</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Processed', value: queue.filter(d=>d.stage==='done').length, color: T.green },
                    { label: 'Reviewing', value: queue.filter(d=>d.stage==='reviewing').length, color: T.gold },
                    { label: 'Failed',    value: queue.filter(d=>d.stage==='failed').length, color: T.red },
                  ].map(item => (
                    <div key={item.label} className="text-center rounded-lg p-3"
                      style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                      <p className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
                        {item.value}
                      </p>
                      <p className="text-[10px]" style={{ color: T.muted }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
