// ============================================================================
// lib/ai/services/prompt-orchestrator.service.ts
//
// PROMPT ORCHESTRATOR
// ----------------------
// The one place that talks to the LLM. Responsibilities:
//   1. Build the system prompt from a FinancialContext + today's Executive
//      Brief so the model starts every turn already grounded in the user's
//      real numbers (Requirement 3/5).
//   2. Run the Groq tool-calling loop: the model can call any of the
//      FINANCEOS_TOOLS as many times as it needs (Requirement 5 — reasoning
//      across modules, not a single source) before producing a final answer.
//   3. Detect when the model's answer implies an actionable next step and
//      generate a ProposedAction for the Action Center (Requirement 8) —
//      the model NEVER executes anything itself, it only informs the
//      Action Generator via lightweight signals in its own text.
//
// Provider note: FinanceOS uses Groq (OpenAI-compatible chat completions +
// function calling) rather than a native Anthropic client. Groq's tool
// format differs from Anthropic's, which is why FINANCEOS_TOOLS (in
// lib/ai/tools/definitions.ts) is stored as neutral JSON Schema and adapted
// to OpenAI "functions" shape here rather than imported pre-shaped.
// ============================================================================

import Groq from 'groq-sdk'
import type { SupabaseServerClient } from '../types'
import type { FinancialContext, CopilotTurn, ProposedAction } from '../types'
import { FINANCEOS_TOOLS, type FinanceOSTool } from '../tools/definitions'
import { executeTool, type ToolName } from '../tools/executor'
import { generateExecutiveBrief, generateRecommendations } from './recommendation-engine.service'

type Client = SupabaseServerClient

const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
const MAX_TOOL_LOOPS = 6

let groqClient: Groq | null = null
function getGroq(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY is not set')
    groqClient = new Groq({ apiKey })
  }
  return groqClient
}

// ── Adapt neutral tool definitions → Groq/OpenAI function-calling shape ─────

function toGroqTools(tools: FinanceOSTool[]): Groq.Chat.Completions.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

// ── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: FinancialContext): string {
  const brief = generateExecutiveBrief(ctx)

  return `You are the AI Copilot inside FinanceOS, a personal financial operating system for an Indian user (INR currency, April–March financial year).

You are the application's intelligent financial reasoning layer — not a generic chatbot. You have direct tool access to all 13 FinanceOS modules: Accounts, Income, Expenses, Investments, Debt, Insurance, Taxes, Goals, Documents, Analytics, Calendar, Notifications, and Automation.

TODAY'S SNAPSHOT (already computed, use directly — do not ask the user for these numbers):
- Net worth: ₹${ctx.netWorth.toLocaleString('en-IN')}
- Financial health score: ${ctx.healthScore}/100
- Liquid cash: ₹${ctx.liquidCash.toLocaleString('en-IN')} (${ctx.emergencyFundMonths.toFixed(1)} months of expenses)
- Monthly income: ₹${ctx.monthlyIncome.toLocaleString('en-IN')} | This month's spend: ₹${ctx.thisMonthSpend.toLocaleString('en-IN')}
- Total debt: ₹${ctx.totalDebt.toLocaleString('en-IN')} (EMI ratio: ${ctx.debtRatio}%)
- Investment portfolio: ₹${ctx.portfolioValue.toLocaleString('en-IN')} (${ctx.portfolioGainPct.toFixed(1)}% gain)
- Estimated tax due (FY ${ctx.currentFY}): ₹${ctx.taxDue.toLocaleString('en-IN')}
- Upcoming events (45 days): ${ctx.upcomingEvents.slice(0, 3).map(e => `${e.label} on ${e.date}`).join('; ') || 'none'}
- Unread notifications: ${ctx.unreadNotificationCount} | Active automations: ${ctx.activeAutomationCount}
- Executive brief headline: "${brief.headline}"

REASONING RULES:
1. Reason across modules, not from a single source. A question about "should I invest more" touches Investments, Debt (is there higher-interest debt to clear first?), and the emergency fund (Accounts) — check all relevant ones before answering.
2. Use tools to get precise, current numbers rather than relying only on the snapshot above, especially for anything involving a specific time period, category breakdown, comparison, forecast, or document.
3. Every recommendation you give must include: WHY (the specific numbers behind it), WHICH DATA (which module/tool you used), a rough CONFIDENCE level if the claim involves projection or estimation, and a concrete NEXT ACTION the user can take.
4. For cash-flow forecasts, always state the assumptions/basis plainly — never present a projection as certain.
5. You cannot execute actions yourself (categorizing transactions, creating reminders, generating reports, setting up automations). If the user asks for one of these, say you'll prepare it for their confirmation in the Action Center rather than claiming to have done it.
6. Keep answers concise and scannable — use short paragraphs or a few bullet points, not long essays, unless the user asks for depth.
7. Currency is always INR (₹), formatted with Indian digit grouping (e.g. ₹12,50,000).
8. If data is missing for a module, say so plainly rather than inventing numbers.`
}

// ── Main orchestration loop ──────────────────────────────────────────────────

export interface OrchestratorResult {
  answer: string
  toolsUsed: string[]
  turnCount: number
  proposedActions: ProposedAction[]
}

export async function runCopilotTurn(
  supabase: Client,
  userId: string,
  ctx: FinancialContext,
  history: CopilotTurn[],
  userMessage: string
): Promise<OrchestratorResult> {
  const groq = getGroq()
  const systemPrompt = buildSystemPrompt(ctx)

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(t => ({ role: t.role, content: t.content } as Groq.Chat.Completions.ChatCompletionMessageParam)),
    { role: 'user', content: userMessage },
  ]

  const toolsUsed = new Set<string>()
  let turnCount = 0

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    turnCount++
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: toGroqTools(FINANCEOS_TOOLS),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1200,
    })

    const choice = completion.choices[0]
    const toolCalls = choice.message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      // Model is done reasoning — this is the final answer.
      const answer = choice.message.content ?? "I wasn't able to generate a response — please try rephrasing."
      return {
        answer,
        toolsUsed: Array.from(toolsUsed),
        turnCount,
        proposedActions: detectActionIntents(userMessage, answer),
      }
    }

    // Append the assistant's tool-call turn, then run each tool and append results.
    messages.push(choice.message)

    for (const call of toolCalls) {
      const name = call.function.name as ToolName
      toolsUsed.add(name)
      let result: unknown
      try {
        const input = call.function.arguments ? JSON.parse(call.function.arguments) : {}
        result = await executeTool(name, input, supabase, userId)
      } catch (err) {
        result = { error: err instanceof Error ? err.message : 'Tool execution failed' }
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })
    }
  }

  // Safety valve: if the model is still calling tools after MAX_TOOL_LOOPS,
  // force a final answer instead of looping forever.
  const finalCompletion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [...messages, { role: 'user', content: 'Please give your best answer now based on the information gathered so far.' }],
    temperature: 0.3,
    max_tokens: 1000,
  })

  const answer = finalCompletion.choices[0].message.content ?? 'I gathered some data but ran out of reasoning steps — could you narrow the question a bit?'
  return { answer, toolsUsed: Array.from(toolsUsed), turnCount, proposedActions: detectActionIntents(userMessage, answer) }
}

// ── Lightweight intent detection for the Action Center ──────────────────────
// The model itself never triggers actions (see class doc comment above) — we
// scan the conversational surface for a small set of clear signals instead,
// so proposing an action is deterministic and auditable rather than something
// hidden inside a free-text model response.

function detectActionIntents(userMessage: string, answer: string): ProposedAction[] {
  const msg = userMessage.toLowerCase()
  const actions: ProposedAction[] = []

  if (/remind|reminder|don'?t forget|alert me/.test(msg)) {
    actions.push({
      actionType: 'create_reminder',
      title: 'Create a reminder',
      description: 'I can add this to your Calendar as a reminder — confirm details in the Action Center.',
      why: 'Your message asked to be reminded about something.',
      sources: ['Calendar'],
      confidence: 'Medium',
      payload: { note: userMessage },
    })
  }

  if (/generate.*report|summary (report|pdf|doc)|export.*summary/.test(msg)) {
    actions.push({
      actionType: 'generate_report',
      title: 'Generate a report',
      description: 'I can compile this into a downloadable report.',
      why: 'Your message asked for a report/summary export.',
      sources: ['Analytics'],
      confidence: 'Medium',
      payload: { reportType: 'monthly_summary' },
    })
  }

  if (/automat(e|ion)/.test(msg)) {
    actions.push({
      actionType: 'suggest_automation',
      title: 'Set up an automation',
      description: 'I can draft an automation for this — you can review and activate it in the Automation module.',
      why: 'Your message asked about automating something.',
      sources: ['Automation'],
      confidence: 'Medium',
      payload: {},
    })
  }

  if (/categorize|categorise/.test(msg)) {
    actions.push({
      actionType: 'categorize_transactions',
      title: 'Categorize transactions',
      description: 'I can review and assign categories to uncategorized transactions for you to confirm.',
      why: 'Your message asked about transaction categorization.',
      sources: ['Expenses'],
      confidence: 'Medium',
      payload: {},
    })
  }

  return actions
}
