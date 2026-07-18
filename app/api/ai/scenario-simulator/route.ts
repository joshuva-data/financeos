// ============================================================================
// app/api/ai/scenario-simulator/route.ts
//
// Standalone endpoint for the Scenario Simulator (v5 Deliverable 13) — the
// AI Copilot's chat can reach the same logic via the simulate_scenario tool
// (lib/ai/tools/executor.ts), but a dedicated "What If" page shouldn't have
// to go through a chat turn to run one. Both paths call the same
// lib/ai/services/scenario-simulator.service.ts — no duplicated logic.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFinancialContext } from '@/lib/ai/services/context-builder.service'
import { simulateScenario } from '@/lib/ai/services/scenario-simulator.service'
import type { ScenarioType } from '@/lib/ai/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      scenarioType: ScenarioType
      amount?: number
      targetDebtLender?: string
      projectionMonths?: number
    }

    const validTypes: ScenarioType[] = ['increase_income', 'increase_expense', 'increase_sip', 'early_loan_payoff']
    if (!validTypes.includes(body.scenarioType)) {
      return NextResponse.json({ error: `scenarioType must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const ctx = await buildFinancialContext(supabase, user.id)
    const result = simulateScenario(ctx, {
      type: body.scenarioType,
      amount: body.amount ?? 0,
      targetDebtLender: body.targetDebtLender,
      projectionMonths: body.projectionMonths,
    })

    return NextResponse.json({ result })
  } catch (err) {
    console.error('[Scenario Simulator]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
