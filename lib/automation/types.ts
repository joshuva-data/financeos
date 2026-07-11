// ── Event types emitted by FinanceOS modules ───────────────────────────────────
export type FinanceEventType =
  | 'salary.received'
  | 'expense.created'
  | 'document.uploaded'
  | 'investment.updated'
  | 'insurance.renewal_due'
  | 'debt.payment_due'
  | 'goal.completed'
  | 'goal.milestone'
  | 'recurring.detected'
  | 'tax.document_processed'
  | 'account.balance_low'
  | 'budget.exceeded'
  | 'subscription.detected'
  | 'portfolio.rebalance_due'
  | 'tithe.due'

export interface FinanceEvent {
  id:        string
  type:      FinanceEventType
  source:    string          // which module emitted this
  payload:   Record<string, any>
  timestamp: string
  userId:    string
}

// ── Trigger — what starts a workflow ──────────────────────────────────────────
export type TriggerType =
  | 'event'        // fired when a FinanceEvent occurs
  | 'schedule'     // cron-like recurring
  | 'manual'       // user-initiated
  | 'threshold'    // when a value crosses a boundary

export interface WorkflowTrigger {
  type:       TriggerType
  eventType?: FinanceEventType   // for 'event' triggers
  schedule?:  string             // e.g. 'monthly' | 'weekly' | 'daily'
  threshold?: { field: string; operator: '>' | '<' | '='; value: number }
}

// ── Condition — optional guard before executing actions ────────────────────────
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export interface WorkflowCondition {
  field:    string            // e.g. 'event.payload.amount'
  operator: ConditionOperator
  value:    any
  label:    string            // human-readable description
}

// ── Action — what the workflow does ───────────────────────────────────────────
export type ActionType =
  | 'notify'          // show a toast / notification
  | 'sync_module'     // push data to a FinanceOS module
  | 'update_goal'     // contribute to a goal
  | 'create_record'   // insert a DB record
  | 'send_email'      // placeholder — future
  | 'trigger_ai'      // ask AI Copilot for analysis
  | 'recalculate'     // recompute dashboard/taxes/networth
  | 'flag_review'     // mark something for manual review

export interface WorkflowAction {
  id:      string
  type:    ActionType
  label:   string
  config:  Record<string, any>
  retries: number    // how many times to retry on failure
}

// ── Execution status ───────────────────────────────────────────────────────────
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface ExecutionStep {
  actionId:  string
  label:     string
  status:    ExecutionStatus
  startedAt: string
  endedAt?:  string
  error?:    string
  output?:   Record<string, any>
  attempt:   number
}

export interface WorkflowExecution {
  id:         string
  workflowId: string
  triggeredBy: string        // event ID or 'manual' or 'schedule'
  status:     ExecutionStatus
  startedAt:  string
  endedAt?:   string
  steps:      ExecutionStep[]
  event?:     FinanceEvent
  error?:     string
}

// ── Workflow — the full definition ────────────────────────────────────────────
export type WorkflowStatus = 'active' | 'paused' | 'draft' | 'archived'

export interface Workflow {
  id:          string
  name:        string
  description: string
  icon:        string
  category:    WorkflowCategory
  status:      WorkflowStatus
  trigger:     WorkflowTrigger
  conditions:  WorkflowCondition[]
  actions:     WorkflowAction[]
  executions:  WorkflowExecution[]
  createdAt:   string
  updatedAt:   string
  runCount:    number
  successCount:number
  lastRun?:    string
  isTemplate:  boolean
}

export type WorkflowCategory =
  | 'income'
  | 'expenses'
  | 'investments'
  | 'insurance'
  | 'debt'
  | 'goals'
  | 'taxes'
  | 'documents'
  | 'alerts'
  | 'custom'

