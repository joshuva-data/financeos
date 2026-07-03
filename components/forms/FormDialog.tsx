'use client'

import { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FormDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function FormDialog({
  open, onClose, title, description, children, size = 'md'
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto rounded-2xl',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
        )}
        style={{
          backgroundColor: '#0b1320',
          border: '1px solid #1e2d40',
          color: '#c9d5e0',
          boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
        }}
      >
        <DialogHeader style={{ backgroundColor: '#0b1320' }}>
          <DialogTitle style={{ color: '#e8f0f8', fontWeight: 600 }}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription style={{ color: '#6b8097', fontSize: '0.8125rem' }}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div style={{ backgroundColor: '#0b1320', color: '#c9d5e0' }}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
