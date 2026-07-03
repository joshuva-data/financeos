export abstract class IntegrationProvider {
    abstract readonly id: string
    abstract readonly name: string
    abstract readonly icon: string
  
    abstract connect(credentials: Record<string, string>): Promise<boolean>
    abstract sync(): Promise<{ imported: number; failed: number; errors: string[] }>
    abstract disconnect(): Promise<void>
    abstract refresh(): Promise<boolean>
    abstract validate(): Promise<boolean>
  
    protected handleError(e: unknown, context: string): never {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      throw new Error(`[${this.name}] ${context}: ${msg}`)
    }
  }