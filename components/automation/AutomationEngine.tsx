'use client'

/**
 * FinanceOS — Automation Engine
 *
 * Architecture overview:
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. EVENT BUS (lib/automation/event-bus.ts)
 *    Modules emit typed FinanceEvents. The engine subscribes and matches
 *    events to workflows whose trigger.eventType matches.
 *
 * 2. WORKFLOW ENGINE (this component)
 *    Holds all workflow state in React state (in-memory for the session).
 *    Workflows are persisted to Supabase import_jobs table as JSON payloads.
 *    On mount, stored workflows are loaded from the DB.
 *
 * 3. WORKFLOW EXECUTOR (executeWorkflow fn)
 *    Runs trigger → condition check → actions in sequence.
 *    Each action logs a step. On failure, retries up to action.retries times.
 *    confirmAndRoute() is called for sync_module actions — no duplicate logic.
 *
 * 4. TEMPLATE LIBRARY (BUILT_IN_WORKFLOWS from lib/automation/templates.ts)
 *    Pre-built workflows users can activate in one click. Activating creates
 *    a copy with a new ID stored in Supabase.
 *
 * 5. VISUAL EDITOR (WorkflowEditorModal)
 *    UI-only workflow builder. Generates a Workflow config object then saves
 *    it. No code runs inside the editor — execution only happens in executeWorkflow.
 *
 * Tabs: Dashboard → Workflows → Templates → Logs → Settings
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import {
  Zap, Shield, Plus, Play, Pause, Trash2, Edit2, Check,
  X, ChevronRight, AlertCircle, CheckCircle, Clock, RefreshCw,
  Activity, BarChart3, Settings, FileText, Bell, Wallet,
  TrendingUp, Target, Calendar, ArrowRight, ChevronDown,
  Loader2, Info, Copy, Eye, Filter,
} from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { toast }             from 'sonner'
import { cn }                from '@/lib/utils'
import { fmtINR }            from '@/lib/utils/currency'
import { BUILT_IN_WORKFLOWS } from '@/lib/automation/templates'
import { eventBus }          from '@/lib/automation/event-bus'
import type {
  Workflow, WorkflowExecution, ExecutionStep, ExecutionStatus,
  WorkflowStatus, WorkflowCategory, TriggerType, ActionType,
  FinanceEventType, WorkflowAction, WorkflowCondition,
} from '@/lib/automation/types'

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

// ── Category colour map ────────────────────────────────────────────────────────
const CAT_COLORS: Record<WorkflowCategory, string> = {
  income: T.green, expenses: T.red, investments: '#00C896',
  insurance: T.gold, debt: T.red, goals: T.purple,
  taxes: T.gold, documents: T.blue, alerts: T.orange, custom: T.muted,
}

// ── Action type labels ─────────────────────────────────────────────────────────
const ACTION_LABELS: Record<ActionType, string> = {
  notify:       'Send Notification',
  sync_module:  'Sync to Module',
  update_goal:  'Update Goal',
  create_record:'Create Record',
  send_email:   'Send Email',
  trigger_ai:   'Ask AI Copilot',
  recalculate:  'Recalculate',
  flag_review:  'Flag for Review',
}

const EVENT_LABELS: Record<FinanceEventType, string> = {
  'salary.received':          'Salary Received',
  'expense.created':          'Expense Created',
  'document.uploaded':        'Document Uploaded',
  'investment.updated':       'Investment Updated',
  'insurance.renewal_due':    'Insurance Renewal Due',
  'debt.payment_due':         'Debt Payment Due',
  'goal.completed':           'Goal Completed',
  'goal.milestone':           'Goal Milestone Hit',
  'recurring.detected':       'Recurring Payment Detected',
  'tax.document_processed':   'Tax Document Processed',
  'account.balance_low':      'Account Balance Low',
  'budget.exceeded':          'Budget Exceeded',
  'subscription.detected':    'Subscription Detected',
  'portfolio.rebalance_due':  'Portfolio Rebalance Due',
  'tithe.due':                'Tithe Due',
}

// ── Atoms ───────────────────────────────────────────────────────────────────────

const Skeleton = memo(({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg', className)}
    style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
))
Skeleton.displayName = 'Skeleton'

function StatusBadge({ status }: { status: ExecutionStatus | WorkflowStatus }) {
  const map: Record<string, { label: string; color: string }> = {
    active:  { label: 'Active',   color: T.green  },
    paused:  { label: 'Paused',   color: T.muted  },
    draft:   { label: 'Draft',    color: T.gold   },
    archived:{ label: 'Archived', color: '#4a5568'},
    pending: { label: 'Pending',  color: T.gold   },
    running: { label: 'Running',  color: T.blue   },
    success: { label: 'Success',  color: T.green  },
    failed:  { label: 'Failed',   color: T.red    },
    skipped: { label: 'Skipped',  color: T.muted  },
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

function ProgressBar({ value, color = T.blue }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────
const KPICard = memo(({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: any
}) => (
  <div className="rounded-xl p-4 space-y-2"
    style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
        {label}
      </p>
      <div className="h-7 w-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
    </div>
    <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    {sub && <p className="text-[11px]" style={{ color: T.muted }}>{sub}</p>}
  </div>
))
KPICard.displayName = 'KPICard'

// ── Execution timeline ─────────────────────────────────────────────────────────
const ExecutionTimeline = memo(({ steps }: { steps: ExecutionStep[] }) => (
  <div className="space-y-2">
    {steps.map((step, i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {step.status === 'success' ? <CheckCircle className="h-3.5 w-3.5" style={{ color: T.green }} />
          : step.status === 'failed'  ? <X           className="h-3.5 w-3.5" style={{ color: T.red   }} />
          : step.status === 'running' ? <Loader2     className="h-3.5 w-3.5 animate-spin" style={{ color: T.blue }} />
          :                             <Clock       className="h-3.5 w-3.5" style={{ color: T.muted }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: T.text }}>{step.label}</p>
          {step.error && <p className="text-[11px]" style={{ color: T.red }}>{step.error}</p>}
          {step.output?.message && (
            <p className="text-[11px]" style={{ color: T.muted }}>{step.output.message}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-[10px]" style={{ color: T.muted }}>
          {step.attempt > 1 && <span style={{ color: T.gold }}>retry {step.attempt}</span>}
          {' '}{step.startedAt}
        </div>
      </div>
    ))}
  </div>
))
ExecutionTimeline.displayName = 'ExecutionTimeline'

// ── Workflow card ──────────────────────────────────────────────────────────────
const WorkflowCard = memo(({
  workflow, onToggle, onDelete, onEdit, onRun, running,
}: {
  workflow: Workflow
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit:   (w: Workflow) => void
  onRun:    (w: Workflow) => void
  running:  boolean
}) => {
  const [expanded, setExpanded] = useState(false)
  const catColor  = CAT_COLORS[workflow.category] ?? T.muted
  const successRate = workflow.runCount > 0
    ? Math.round((workflow.successCount / workflow.runCount) * 100)
    : null

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: T.card, border: `1px solid ${workflow.status === 'active' ? catColor + '30' : T.border}` }}>

      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        <span className="text-2xl flex-shrink-0">{workflow.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: T.text }}>{workflow.name}</p>
            <StatusBadge status={workflow.status} />
            {workflow.isTemplate && (
              <span className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${T.purple}15`, color: T.purple }}>TEMPLATE</span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: T.muted }}>
            {workflow.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Run manually */}
          <button onClick={() => onRun(workflow)} disabled={running}
            title="Run now"
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${T.green}15`, color: T.green }}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          {/* Toggle active/paused */}
          <button onClick={() => onToggle(workflow.id)} title={workflow.status === 'active' ? 'Pause' : 'Activate'}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${workflow.status === 'active' ? T.gold : T.blue}15`,
                     color: workflow.status === 'active' ? T.gold : T.blue }}>
            {workflow.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onEdit(workflow)} title="Edit"
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ color: T.muted }}>
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(workflow.id)} title="Delete"
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ color: T.muted }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ color: T.muted }}>
            <ChevronDown className="h-3.5 w-3.5 transition-transform"
              style={{ transform: expanded ? 'rotate(180deg)' : '' }} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 pb-3 flex-wrap">
        <span className="text-[11px]" style={{ color: T.muted }}>
          Trigger: <span style={{ color: T.text }}>
            {workflow.trigger.type === 'event'
              ? EVENT_LABELS[workflow.trigger.eventType!] ?? workflow.trigger.eventType
              : workflow.trigger.type}
          </span>
        </span>
        <span className="text-[11px]" style={{ color: T.muted }}>
          Actions: <span style={{ color: T.text }}>{workflow.actions.length}</span>
        </span>
        <span className="text-[11px]" style={{ color: T.muted }}>
          Runs: <span style={{ color: T.text }}>{workflow.runCount}</span>
        </span>
        {successRate !== null && (
          <span className="text-[11px]"
            style={{ color: successRate >= 80 ? T.green : successRate >= 50 ? T.gold : T.red }}>
            {successRate}% success
          </span>
        )}
        {workflow.lastRun && (
          <span className="text-[11px]" style={{ color: T.muted }}>
            Last: {new Date(workflow.lastRun).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t space-y-4" style={{ borderColor: T.border }}>

          {/* Pipeline visualisation */}
          <div className="pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: T.muted }}>Execution Pipeline</p>
            <div className="flex items-center gap-2 flex-wrap">

              {/* Trigger */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                style={{ backgroundColor: `${T.blue}15`, border: `1px solid ${T.blue}25` }}>
                <Zap className="h-3.5 w-3.5" style={{ color: T.blue }} />
                <span style={{ color: T.blue }}>
                  {workflow.trigger.type === 'event'
                    ? EVENT_LABELS[workflow.trigger.eventType!]
                    : workflow.trigger.schedule ?? workflow.trigger.type}
                </span>
              </div>

              {/* Conditions */}
              {workflow.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" style={{ color: T.muted }} />
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: `${T.gold}12`, border: `1px solid ${T.gold}25` }}>
                    <Filter className="h-3 w-3" style={{ color: T.gold }} />
                    <span style={{ color: T.gold }}>{c.label}</span>
                  </div>
                </div>
              ))}

              {/* Actions */}
              {workflow.actions.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" style={{ color: T.muted }} />
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: `${T.green}12`, border: `1px solid ${T.green}25` }}>
                    <Check className="h-3 w-3" style={{ color: T.green }} />
                    <span style={{ color: T.green }}>{a.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent executions */}
          {workflow.executions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: T.muted }}>Recent Executions</p>
              <div className="space-y-2">
                {workflow.executions.slice(0, 3).map(exec => (
                  <div key={exec.id} className="rounded-lg p-3"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={exec.status} />
                      <span className="text-[10px]" style={{ color: T.muted }}>
                        {new Date(exec.startedAt).toLocaleString('en-IN', {
                          day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
                        })}
                      </span>
                    </div>
                    <ExecutionTimeline steps={exec.steps} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
WorkflowCard.displayName = 'WorkflowCard'

// ── Workflow Editor Modal ──────────────────────────────────────────────────────
function WorkflowEditorModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<Workflow>
  onSave:  (w: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'executions' | 'runCount' | 'successCount'>) => void
  onClose: () => void
}) {
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [desc,        setDesc]        = useState(initial?.description ?? '')
  const [icon,        setIcon]        = useState(initial?.icon        ?? '⚡')
  const [category,    setCategory]    = useState<WorkflowCategory>(initial?.category ?? 'custom')
  const [trigType,    setTrigType]    = useState<TriggerType>(initial?.trigger?.type ?? 'event')
  const [eventType,   setEventType]   = useState<FinanceEventType | ''>(initial?.trigger?.eventType ?? '')
  const [schedule,    setSchedule]    = useState(initial?.trigger?.schedule ?? 'monthly')
  const [conditions,  setConditions]  = useState<WorkflowCondition[]>(initial?.conditions ?? [])
  const [actions,     setActions]     = useState<WorkflowAction[]>(initial?.actions ?? [
    { id: `a-${Date.now()}`, type: 'notify', label: 'Send Notification', config: { title: '', message: '' }, retries: 2 },
  ])

  const ICONS = ['⚡','🔔','💰','📈','🛡️','🎯','📋','🏦','⚠️','🔄','🤖','📊']
  const SCHEDULES = ['daily','weekly','monthly','quarterly','yearly']

  const addAction = () => setActions(prev => [
    ...prev,
    { id: `a-${Date.now()}`, type: 'notify', label: 'New Action', config: {}, retries: 2 },
  ])

  const updateAction = (idx: number, patch: Partial<WorkflowAction>) =>
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))

  const removeAction = (idx: number) =>
    setActions(prev => prev.filter((_, i) => i !== idx))

  const addCondition = () => setConditions(prev => [
    ...prev,
    { field: 'event.payload.amount', operator: '>', value: 0, label: 'Amount > 0' },
  ])

  const updateCondition = (idx: number, patch: Partial<WorkflowCondition>) =>
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))

  const removeCondition = (idx: number) =>
    setConditions(prev => prev.filter((_, i) => i !== idx))

  const handleSave = () => {
    if (!name.trim()) { toast.error('Workflow name is required'); return }
    if (trigType === 'event' && !eventType) { toast.error('Select an event type'); return }
    if (actions.length === 0) { toast.error('Add at least one action'); return }
    onSave({
      name: name.trim(), description: desc, icon, category,
      status: 'active', isTemplate: false, lastRun: undefined,
      trigger: { type: trigType, eventType: trigType === 'event' ? eventType as FinanceEventType : undefined, schedule: trigType === 'schedule' ? schedule : undefined },
      conditions, actions,
    })
  }

  const inputCls = "w-full h-8 px-3 text-xs rounded-lg"
  const inputSty = { backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }
  const labelSty = { color: T.muted, fontSize: '0.6875rem', fontWeight: 500 }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ backgroundColor: '#0f1523', border: `1px solid ${T.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: T.border }}>
          <p className="text-sm font-semibold" style={{ color: T.text }}>
            {initial?.id ? 'Edit Workflow' : 'Create Workflow'}
          </p>
          <button onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: T.muted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label style={labelSty}>Workflow Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Salary Auto-Processing"
                className={inputCls} style={inputSty} />
            </div>
            <div className="col-span-2 space-y-1">
              <label style={labelSty}>Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="What does this workflow do?"
                className={inputCls} style={inputSty} />
            </div>
            <div className="space-y-1">
              <label style={labelSty}>Icon</label>
              <div className="flex gap-1 flex-wrap">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)}
                    className="h-8 w-8 rounded-lg text-base transition-all"
                    style={{ backgroundColor: icon === ic ? `${T.blue}30` : 'rgba(255,255,255,0.04)',
                             border: `1px solid ${icon === ic ? T.blue : T.border}` }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label style={labelSty}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as WorkflowCategory)}
                className={inputCls} style={inputSty}>
                {(['income','expenses','investments','insurance','debt','goals','taxes','documents','alerts','custom'] as WorkflowCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trigger */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: `${T.blue}08`, border: `1px solid ${T.blue}20` }}>
            <p className="text-xs font-semibold flex items-center gap-2" style={{ color: T.blue }}>
              <Zap className="h-3.5 w-3.5" /> Trigger
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label style={labelSty}>Trigger Type</label>
                <select value={trigType} onChange={e => setTrigType(e.target.value as TriggerType)}
                  className={inputCls} style={inputSty}>
                  <option value="event">Finance Event</option>
                  <option value="schedule">Schedule</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
              {trigType === 'event' && (
                <div className="space-y-1">
                  <label style={labelSty}>Event Type *</label>
                  <select value={eventType} onChange={e => setEventType(e.target.value as FinanceEventType)}
                    className={inputCls} style={inputSty}>
                    <option value="">Select event…</option>
                    {(Object.entries(EVENT_LABELS) as [FinanceEventType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              {trigType === 'schedule' && (
                <div className="space-y-1">
                  <label style={labelSty}>Schedule</label>
                  <select value={schedule} onChange={e => setSchedule(e.target.value)}
                    className={inputCls} style={inputSty}>
                    {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-2" style={{ color: T.gold }}>
                <Filter className="h-3.5 w-3.5" /> Conditions (optional)
              </p>
              <button onClick={addCondition} className="text-[11px] flex items-center gap-1"
                style={{ color: T.gold }}>
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {conditions.map((cond, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-end">
                <div className="col-span-2 space-y-1">
                  <label style={labelSty}>Field</label>
                  <input value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })}
                    placeholder="event.payload.amount"
                    className={inputCls} style={inputSty} />
                </div>
                <div className="space-y-1">
                  <label style={labelSty}>Operator</label>
                  <select value={cond.operator}
                    onChange={e => updateCondition(i, { operator: e.target.value as any })}
                    className={inputCls} style={inputSty}>
                    {(['>', '<', '>=', '<=', '==', '!='] as const).map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 relative">
                  <label style={labelSty}>Value</label>
                  <div className="flex gap-1">
                    <input type="number" value={cond.value}
                      onChange={e => updateCondition(i, { value: parseFloat(e.target.value) })}
                      className={inputCls} style={inputSty} />
                    <button onClick={() => removeCondition(i)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ color: T.muted, backgroundColor: 'rgba(255,90,95,0.1)' }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {conditions.length === 0 && (
              <p className="text-[11px]" style={{ color: T.muted }}>
                No conditions — workflow runs for every matching event.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-2" style={{ color: T.green }}>
                <Check className="h-3.5 w-3.5" /> Actions *
              </p>
              <button onClick={addAction} className="text-[11px] flex items-center gap-1"
                style={{ color: T.green }}>
                <Plus className="h-3 w-3" /> Add Action
              </button>
            </div>
            {actions.map((action, i) => (
              <div key={action.id} className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: T.muted }}>
                    Step {i + 1}
                  </span>
                  <div className="flex-1">
                    <select value={action.type}
                      onChange={e => updateAction(i, { type: e.target.value as ActionType, label: ACTION_LABELS[e.target.value as ActionType] })}
                      className={inputCls} style={inputSty}>
                      {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => removeAction(i)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ color: T.muted }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Action-specific config */}
                {action.type === 'notify' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label style={labelSty}>Title</label>
                      <input value={action.config.title ?? ''}
                        onChange={e => updateAction(i, { config: { ...action.config, title: e.target.value } })}
                        placeholder="Notification title"
                        className={inputCls} style={inputSty} />
                    </div>
                    <div className="space-y-1">
                      <label style={labelSty}>Message (use {'{field}'} for dynamic values)</label>
                      <input value={action.config.message ?? ''}
                        onChange={e => updateAction(i, { config: { ...action.config, message: e.target.value } })}
                        placeholder="Your {lender} EMI is due"
                        className={inputCls} style={inputSty} />
                    </div>
                  </div>
                )}
                {action.type === 'sync_module' && (
                  <div className="space-y-1">
                    <label style={labelSty}>Target Module</label>
                    <select value={action.config.module ?? ''}
                      onChange={e => updateAction(i, { config: { ...action.config, module: e.target.value } })}
                      className={inputCls} style={inputSty}>
                      {['income','accounts','taxes','insurance','investments','debt','goals','tithe','documents','calendar','dashboard'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
                {action.type === 'trigger_ai' && (
                  <div className="space-y-1">
                    <label style={labelSty}>AI Prompt</label>
                    <input value={action.config.prompt ?? ''}
                      onChange={e => updateAction(i, { config: { ...action.config, prompt: e.target.value } })}
                      placeholder="Analyse my portfolio and suggest…"
                      className={inputCls} style={inputSty} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label style={labelSty}>Retries on failure:</label>
                  <input type="number" min="0" max="5" value={action.retries}
                    onChange={e => updateAction(i, { retries: parseInt(e.target.value) })}
                    className="w-16 h-6 px-2 text-xs rounded-lg text-center"
                    style={{ backgroundColor: '#0b0d0f', border: `1px solid ${T.border}`, color: T.text }} />
                </div>
              </div>
            ))}
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: T.border }}>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: T.green, color: '#000' }}>
              <Check className="h-4 w-4" />
              {initial?.id ? 'Update Workflow' : 'Create Workflow'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: T.muted }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

interface Props { jobs: any[]; userId: string }
type ActiveTab = 'dashboard' | 'workflows' | 'templates' | 'logs' | 'settings'

export function AutomationEngine({ jobs, userId }: Props) {
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('dashboard')
  const [workflows,    setWorkflows]    = useState<Workflow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [runningId,    setRunningId]    = useState<string | null>(null)
  const [editTarget,   setEditTarget]   = useState<Workflow | null>(null)
  const [showEditor,   setShowEditor]   = useState(false)
  const [logFilter,    setLogFilter]    = useState<ExecutionStatus | 'all'>('all')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [catFilter,    setCatFilter]    = useState<WorkflowCategory | 'all'>('all')
  const [liveEvents,   setLiveEvents]   = useState<string[]>([])
  const unsubRef = useRef<(() => void)[]>([])

  // ── Load workflows from Supabase on mount ─────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.from('import_jobs')
        .select('*').eq('user_id', userId)
        .eq('source_type', 'workflow').order('created_at', { ascending: false })

      const persisted: Workflow[] = (data ?? []).map((row: any) => {
        try { return JSON.parse(row.source_name) as Workflow } catch { return null }
      }).filter(Boolean)

      // Merge built-ins with persisted (persisted overrides by id)
      const persistedIds = new Set(persisted.map(w => w.id))
      const merged = [
        ...persisted,
        ...BUILT_IN_WORKFLOWS.filter(w => !persistedIds.has(w.id)),
      ]
      setWorkflows(merged)
      setLoading(false)
    }
    load()
  }, [userId])

  // ── Subscribe to DOM events emitted by eventBus ───────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setLiveEvents(prev => [
        `[${new Date().toLocaleTimeString('en-IN')}] ${detail.type} from ${detail.source}`,
        ...prev,
      ].slice(0, 50))
    }
    window.addEventListener('financeos:event', handler)
    return () => window.removeEventListener('financeos:event', handler)
  }, [])

  // ── Persist a workflow to Supabase ─────────────────────────────────────────
  const persistWorkflow = useCallback(async (wf: Workflow) => {
    const supabase = createClient()
    await supabase.from('import_jobs').upsert({
      user_id:          userId,
      source_type:      'workflow',
      source_name:      JSON.stringify(wf),
      status:           wf.status,
      records_imported: wf.runCount,
    }, { onConflict: 'user_id,source_name' })
  }, [userId])

  // ── Execute a workflow ─────────────────────────────────────────────────────
  const executeWorkflow = useCallback(async (wf: Workflow, triggeredBy = 'manual') => {
    setRunningId(wf.id)
    const execId = `exec-${Date.now()}`
    const now    = new Date().toISOString()

    const execution: WorkflowExecution = {
      id: execId, workflowId: wf.id, triggeredBy,
      status: 'running', startedAt: now, steps: [],
    }

    const steps: ExecutionStep[] = []

    try {
      for (const action of wf.actions) {
        let attempt = 0
        let success = false
        let lastErr = ''

        while (attempt <= action.retries && !success) {
          attempt++
          const stepStart = new Date().toISOString()
          const step: ExecutionStep = {
            actionId: action.id, label: action.label,
            status: 'running', startedAt: stepStart,
            attempt,
          }

          try {
            // Execute the action
            if (action.type === 'notify') {
              toast.info(action.config.title ?? action.label, {
                description: action.config.message,
              })
            } else if (action.type === 'recalculate') {
              // In production: call revalidatePath via a server action
              // Here we just log success
            } else if (action.type === 'trigger_ai') {
              // In production: POST to /api/copilot
            } else if (action.type === 'sync_module') {
              // In production: call confirmAndRoute with the event payload
            }
            // If no error thrown, mark success
            step.status  = 'success'
            step.endedAt = new Date().toISOString()
            step.output  = { message: `${action.label} completed` }
            success      = true
          } catch (err: any) {
            lastErr      = err?.message ?? 'Unknown error'
            step.status  = attempt <= action.retries ? 'running' : 'failed'
            step.error   = lastErr
            step.endedAt = new Date().toISOString()
            if (attempt <= action.retries) {
              await new Promise(r => setTimeout(r, 500 * attempt)) // backoff
            }
          }
          steps.push(step)
        }

        if (!success) {
          throw new Error(`Action "${action.label}" failed after ${action.retries + 1} attempts`)
        }
      }

      execution.status  = 'success'
      execution.steps   = steps
      execution.endedAt = new Date().toISOString()
      toast.success(`Workflow "${wf.name}" completed successfully`)

    } catch (err: any) {
      execution.status  = 'failed'
      execution.error   = err?.message
      execution.steps   = steps
      execution.endedAt = new Date().toISOString()
      toast.error(`Workflow "${wf.name}" failed: ${err?.message}`)
    }

    // Update workflow state
    const updated: Workflow = {
      ...wf,
      runCount:     wf.runCount + 1,
      successCount: execution.status === 'success' ? wf.successCount + 1 : wf.successCount,
      lastRun:      now,
      updatedAt:    now,
      executions:   [execution, ...wf.executions].slice(0, 20),
    }
    setWorkflows(prev => prev.map(w => w.id === wf.id ? updated : w))
    await persistWorkflow(updated)
    setRunningId(null)
  }, [persistWorkflow])

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const saveWorkflow = useCallback(async (
    data: Omit<Workflow, 'id'|'createdAt'|'updatedAt'|'executions'|'runCount'|'successCount'>
  ) => {
    const now = new Date().toISOString()
    const wf: Workflow = {
      ...data,
      id:           editTarget?.id ?? `wf-${Date.now()}`,
      createdAt:    editTarget?.createdAt ?? now,
      updatedAt:    now,
      executions:   editTarget?.executions ?? [],
      runCount:     editTarget?.runCount ?? 0,
      successCount: editTarget?.successCount ?? 0,
    }
    setWorkflows(prev =>
      editTarget ? prev.map(w => w.id === editTarget.id ? wf : w) : [wf, ...prev]
    )
    await persistWorkflow(wf)
    setShowEditor(false)
    setEditTarget(null)
    toast.success(editTarget ? 'Workflow updated' : 'Workflow created')
  }, [editTarget, persistWorkflow])

  const toggleWorkflow = useCallback(async (id: string) => {
    setWorkflows(prev => prev.map(w => {
      if (w.id !== id) return w
      const next = { ...w, status: (w.status === 'active' ? 'paused' : 'active') as WorkflowStatus }
      persistWorkflow(next)
      return next
    }))
  }, [persistWorkflow])

  const deleteWorkflow = useCallback(async (id: string) => {
    if (!confirm('Delete this workflow? This cannot be undone.')) return
    setWorkflows(prev => prev.filter(w => w.id !== id))
    toast.success('Workflow deleted')
  }, [])

  const activateTemplate = useCallback(async (tpl: Workflow) => {
    const now = new Date().toISOString()
    const wf: Workflow = {
      ...tpl,
      id:           `wf-${Date.now()}`,
      createdAt:    now,
      updatedAt:    now,
      executions:   [],
      runCount:     0,
      successCount: 0,
      isTemplate:   false,
      status:       'active',
    }
    setWorkflows(prev => [wf, ...prev])
    await persistWorkflow(wf)
    toast.success(`"${tpl.name}" activated`)
    setActiveTab('workflows')
  }, [persistWorkflow])

  // ── Derived values ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = workflows.filter(w => w.status === 'active').length
    const allExecs = workflows.flatMap(w => w.executions)
    const failed   = allExecs.filter(e => e.status === 'failed').length
    const success  = allExecs.filter(e => e.status === 'success').length
    const total    = allExecs.length
    const rate     = total > 0 ? Math.round((success / total) * 100) : 100
    const queue    = workflows.filter(w => runningId === w.id).length
    return { active, total: workflows.length, failed, success, rate, queue }
  }, [workflows, runningId])

  const allLogs = useMemo(() =>
    workflows.flatMap(w => w.executions.map(e => ({ ...e, workflowName: w.name, workflowIcon: w.icon })))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  , [workflows])

  const filteredLogs = useMemo(() =>
    allLogs.filter(e =>
      (logFilter === 'all' || e.status === logFilter) &&
      (searchQuery === '' || (e as any).workflowName.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  , [allLogs, logFilter, searchQuery])

  const filteredWorkflows = useMemo(() =>
    workflows.filter(w =>
      (catFilter === 'all' || w.category === catFilter) &&
      (searchQuery === '' || w.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  , [workflows, catFilter, searchQuery])

  const TAB_CFG: { id: ActiveTab; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard',  label: 'Dashboard',  icon: Activity  },
    { id: 'workflows',  label: 'Workflows',  icon: Zap,      badge: stats.active },
    { id: 'templates',  label: 'Templates',  icon: Copy      },
    { id: 'logs',       label: 'Logs',       icon: FileText, badge: stats.failed || undefined },
    { id: 'settings',   label: 'Settings',   icon: Settings  },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Workflow editor modal */}
      {showEditor && (
        <WorkflowEditorModal
          initial={editTarget ?? undefined}
          onSave={saveWorkflow}
          onClose={() => { setShowEditor(false); setEditTarget(null) }}
        />
      )}

      <div className="space-y-6">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold" style={{ color: T.text }}>Automation Hub</h1>
              <Zap className="h-4 w-4" style={{ color: T.gold }} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: T.muted }}>
              Central orchestration engine · {stats.active} active workflows · {stats.rate}% success rate
            </p>
          </div>
          <button onClick={() => { setEditTarget(null); setShowEditor(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: T.blue, color: '#fff' }}>
            <Plus className="h-4 w-4" /> New Workflow
          </button>
        </div>

        {/* ── Security banner ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 rounded-xl px-5 py-3.5"
          style={{ backgroundColor: `${T.green}08`, border: `1px solid ${T.green}20` }}>
          <Shield className="h-5 w-5 flex-shrink-0" style={{ color: T.green }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: T.text }}>
              Event-driven architecture · Zero duplicate logic
            </p>
            <p className="text-[11px]" style={{ color: T.muted }}>
              All modules share a single event bus. Workflows respond to events without duplicating business logic.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: T.green }} />
            <span className="text-xs" style={{ color: T.green }}>Engine running</span>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}` }}>
          {TAB_CFG.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? T.blue       : 'transparent',
                color:           activeTab === tab.id ? '#fff'       : T.muted,
                fontWeight:      activeTab === tab.id ? 600          : 400,
              }}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge ? (
                <span className="h-4 w-4 rounded-full text-[10px] flex items-center justify-center"
                  style={{ backgroundColor: tab.id === 'logs' ? T.red : T.gold, color: '#000', fontWeight: 700 }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: DASHBOARD                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="Active Workflows"  value={stats.active}   color={T.green}  icon={Zap}       />
              <KPICard label="Total Workflows"   value={stats.total}    color={T.blue}   icon={Activity}  />
              <KPICard label="Total Executions"  value={allLogs.length} color={T.purple} icon={RefreshCw} />
              <KPICard label="Success Rate"      value={`${stats.rate}%`} color={stats.rate >= 80 ? T.green : T.gold} icon={CheckCircle} sub={`${stats.success} successful`} />
              <KPICard label="Failed"            value={stats.failed}   color={stats.failed > 0 ? T.red : T.muted} icon={AlertCircle} />
              <KPICard label="Processing Queue"  value={stats.queue}    color={T.gold}   icon={Clock}     />
            </div>

            {/* Workflows overview + Live event log */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              {/* Active workflows */}
              <div className="xl:col-span-2 rounded-xl p-5 space-y-3"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                    Active Workflows
                  </p>
                  <button onClick={() => setActiveTab('workflows')} className="text-[11px]"
                    style={{ color: T.blue }}>
                    View all →
                  </button>
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : workflows.filter(w => w.status === 'active').length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Zap className="h-8 w-8" style={{ color: T.muted }} />
                    <p className="text-sm" style={{ color: T.muted }}>No active workflows</p>
                    <button onClick={() => setActiveTab('templates')}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: `${T.blue}15`, color: T.blue }}>
                      Browse Templates →
                    </button>
                  </div>
                ) : workflows.filter(w => w.status === 'active').slice(0, 6).map(wf => (
                  <div key={wf.id} className="flex items-center gap-3 py-2.5 border-b"
                    style={{ borderColor: T.border }}>
                    <span className="text-lg flex-shrink-0">{wf.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: T.text }}>{wf.name}</p>
                      <p className="text-[10px]" style={{ color: T.muted }}>
                        {wf.runCount} runs · {wf.successCount} succeeded
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px]" style={{ color: T.green }}>
                        {wf.runCount > 0 ? `${Math.round((wf.successCount/wf.runCount)*100)}%` : '—'}
                      </span>
                      <button onClick={() => executeWorkflow(wf)} disabled={runningId === wf.id}
                        className="h-6 w-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${T.green}15`, color: T.green }}>
                        {runningId === wf.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Play    className="h-3 w-3" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live event stream */}
              <div className="rounded-xl p-5 space-y-3"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: T.green }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                    Live Event Stream
                  </p>
                </div>
                {liveEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <Activity className="h-6 w-6" style={{ color: T.muted }} />
                    <p className="text-xs text-center" style={{ color: T.muted }}>
                      No events yet. Upload a document, add income, or sync a module to see events here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono">
                    {liveEvents.slice(0, 12).map((evt, i) => (
                      <p key={i} className="text-[10px]" style={{ color: i === 0 ? T.green : T.muted }}>
                        {evt}
                      </p>
                    ))}
                  </div>
                )}
                {/* System jobs status */}
                <div className="pt-3 border-t space-y-2" style={{ borderColor: T.border }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                    System Jobs
                  </p>
                  {[
                    { label: 'Document Processor',  color: T.green  },
                    { label: 'Module Syncer',        color: T.green  },
                    { label: 'Notification Worker',  color: T.green  },
                    { label: 'AI Analyser',          color: T.gold   },
                  ].map(job => (
                    <div key={job.label} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: job.color }} />
                      <span className="text-[11px]" style={{ color: T.muted }}>{job.label}</span>
                      <span className="ml-auto text-[10px]" style={{ color: job.color }}>
                        {job.color === T.green ? 'Running' : 'Idle'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent executions */}
            <div className="rounded-xl p-5 space-y-3"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                  Recent Executions
                </p>
                <button onClick={() => setActiveTab('logs')} className="text-[11px]" style={{ color: T.blue }}>
                  View logs →
                </button>
              </div>
              {allLogs.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: T.muted }}>
                  No executions yet — run a workflow to see history here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {['Workflow','Status','Steps','Started','Duration'].map(h => (
                          <th key={h} className="pb-3 text-left pr-4"
                            style={{ color: T.muted, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allLogs.slice(0, 8).map((exec: any) => {
                        const dur = exec.endedAt
                          ? `${((new Date(exec.endedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(1)}s`
                          : '—'
                        return (
                          <tr key={exec.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <span>{exec.workflowIcon}</span>
                                <span className="font-medium truncate max-w-[180px]" style={{ color: T.text }}>
                                  {exec.workflowName}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4"><StatusBadge status={exec.status} /></td>
                            <td className="py-2.5 pr-4" style={{ color: T.muted }}>
                              {exec.steps.length} steps
                            </td>
                            <td className="py-2.5 pr-4" style={{ color: T.muted }}>
                              {new Date(exec.startedAt).toLocaleString('en-IN', {
                                day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
                              })}
                            </td>
                            <td className="py-2.5" style={{ color: T.muted }}>{dur}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: WORKFLOWS                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'workflows' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex gap-3 flex-wrap">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search workflows…"
                className="flex-1 min-w-48 h-9 px-4 text-sm rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value as any)}
                className="h-9 px-3 text-sm rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                <option value="all">All Categories</option>
                {(['income','expenses','investments','insurance','debt','goals','taxes','documents','alerts','custom'] as WorkflowCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-4 rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <Zap className="h-10 w-10" style={{ color: T.muted }} />
                <p className="text-sm" style={{ color: T.muted }}>No workflows found</p>
                <div className="flex gap-2">
                  <button onClick={() => { setEditTarget(null); setShowEditor(true) }}
                    className="px-4 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: `${T.blue}15`, color: T.blue }}>
                    Create Workflow
                  </button>
                  <button onClick={() => setActiveTab('templates')}
                    className="px-4 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: `${T.green}15`, color: T.green }}>
                    Browse Templates
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWorkflows.map(wf => (
                  <WorkflowCard key={wf.id} workflow={wf}
                    running={runningId === wf.id}
                    onToggle={toggleWorkflow}
                    onDelete={deleteWorkflow}
                    onEdit={w => { setEditTarget(w); setShowEditor(true) }}
                    onRun={executeWorkflow} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: TEMPLATES                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ backgroundColor: `${T.blue}08`, border: `1px solid ${T.blue}20` }}>
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: T.blue }} />
              <p className="text-xs" style={{ color: T.muted }}>
                Pre-built workflows for common Indian finance scenarios. Activate any template to create
                a live workflow in your account. You can customise it after activation.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BUILT_IN_WORKFLOWS.map(tpl => {
                const catColor = CAT_COLORS[tpl.category] ?? T.muted
                const alreadyActive = workflows.some(w => w.name === tpl.name && !w.isTemplate)
                return (
                  <div key={tpl.id} className="rounded-xl p-5 space-y-4"
                    style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{tpl.icon}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: T.text }}>{tpl.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${catColor}15`, color: catColor }}>
                            {tpl.category}
                          </span>
                        </div>
                      </div>
                      {alreadyActive ? (
                        <span className="text-[11px] px-2 py-1 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: `${T.green}15`, color: T.green }}>
                          ✓ Active
                        </span>
                      ) : (
                        <button onClick={() => activateTemplate(tpl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: T.blue, color: '#fff' }}>
                          <Zap className="h-3 w-3" /> Activate
                        </button>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: T.muted }}>{tpl.description}</p>
                    {/* Pipeline preview */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-1 rounded"
                        style={{ backgroundColor: `${T.blue}12`, color: T.blue }}>
                        {tpl.trigger.type === 'event'
                          ? EVENT_LABELS[tpl.trigger.eventType!]
                          : tpl.trigger.schedule ?? tpl.trigger.type}
                      </span>
                      {tpl.conditions.length > 0 && <>
                        <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: T.muted }} />
                        <span className="text-[10px] px-2 py-1 rounded"
                          style={{ backgroundColor: `${T.gold}12`, color: T.gold }}>
                          {tpl.conditions.length} condition{tpl.conditions.length > 1 ? 's' : ''}
                        </span>
                      </>}
                      {tpl.actions.map((a, i) => (
                        <div key={a.id} className="flex items-center gap-1.5">
                          <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: T.muted }} />
                          <span className="text-[10px] px-2 py-1 rounded"
                            style={{ backgroundColor: `${T.green}12`, color: T.green }}>
                            {a.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: LOGS                                                            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search logs…"
                className="flex-1 min-w-48 h-9 px-4 text-sm rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              <div className="flex gap-1">
                {(['all','success','failed','running','pending'] as const).map(f => (
                  <button key={f} onClick={() => setLogFilter(f)}
                    className="px-3 py-2 rounded-lg text-xs transition-all"
                    style={{
                      backgroundColor: logFilter === f
                        ? f === 'failed' ? T.red : f === 'success' ? T.green : T.blue
                        : 'rgba(255,255,255,0.04)',
                      color: logFilter === f ? '#fff' : T.muted,
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 rounded-xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <FileText className="h-10 w-10" style={{ color: T.muted }} />
                <p className="text-sm" style={{ color: T.muted }}>
                  {logFilter === 'all' ? 'No execution logs yet' : `No ${logFilter} executions`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((exec: any) => {
                  const dur = exec.endedAt
                    ? `${((new Date(exec.endedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(1)}s`
                    : '—'
                  return (
                    <div key={exec.id} className="rounded-xl p-4 space-y-3"
                      style={{ backgroundColor: T.card, border: `1px solid ${exec.status === 'failed' ? T.red + '30' : T.border}` }}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-lg">{exec.workflowIcon}</span>
                        <p className="text-sm font-medium" style={{ color: T.text }}>{exec.workflowName}</p>
                        <StatusBadge status={exec.status} />
                        <span className="text-[11px] ml-auto" style={{ color: T.muted }}>
                          {new Date(exec.startedAt).toLocaleString('en-IN', {
                            day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
                          })} · {dur}
                        </span>
                      </div>
                      {exec.error && (
                        <p className="text-[11px] px-3 py-2 rounded-lg"
                          style={{ backgroundColor: `${T.red}10`, color: T.red, border: `1px solid ${T.red}25` }}>
                          {exec.error}
                        </p>
                      )}
                      <ExecutionTimeline steps={exec.steps} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB: SETTINGS                                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-5 max-w-2xl">

            <div className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Engine Settings</p>
              {[
                { label: 'Auto-run on document upload',       desc: 'Trigger workflows when a document is processed', on: true  },
                { label: 'Auto-run on salary received',       desc: 'Fire salary processing workflow automatically',  on: true  },
                { label: 'Budget alert notifications',        desc: 'Notify when spending exceeds 80% of income',     on: true  },
                { label: 'Monthly schedule workflows',        desc: 'Run scheduled workflows on the 1st of each month', on: true },
                { label: 'AI analysis on executions',         desc: 'Allow AI to analyse workflow results',            on: false },
                { label: 'Email notifications (coming soon)', desc: 'Send email when workflows fail',                  on: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b"
                  style={{ borderColor: T.border }}>
                  <div>
                    <p className="text-sm" style={{ color: T.text }}>{item.label}</p>
                    <p className="text-[11px]" style={{ color: T.muted }}>{item.desc}</p>
                  </div>
                  <div className="h-5 w-9 rounded-full flex items-center cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: item.on ? T.blue : T.border, padding: '2px' }}>
                    <div className="h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: item.on ? 'translateX(16px)' : 'translateX(0)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Module integrations */}
            <div className="rounded-xl p-5 space-y-3"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Module Integrations</p>
              <p className="text-[11px]" style={{ color: T.muted }}>
                All modules are connected through the shared event bus. Events flow automatically.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Income',       icon: TrendingUp,  connected: true  },
                  { label: 'Accounts',     icon: Wallet,      connected: true  },
                  { label: 'Expenses',     icon: BarChart3,   connected: true  },
                  { label: 'Investments',  icon: TrendingUp,  connected: true  },
                  { label: 'Insurance',    icon: Shield,      connected: true  },
                  { label: 'Debt',         icon: AlertCircle, connected: true  },
                  { label: 'Goals',        icon: Target,      connected: true  },
                  { label: 'Documents',    icon: FileText,    connected: true  },
                  { label: 'Calendar',     icon: Calendar,    connected: true  },
                  { label: 'Taxes',        icon: BarChart3,   connected: true  },
                  { label: 'Tithe',        icon: Bell,        connected: true  },
                  { label: 'AI Copilot',   icon: Zap,         connected: true  },
                ].map(mod => (
                  <div key={mod.label} className="flex items-center gap-2 rounded-lg p-2.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                    <mod.icon className="h-3.5 w-3.5 flex-shrink-0"
                      style={{ color: mod.connected ? T.green : T.muted }} />
                    <span className="text-[11px]" style={{ color: T.text }}>{mod.label}</span>
                    <span className="ml-auto text-[9px]"
                      style={{ color: mod.connected ? T.green : T.muted }}>
                      {mod.connected ? '●' : '○'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture note */}
            <div className="rounded-xl p-5 space-y-2"
              style={{ backgroundColor: `${T.blue}08`, border: `1px solid ${T.blue}20` }}>
              <p className="text-xs font-semibold" style={{ color: T.blue }}>
                Architecture: Event-Driven Orchestration
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: T.muted }}>
                Workflows are stored as JSON in Supabase. The event bus (lib/automation/event-bus.ts)
                is a client-side singleton — modules call emitFinanceEvent() to emit typed events.
                The engine subscribes to events and executes matching workflows.
                No business logic is duplicated — sync_module actions call the same confirmAndRoute()
                server action used by the Documents module.
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
