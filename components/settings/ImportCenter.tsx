'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Image, ArrowRight } from 'lucide-react'
import { ExcelMigrationWizard } from './ExcelMigrationWizard'
import { Button } from '@/components/ui/button'

export function ImportCenter({ userId }: { userId: string }) {
  const [mode, setMode] = useState<'menu' | 'excel' | 'csv' | 'pdf'>('menu')

  if (mode === 'excel') return <ExcelMigrationWizard userId={userId} onBack={() => setMode('menu')} />

  return (
    <div className="space-y-4">
      <SectionCard title="Import Data" description="Bring in your existing financial data">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'excel', icon: FileSpreadsheet, label: 'Excel Import', desc: 'Finance Tracker 2026, insurance sheets, rental data', primary: true },
            { id: 'csv', icon: FileText, label: 'CSV Import', desc: 'Bank statements and transaction exports' },
            { id: 'pdf', icon: Image, label: 'PDF Parser', desc: 'Insurance PDFs and bank statements' },
          ].map(item => (
            <button key={item.id} onClick={() => setMode(item.id as any)}
              className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left hover:border-primary/40 hover:bg-muted/20 transition-all ${item.primary ? 'border-primary/30 bg-primary/3' : 'border-border/50'}`}>
              <item.icon className={`h-6 w-6 ${item.primary ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}