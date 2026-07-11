import type { FinanceEvent, FinanceEventType } from './types'

type EventHandler = (event: FinanceEvent) => void | Promise<void>

class EventBus {
  private handlers: Map<FinanceEventType, EventHandler[]> = new Map()
  private history:  FinanceEvent[]                        = []

  /** Subscribe to a specific event type */
  on(type: FinanceEventType, handler: EventHandler): () => void {
    const existing = this.handlers.get(type) ?? []
    this.handlers.set(type, [...existing, handler])

    // Return unsubscribe function
    return () => {
      const updated = (this.handlers.get(type) ?? []).filter(h => h !== handler)
      this.handlers.set(type, updated)
    }
  }

  /** Emit an event — runs all registered handlers */
  async emit(event: FinanceEvent): Promise<void> {
    this.history = [event, ...this.history].slice(0, 100) // keep last 100
    const handlers = this.handlers.get(event.type) ?? []
    await Promise.allSettled(handlers.map(h => h(event)))

    // Also dispatch as DOM CustomEvent for cross-component communication
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financeos:event', { detail: event }))
    }
  }

  getHistory(): FinanceEvent[] { return this.history }
  clearHistory(): void         { this.history = [] }
}

// Singleton — one bus for the entire app session
export const eventBus = new EventBus()

/** Helper: emit a typed finance event */
export function emitFinanceEvent(
  type: FinanceEventType,
  source: string,
  payload: Record<string, any>,
  userId: string
): void {
  const event: FinanceEvent = {
    id:        `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    source,
    payload,
    timestamp: new Date().toISOString(),
    userId,
  }
  eventBus.emit(event)
}
