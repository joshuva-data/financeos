import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query, history = [] } = await req.json()
    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 })

    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({
        answer: '⚠️ Groq API key not set. Get a free key at console.groq.com → API Keys, then add GROQ_API_KEY to your .env.local file.'
      })
    }

    const messages = [
      {
        role: 'system',
        content: `You are FinanceOS AI Copilot — a personal finance assistant for Indian users.
Help with budgeting, investing, tax planning (Indian tax laws), insurance, debt management, EPF, PPF, NPS, mutual funds, SIP, and savings goals.
Use ₹ symbol and Indian number formatting (lakhs, crores). Example: ₹2,45,000 or 2.45 lakhs.
Be concise, practical, and give actionable advice tailored for India.
Current date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      },
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: query },
    ]

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('[Groq]', err)
      return NextResponse.json({
        answer: `⚠️ AI error: ${err?.error?.message ?? 'Unknown error'}. Please check your GROQ_API_KEY in .env.local`
      })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? 'Sorry, no response received.'
    return NextResponse.json({ answer: text })

  } catch (err: any) {
    console.error('[Copilot]', err)
    return NextResponse.json({ answer: 'Sorry, something went wrong. Please try again.' })
  }
}