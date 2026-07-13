'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// Scoped to app/(app)/* — renders inside the existing Sidebar/TopBar shell
// (from app/(app)/layout.tsx) rather than replacing the whole page like
// the root app/error.tsx does, so navigation stays available even when a
// specific module's page throws.
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[FinanceOS] Module error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-24 px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">This page hit a problem</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {error.message && error.message.length < 140
              ? error.message
              : 'Something went wrong loading this section. Your data is safe — try again or head elsewhere.'}
          </p>
        </div>
        <div className="flex gap-2 justify-center pt-1">
          <Button size="sm" onClick={() => reset()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
