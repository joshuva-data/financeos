'use client'

import { useState, useRef } from 'react'
import { Search, Upload, FileText, Shield, Receipt, Briefcase,
  Home, Car, FolderOpen, Download, Eye, AlertCircle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fmtDate } from '@/lib/utils/dates'

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  insurance_policy:     { label: 'Insurance',   icon: Shield,    color: 'text-blue-500'   },
  tax_document:         { label: 'Tax',          icon: Receipt,   color: 'text-amber-500'  },
  salary_slip:          { label: 'Salary',       icon: Briefcase, color: 'text-green-500'  },
  bank_statement:       { label: 'Bank',         icon: Briefcase, color: 'text-blue-600'   },
  investment_statement: { label: 'Investment',   icon: Briefcase, color: 'text-purple-500' },
  property_document:    { label: 'Property',     icon: Home,      color: 'text-orange-500' },
  vehicle_document:     { label: 'Vehicle',      icon: Car,       color: 'text-indigo-500' },
  identity_document:    { label: 'Identity',     icon: FileText,  color: 'text-pink-500'   },
  loan_document:        { label: 'Loan',         icon: FileText,  color: 'text-red-500'    },
  rental_agreement:     { label: 'Rental',       icon: Home,      color: 'text-teal-500'   },
  receipt:              { label: 'Receipt',      icon: Receipt,   color: 'text-gray-500'   },
  other:                { label: 'Other',        icon: FolderOpen,color: 'text-gray-500'   },
}

const DOC_TYPES = Object.entries(DOC_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

interface Document {
  id: string
  title: string
  doc_type: string
  file_url: string | null
  file_name: string | null
  expiry_date: string | null
  is_sensitive: boolean
  tags: string[]
  uploaded_at: string
}

interface Props { documents: Document[]; userId: string }

export function DocumentsModule({ documents: initialDocs, userId }: Props) {
  const [documents, setDocuments] = useState(initialDocs)
  const [search, setSearch]       = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', doc_type: 'other', expiry_date: '', is_sensitive: false,
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const expiringSoon = documents.filter(d =>
    d.expiry_date && new Date(d.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  )

  const filtered = documents.filter(d =>
    !search ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (!uploadForm.title) {
      setUploadForm(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }))
    }
    setShowUpload(true)
  }

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title.trim()) {
      toast.error('Please select a file and enter a title')
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext      = selectedFile.name.split('.').pop()
      const path     = `${userId}/${Date.now()}.${ext}`

      // Upload to Supabase storage
      const { error: storageErr } = await supabase.storage
        .from('documents')
        .upload(path, selectedFile)

      let file_url = null
      if (!storageErr) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        file_url = urlData.publicUrl
      }

      // Save record to DB even if storage fails
      const { data, error: dbErr } = await supabase.from('documents').insert({
        user_id:      userId,
        title:        uploadForm.title.trim(),
        doc_type:     uploadForm.doc_type,
        file_url,
        file_name:    selectedFile.name,
        file_size:    selectedFile.size,
        expiry_date:  uploadForm.expiry_date || null,
        is_sensitive: uploadForm.is_sensitive,
        tags:         [],
      }).select().single()

      if (dbErr) { toast.error(dbErr.message); return }

      toast.success('Document uploaded!')
      setDocuments(prev => [data, ...prev])
      setShowUpload(false)
      setSelectedFile(null)
      setUploadForm({ title: '', doc_type: 'other', expiry_date: '', is_sensitive: false })
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast.error('Upload failed. Check Supabase storage settings.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {documents.length} files · {expiringSoon.length > 0 ? `${expiringSoon.length} expiring soon` : 'All up to date'}
          </p>
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={handleFileChange} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Upload form */}
      {showUpload && selectedFile && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800">Complete upload details</p>
            <button onClick={() => { setShowUpload(false); setSelectedFile(null) }}>
              <X className="h-4 w-4 text-blue-600" />
            </button>
          </div>
          <div className="text-xs text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
            📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-blue-800">Document Title *</label>
              <Input value={uploadForm.title}
                onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Aditya Birla Health Policy 2024" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-800">Document Type</label>
              <select
                value={uploadForm.doc_type}
                onChange={e => setUploadForm(prev => ({ ...prev, doc_type: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-white">
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-800">Expiry Date (optional)</label>
              <Input type="date" value={uploadForm.expiry_date}
                onChange={e => setUploadForm(prev => ({ ...prev, expiry_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowUpload(false); setSelectedFile(null) }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Save Document'}
            </Button>
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium text-yellow-800">{expiringSoon.length} document{expiringSoon.length > 1 ? 's' : ''}</span>
            <span className="text-yellow-700"> expiring within 30 days</span>
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search documents…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-border/50">
            <div className="text-3xl">📁</div>
            <p className="text-sm text-muted-foreground">
              {search ? 'No documents match your search' : 'No documents yet'}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload First Document
              </Button>
            )}
          </div>
        ) : filtered.map(doc => {
          const cfg = DOC_TYPE_CONFIG[doc.doc_type] ?? DOC_TYPE_CONFIG.other
          const isExpiring = expiringSoon.includes(doc)
          return (
            <div key={doc.id} className={cn(
              'flex items-center justify-between rounded-xl border bg-card px-4 py-3.5 gap-3',
              isExpiring ? 'border-yellow-200' : 'border-border/50'
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <cfg.icon className={cn('h-5 w-5 flex-shrink-0', cfg.color)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(doc.uploaded_at)}
                    </span>
                    {isExpiring && (
                      <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                        Expires {fmtDate(doc.expiry_date!)}
                      </Badge>
                    )}
                    {doc.is_sensitive && (
                      <Badge variant="outline" className="text-xs">🔒 Sensitive</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {doc.file_url && (
                  <>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <a href={doc.file_url} download={doc.file_name ?? doc.title}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}