import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'AI Copilot' }
import { AICopilotPage } from '@/components/copilot/AICopilotPage'
export default function CopilotPage() { return <AICopilotPage /> }