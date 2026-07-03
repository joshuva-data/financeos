import Anthropic from '@anthropic-ai/sdk'
import type { DashboardSummary } from '@/types/database'

const client = new Anthropic()  // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = (ctx: DashboardSummary) => `
You are the FinanceOS AI Copilot for a single Indian user.
Today's date: ${new Date().toLocaleDateString('en-IN')}
Financial year: India FY (April–March)

AUTHORITATIVE FINANCIAL CONTEXT (query this data, never hallucinate figures):
${JSON.stringify({
  netWorth: ctx.netWorth,
  netWorthChange: ctx.netWorthChange,
  liquidCash: ctx.liquidCash,
  investedValue: ctx.investedValue,
  debtTotal: ctx.debtTotal,
  receivablesTotal: ctx.receivablesTotal,
  monthlyIncome: ctx.monthlyIncome,
  monthlyExpenses: ctx.monthlyExpenses,
  savingsRate: ctx.savingsRate,
  overdueReceivables: ctx.overdueReceivables.map(r => ({ from: (r as any).from_name, amount: (r as any).balance_due, due: (r as any).due_date })),
  insuranceRenewals: ctx.insuranceRenewalsNext30Days.map(p => ({ name: (p as any).policy_name, renewal: (p as any).renewal_date, premium: (p as any).annual_premium })),
  emisDue: ctx.emisDueThisMonth.map(d => ({ lender: (d as any).lender_name, emi: (d as any).emi_amount, next: (d as any).next_emi_date })),
}, null, 2)}

RULES:
- Only cite numbers from the context above. Never guess or estimate figures not in context.
- Be concise. Use ₹ symbol and Indian number formatting (lakhs, crores).
- For "what is my net worth" — answer immediately from context.
- For complex tax or investment questions, note limitations and recommend a CA.
- If data is insufficient, say so clearly. Never fabricate.
`

export async function queryCopilot(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  context: DashboardSummary
) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT(context),
    messages: [...history, { role: 'user', content: query }],
  })

  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
}