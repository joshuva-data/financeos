import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Production readiness fix: no not-found.tsx existed anywhere in the app —
// a bad URL fell through to Next.js's default page, same issue as the
// missing error.tsx files.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <Compass className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
