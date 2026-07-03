'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
  hint?: string
  className?: string
}

export function FormField({
  label, error, required, children, hint, className
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        style={{ color: '#8aa0b5', fontSize: '0.75rem', fontWeight: 500, display: 'block' }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint  && <p style={{ color: '#4a6178', fontSize: '0.6875rem' }}>{hint}</p>}
      {error && <p style={{ color: '#f87171', fontSize: '0.6875rem' }}>{error}</p>}
    </div>
  )
}
