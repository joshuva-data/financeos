import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FINANCEOS_TOOLS } from '../tools/definitions'
import { executeTool, type ToolName } from '../tools/executor'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are the AI Financial Copilot for FinanceOS — a personal finance OS for an Indian user.

Your primary role is to answer financial questions accurately using the provided tools.
NEVER guess, estimate, or hallucinate financial figures.
ALWAYS use tools to fetch data before answering.
Use ₹ symbol and Indian number formatting (use "lakhs" for 1,00,000 and "crores" for 1,00,00,000).
Be concise, direct, and professional. You are a trusted financial assistant.

When answering:
- For net worth questions: call get_net_worth
- For insurance questions: call get_insurance_coverage or get_upcoming_renewals
- For tax questions: call calculate_tax_estimate
- For debt/EMI questions: call get_debt_summary
- For money owed to user: call get_receivables
- For expense analysis: call get_expense_analysis
- For tithe: call calculate_tithe
- For investments: call get_investment_portfolio
- For salary/employer benefits: call get_corporate_benefits

If a question requires multiple data sources, call multiple tools before responding.
After getting tool results, give a clear, structured answer. Format numbers with Indian commas (₹8,47,320 not ₹847320).
`

export interface CopilotTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface CopilotResponse {
  answer: string
  toolsUsed: string[]
  turnCount: number
}

export async function runCopilot(
  query: string,
  history: CopilotTurn[],
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CopilotResponse> {
  const messages: MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content } as MessageParam)),
    { role: 'user', content: query },
  ]

  const toolsUsed: string[] = []
  let finalAnswer = ''
  let turnCount = 0
  const MAX_TURNS = 5  // prevent runaway tool loops

  while (turnCount < MAX_TURNS) {
    turnCount++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: FINANCEOS_TOOLS,
      messages,
    })

    // Collect text blocks
    const textBlocks = response.content.filter(b => b.type === 'text')
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')

    // If no tool calls, we have the final answer
    if (response.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      finalAnswer = textBlocks.map(b => b.type === 'text' ? b.text : '').join('')
      break
    }

    // Add assistant message with tool use blocks
    messages.push({ role: 'assistant', content: response.content })

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolBlocks.map(async block => {
        if (block.type !== 'tool_use') return null

        toolsUsed.push(block.name)

        try {
          const result = await executeTool(
            block.name as ToolName,
            block.input as Record<string, unknown>,
            supabase,
            userId
          )
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          }
        } catch (err) {
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }),
            is_error: true,
          }
        }
      })
    )

    // Add tool results for next iteration
    messages.push({
      role: 'user',
      content: toolResults.filter(Boolean) as any,
    })
  }

  return { answer: finalAnswer, toolsUsed: [...new Set(toolsUsed)], turnCount }
}