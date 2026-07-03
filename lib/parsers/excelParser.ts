import * as XLSX from 'xlsx'
import type { TransactionInsert } from '@/types/database'

export interface ExcelParseResult {
  transactions: TransactionInsert[]
  errors: { row: number; message: string; raw: string }[]
}

// Maps known sheet names from user's existing spreadsheets
const SHEET_MAP: Record<string, string> = {
  'Finance Tracker 2026': 'transactions',
  'Aditya Birla Health Insurance': 'insurance',
  'Niva Bupa Health Insurance': 'insurance',
  'Bajaj Life Insurance': 'insurance',
  'ICICI Lombard Vehicle Insurance': 'insurance',
  'Amount I Have To Pay': 'payables',
  'Amount Pending For Me': 'receivables',
  'Rental Pending By Tenant': 'rental_payments',
}

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  userId: string
): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const result: ExcelParseResult = { transactions: [], errors: [] }

  for (const sheetName of wb.SheetNames) {
    const mappedType = SHEET_MAP[sheetName]
    if (!mappedType) continue

    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })

    rows.forEach((row, i) => {
      try {
        if (mappedType === 'transactions') {
          result.transactions.push(mapRowToTransaction(row, userId))
        }
        // Additional mappers: mapRowToInsurance, mapRowToReceivable, etc.
      } catch (e) {
        result.errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : 'Parse error',
          raw: JSON.stringify(row),
        })
      }
    })
  }

  return result
}

function mapRowToTransaction(
  row: Record<string, unknown>,
  userId: string
): TransactionInsert {
  const date = row['Date'] ?? row['date'] ?? row['Transaction Date']
  const amount = Number(row['Amount'] ?? row['amount'] ?? 0)
  const desc = String(row['Description'] ?? row['Narration'] ?? row['Particulars'] ?? '')
  const type = String(row['Type'] ?? row['Credit/Debit'] ?? 'debit').toLowerCase()

  if (!date) throw new Error('Missing date')
  if (isNaN(amount) || amount <= 0) throw new Error(`Invalid amount: ${amount}`)

  return {
    account_id: '',   // resolved after account matching
    txn_type: 'expense',
    amount: Math.abs(amount),
    direction: type.includes('credit') ? 'credit' : 'debit',
    category: 'Uncategorized',
    description: desc,
    txn_date: formatDate(date),
    status: 'cleared',
    is_recurring: false,
    is_tax_relevant: false,
    tags: [],
  }
}

function formatDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().split('T')[0]
  if (typeof raw === 'string') {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  throw new Error(`Cannot parse date: ${raw}`)
}