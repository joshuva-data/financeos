import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface EmptyStateProps {
  icon?: string
  message: string
  onAdd?: () => void
  addLabel?: string
}

export function EmptyState({ icon = '📋', message, onAdd, addLabel = 'Add' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onAdd && (
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
        </Button>
      )}
    </div>
  )
}