// ============================================================================
// lib/ai/services/action-generator.service.ts
//
// ACTION GENERATOR
// ------------------
// Builds ProposedAction objects (lib/ai/types.ts) — the Action Center's unit
// of work. This service NEVER executes anything against the database; it
// only shapes a well-explained proposal. Execution is handled separately by
// lib/ai/actions/action-store.ts's `executeConfirmedAction`, and only ever
// runs after the action's status has been flipped to 'confirmed' by the user
// (Requirement 8).
//
// Keeping "propose" and "execute" as two different functions in two
// different modules is a deliberate safety boundary — the Prompt
// Orchestrator can call `propose*` freely while reasoning, but nothing in
// the reasoning path has a path to `execute`.
// ============================================================================

import type { FinancialContext, ProposedAction, RecurringSubscription } from '../types'

export function proposeCategorizeTransactions(
  uncategorizedCount: number,
  sampleCategories: string[]
): ProposedAction {
  return {
    actionType: 'categorize_transactions',
    title: `Categorize ${uncategorizedCount} uncategorized transaction${uncategorizedCount === 1 ? '' : 's'}`,
    description: `I can assign categories (e.g. ${sampleCategories.slice(0, 3).join(', ') || 'Groceries, Transport, Utilities'}) to transactions that don't have one yet, based on merchant name and past patterns.`,
    why: `${uncategorizedCount} transaction(s) in your Expenses module have no category, which understates your top-category breakdown and skews recommendations.`,
    sources: ['Expenses'],
    confidence: uncategorizedCount > 0 ? 'Medium' : 'Low',
    payload: { uncategorizedCount },
  }
}

export function proposeReminder(
  label: string,
  dueDate: string,
  amount: number | undefined,
  sourceModule: string
): ProposedAction {
  return {
    actionType: 'create_reminder',
    title: `Create a reminder for ${label}`,
    description: `I can add a calendar reminder for ${label}${amount ? ` (₹${amount.toLocaleString('en-IN')})` : ''} due ${new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
    why: `${label} is coming up and isn't yet tracked as a calendar reminder.`,
    sources: [sourceModule, 'Calendar'],
    confidence: 'High',
    payload: { label, dueDate, amount },
  }
}

export function proposeReport(
  reportType: 'monthly_summary' | 'tax_summary' | 'net_worth_summary',
  ctx: FinancialContext
): ProposedAction {
  const titles: Record<typeof reportType, string> = {
    monthly_summary: 'Monthly financial summary',
    tax_summary: `Tax summary for FY ${ctx.currentFY}`,
    net_worth_summary: 'Net worth report',
  } as const

  return {
    actionType: 'generate_report',
    title: `Generate: ${titles[reportType]}`,
    description: `I can compile a ${titles[reportType].toLowerCase()} from your current data as a downloadable report.`,
    why: 'You asked for a summary that pulls together multiple modules — a generated report is easier to save or share than a chat reply.',
    sources: ['Analytics'],
    confidence: 'High',
    payload: { reportType },
  }
}

export function proposeAutomationFromSubscriptions(
  subscriptions: RecurringSubscription[]
): ProposedAction | null {
  if (subscriptions.length === 0) return null
  const totalAnnual = subscriptions.reduce((s, sub) => s + sub.annualCost, 0)
  return {
    actionType: 'suggest_automation',
    title: `Set up a subscription-tracking automation`,
    description: `I found ${subscriptions.length} likely recurring subscription(s) costing ~₹${totalAnnual.toLocaleString('en-IN')}/year. I can create an automation that flags new recurring charges automatically so nothing renews unnoticed.`,
    why: `Detected via a monthly-cadence pattern across ${subscriptions.length} category/amount group(s) in your transaction history: ${subscriptions.slice(0, 3).map(s => s.merchantOrCategory).join(', ')}.`,
    sources: ['Expenses', 'Automation'],
    confidence: subscriptions.length >= 2 ? 'High' : 'Medium',
    payload: { subscriptions },
  }
}

export function proposeGoalUpdate(
  goalName: string,
  suggestedContribution: number,
  reason: string
): ProposedAction {
  return {
    actionType: 'update_goal',
    title: `Add ₹${suggestedContribution.toLocaleString('en-IN')} to "${goalName}"`,
    description: `Based on this month's surplus, I can log a contribution of ₹${suggestedContribution.toLocaleString('en-IN')} toward "${goalName}".`,
    why: reason,
    sources: ['Goals', 'Accounts'],
    confidence: 'Medium',
    payload: { goalName, suggestedContribution },
  }
}

export function proposeFlagForReview(
  itemLabel: string,
  reason: string,
  sourceModule: string
): ProposedAction {
  return {
    actionType: 'flag_for_review',
    title: `Flag "${itemLabel}" for review`,
    description: `I can mark ${itemLabel} for follow-up so it surfaces again next time you open ${sourceModule}.`,
    why: reason,
    sources: [sourceModule],
    confidence: 'Medium',
    payload: { itemLabel },
  }
}
