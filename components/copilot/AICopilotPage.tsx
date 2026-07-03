'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, SendHorizonal, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What is my net worth?',
  'How much tithe should I pay this month?',
  'Explain SIP vs lump sum investing',
  'How to reduce my tax liability in India?',
  'What is the 50/30/20 budgeting rule?',
  'How much emergency fund should I have?',
]

export function AICopilotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (query: string) => {
    if (!query.trim() || loading) return

    const userMsg: Message = { role: 'user', content: query.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), history: messages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer ?? 'Sorry, I could not get a response.',
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">AI Financial Copilot</h1>
            <p className="text-xs text-muted-foreground">Powered by Claude · Ask anything about your finances</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
            <RotateCcw className="h-3 w-3 mr-1.5" /> New chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6 pt-4">
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold">Ask me anything about your finances</p>
              <p className="text-xs text-muted-foreground">
                Tax, investing, budgeting, insurance — I can help with all of it.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm rounded-xl border border-border/50 bg-card px-4 py-3 hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}>
              <div className={cn(
                'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
              )}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex gap-3 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask about your finances… (Press Enter to send)"
            className="min-h-[44px] max-h-36 text-sm resize-none flex-1 py-2.5"
            rows={1}
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-11 w-11 flex-shrink-0"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <SendHorizonal className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Add Anthropic credits at console.anthropic.com if AI stops responding
        </p>
      </div>
    </div>
  )
}