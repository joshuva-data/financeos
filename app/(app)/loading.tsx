export default function Loading() {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-3 text-center">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }