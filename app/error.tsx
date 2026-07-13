'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Production readiness fix: no error.tsx existed anywhere in the app, at
// any route level, before this. Any thrown error (a failed Supabase query,
// a bad RPC call) fell through to Next.js's default, unstyled error page —
// jarringly off-brand from the premium dark theme everywhere else. This is
// the top-level catch-all; app/(app)/error.tsx below provides a more
// specific one for the authenticated app shell.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[FinanceOS] Unhandled error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                An unexpected error occurred. This has been logged — you can try again, or head back to the dashboard.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-1">
              <Button size="sm" onClick={() => reset()}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Try again
              </Button>
              <Button size="sm" variant="outline" onClick={() => { window.location.href = '/dashboard' }}>
                Go to dashboard
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
