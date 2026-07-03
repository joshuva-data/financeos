import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseExcelBuffer } from '@/lib/parsers/excelParser'

type Client = SupabaseClient<Database>

export interface ImportJobPayload {
  jobId: string
  userId: string
  filePath: string
  sourceType: 'excel' | 'csv' | 'pdf'
  mappingConfig?: Record<string, string>
}

export async function processImportJob(payload: ImportJobPayload, supabase: Client): Promise<void> {
  // Mark job as processing
  await supabase.from('import_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', payload.jobId)

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('statement-uploads')
      .download(payload.filePath)

    if (downloadErr || !fileData) throw new Error(`File download failed: ${downloadErr?.message}`)

    const buffer = await fileData.arrayBuffer()

    let result: Awaited<ReturnType<typeof parseExcelBuffer>>
    if (payload.sourceType === 'excel') {
      result = parseExcelBuffer(buffer, payload.userId)
    } else {
      throw new Error(`Parser for ${payload.sourceType} not yet implemented`)
    }

    // Insert parsed transactions in batches of 100
    const BATCH_SIZE = 100
    let importedCount = 0
    const errors = [...result.errors]

    for (let i = 0; i < result.transactions.length; i += BATCH_SIZE) {
      const batch = result.transactions.slice(i, i + BATCH_SIZE).map(t => ({ ...t, user_id: payload.userId }))
      const { error: insertErr } = await supabase.from('transactions').insert(batch)
      if (insertErr) {
        errors.push({ row: i, message: insertErr.message, raw: 'batch insert failed' })
      } else {
        importedCount += batch.length
      }
    }

    await supabase.from('import_jobs').update({
      status: errors.length > 0 && importedCount === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'completed',
      total_records: result.transactions.length,
      imported_records: importedCount,
      failed_records: errors.length,
      error_details: errors.slice(0, 50),
      completed_at: new Date().toISOString(),
    }).eq('id', payload.jobId)

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: payload.userId,
      table_name: 'import_jobs',
      record_id: payload.jobId as any,
      action: 'UPDATE',
      new_data: { imported: importedCount, failed: errors.length, source: payload.sourceType },
    })
  } catch (err) {
    await supabase.from('import_jobs').update({
      status: 'failed',
      error_details: [{ row: 0, message: err instanceof Error ? err.message : 'Unknown error', raw: '' }],
      completed_at: new Date().toISOString(),
    }).eq('id', payload.jobId)
  }
}