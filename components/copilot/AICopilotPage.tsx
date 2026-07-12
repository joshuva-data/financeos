'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, SendHorizonal, Loader2, RotateCcw, Wrench, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ExecutiveBriefPanel } from './ExecutiveBriefPanel'
import { ActionCenterPanel } from './ActionCenterPanel'
import type { Recommendation, ProposedAction } from '@/lib/ai/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  recommendations?: Recommendation[]
  proposedActions?: ProposedAction[]
}

const SUGGESTIONS = [
  'What is my net worth?',
  'How does this month compare to last month?',
  'Forecast my cash flow for the next 3 months',
  'What subscriptions am I paying for?',
  'How much tax do I owe this year?',
  'What should I focus on right now?',
]

export function AICopilotPage() {
  const [messages, setMessages]           = useState<Message[]>([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab]         = useState('chat')
  const bottomRef                         = useRef<HTMLDivElement>(null)

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
        body: JSON.stringify({
          query: query.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
        }),
      })
      const data = await res.json()
      if (data.conversationId) setConversationId(data.conversationId)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer ?? 'Sorry, I could not get a response.',
        toolsUsed: data.toolsUsed,
        recommendations: data.recommendations,
        proposedActions: data.proposedActions,
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

  const newChat = () => {
    setMessages([])
    setConversationId(undefined)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">AI Financial Copilot</h1>
            <p className="text-xs text-muted-foreground">Reasoning across all your FinanceOS modules</p>
          </div>
        </div>
        {activeTab === 'chat' && messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={newChat}>
            <RotateCcw className="h-3 w-3 mr-1.5" /> New chat
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mt-4 self-start">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="brief">Executive Brief</TabsTrigger>
          <TabsTrigger value="actions">Action Center</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-5 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-6 pt-4">
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold">Ask me anything about your finances</p>
                  <p className="text-xs text-muted-foreground">
                    Net worth, trends, forecasts, taxes, subscriptions, documents — I reason across every module.
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
                <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border/50 text-foreground rounded-bl-sm shadow-sm'
                  )}>
                    {msg.content}

                    {msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/40 flex-wrap">
                        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                        {msg.toolsUsed.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {t.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.proposedActions && msg.proposedActions.length > 0 && (
                      <button
                        onClick={() => setActiveTab('actions')}
                        className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/40 text-xs text-primary hover:underline"
                      >
                        <Sparkles className="h-3 w-3" />
                        {msg.proposedActions.length} action{msg.proposedActions.length > 1 ? 's' : ''} ready for your confirmation →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="bg-card border border-border/50 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Reasoning across your data…</span>
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Powered by Groq · Add GROQ_API_KEY in .env.local if the Copilot stops responding
            </p>
          </div>
        </TabsContent>

        <TabsContent value="brief" className="flex-1 overflow-y-auto">
          <ExecutiveBriefPanel />
        </TabsContent>

        <TabsContent value="actions" className="flex-1 overflow-y-auto">
          <ActionCenterPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
