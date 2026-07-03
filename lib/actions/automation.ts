'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DocType =
  | 'form16' | 'form26as' | 'ais' | 'salary_slip'
  | 'insurance_receipt' | 'home_loan_cert' | 'rent_receipt'
  | 'bank_statement' | 'investment_statement' | 'donation_receipt'
  | 'loan_statement' | 'other'

export interface ExtractedFields {
  gross_salary?: number; basic_salary?: number; hra?: number
  tds_deducted?: number; net_salary?: number; bonus?: number
  pf_deduction?: number; month?: number; financial_year?: string
  employer_name?: string

  policy_name?: string; insurer_name?: string; policy_number?: string
  insurance_type?: string; annual_premium?: number; sum_assured?: number
  renewal_date?: string; nominee_name?: string

  lender_name?: string; loan_account_no?: string; original_amount?: number
  outstanding?: number; interest_rate?: number; emi_amount?: number
  tenure_months?: number; next_emi_date?: string; interest_paid?: number
  principal_paid?: number; debt_type?: string

  investment_name?: string; investment_type?: string; invested_amount?: number
  current_value?: number; units?: number; nav?: number
  folio_number?: string; capital_gains?: number

  rent_amount?: number; property_address?: string; landlord_name?: string
  rent_period?: string; hra_exemption?: number

  closing_balance?: number; bank_name?: string; account_number?: string

  organisation_name?: string; donation_amount?: number; is_80g?: boolean

  document_title?: string; file_url?: string; file_name?: string
}

export interface RoutingResult {
  module: string
  success: boolean
  message: string
  recordId?: string
}

export interface AutomationConfirmInput {
  docType: DocType
  fields: ExtractedFields
  selectedModules: string[]
  fileName: string
  fileUrl?: string
  jobId?: string
}

function getCurrentFY(): string {
  const now = new Date()
  return now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`
}

export async function confirmAndRoute(
  input: AutomationConfirmInput
): Promise<{ ok: boolean; results: RoutingResult[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (!user) return { ok: false, results: [], error: 'Unauthorized — please log in again' }

  const results: RoutingResult[] = []
  const { docType, fields, selectedModules, fileName, fileUrl, jobId } = input
  const fy = fields.financial_year ?? getCurrentFY()
  const month = fields.month ?? (new Date().getMonth() + 1)

  // ── INCOME ───────────────────────────────────────────────
  if (selectedModules.includes('Income')) {
    const gross = fields.gross_salary ?? fields.net_salary ?? fields.bonus ?? 0
    if (gross <= 0) {
      results.push({ module: 'Income', success: false, message: 'Skipped — no Gross Salary / Net Salary / Bonus entered in the form' })
    } else {
      const tds = fields.tds_deducted ?? 0
      const net = fields.net_salary ?? (gross - tds)
      const { data, error } = await supabase.from('income_entries').insert({
        user_id: user.id,
        source_name: fields.employer_name || fileName,
        income_type: ['form16', 'salary_slip'].includes(docType) ? 'salary' : 'other',
        gross_amount: gross,
        tds_deducted: tds,
        net_amount: net,
        month,
        financial_year: fy,
        is_taxable: true,
      }).select('id').single()
      if (error) results.push({ module: 'Income', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Income', success: true, message: `Added ₹${gross.toLocaleString('en-IN')} income entry`, recordId: data.id }); revalidatePath('/income') }
    }
  }

  // ── TAXES (computed from income/insurance/debt — just revalidate) ──
  if (selectedModules.includes('Taxes')) {
    const hasTaxData = fields.tds_deducted || fields.annual_premium || fields.interest_paid || fields.capital_gains || fields.donation_amount
    if (!hasTaxData) {
      results.push({ module: 'Taxes', success: false, message: 'Skipped — no TDS, premium, interest, or donation amount entered' })
    } else {
      revalidatePath('/taxes')
      results.push({ module: 'Taxes', success: true, message: 'Tax-relevant figures will reflect in Tax Centre' })
    }
  }

  // ── ACCOUNTS ─────────────────────────────────────────────
  if (selectedModules.includes('Accounts')) {
    const balance = fields.closing_balance ?? fields.net_salary
    if (!balance || balance <= 0) {
      results.push({ module: 'Accounts', success: false, message: 'Skipped — no Closing Balance / Net Salary entered' })
    } else {
      const { data: existing } = await supabase.from('accounts')
        .select('id').eq('user_id', user.id)
        .eq('bank_name', fields.bank_name || fields.employer_name || '')
        .maybeSingle()

      if (existing) {
        const { error } = await supabase.from('accounts').update({ balance }).eq('id', existing.id)
        if (error) results.push({ module: 'Accounts', success: false, message: `DB error: ${error.message}` })
        else { results.push({ module: 'Accounts', success: true, message: `Updated balance to ₹${balance.toLocaleString('en-IN')}`, recordId: existing.id }); revalidatePath('/accounts') }
      } else {
        const { data, error } = await supabase.from('accounts').insert({
          user_id: user.id,
          name: fields.bank_name ? `${fields.bank_name} Account` : (fields.employer_name ? `${fields.employer_name} Salary Account` : 'New Account'),
          account_type: 'savings',
          bank_name: fields.bank_name || null,
          account_number: fields.account_number || null,
          balance,
          status: 'active',
          is_primary: false,
        }).select('id').single()
        if (error) results.push({ module: 'Accounts', success: false, message: `DB error: ${error.message}` })
        else { results.push({ module: 'Accounts', success: true, message: `Account created with ₹${balance.toLocaleString('en-IN')}`, recordId: data.id }); revalidatePath('/accounts') }
      }
    }
  }

  // ── INSURANCE ────────────────────────────────────────────
  if (selectedModules.includes('Insurance')) {
    if (!fields.policy_name) {
      results.push({ module: 'Insurance', success: false, message: 'Skipped — no Policy Name entered in the form' })
    } else {
      const { data, error } = await supabase.from('insurance_policies').insert({
        user_id: user.id,
        policy_name: fields.policy_name,
        insurance_type: fields.insurance_type || 'other',
        insurer_name: fields.insurer_name || 'Unknown',
        policy_number: fields.policy_number || null,
        annual_premium: fields.annual_premium || null,
        sum_assured: fields.sum_assured || null,
        renewal_date: fields.renewal_date || null,
        nominee_name: fields.nominee_name || null,
        status: 'active',
      }).select('id').single()
      if (error) results.push({ module: 'Insurance', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Insurance', success: true, message: `Policy "${fields.policy_name}" added`, recordId: data.id }); revalidatePath('/insurance') }
    }
  }

  // ── CALENDAR (renewal/EMI dates — revalidate only) ──────
  if (selectedModules.includes('Calendar')) {
    const hasDate = fields.renewal_date || fields.next_emi_date
    if (!hasDate) {
      results.push({ module: 'Calendar', success: false, message: 'Skipped — no Renewal Date or Next EMI Date entered' })
    } else {
      revalidatePath('/calendar')
      results.push({ module: 'Calendar', success: true, message: `Date ${fields.renewal_date || fields.next_emi_date} will appear in Calendar` })
    }
  }

  // ── DEBT ─────────────────────────────────────────────────
  if (selectedModules.includes('Debt')) {
    if (!fields.lender_name) {
      results.push({ module: 'Debt', success: false, message: 'Skipped — no Lender Name entered in the form' })
    } else {
      const { data, error } = await supabase.from('debt_accounts').insert({
        user_id: user.id,
        debt_type: fields.debt_type || 'other',
        lender_name: fields.lender_name,
        loan_account_no: fields.loan_account_no || null,
        original_amount: fields.original_amount || fields.outstanding || 0,
        outstanding: fields.outstanding || 0,
        interest_rate: fields.interest_rate || 0,
        rate_type: 'fixed',
        emi_amount: fields.emi_amount || null,
        tenure_months: fields.tenure_months || null,
        next_emi_date: fields.next_emi_date || null,
        is_active: true,
        prepayment_penalty: false,
      }).select('id').single()
      if (error) results.push({ module: 'Debt', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Debt', success: true, message: `Loan from "${fields.lender_name}" added`, recordId: data.id }); revalidatePath('/debt') }
    }
  }

  // ── RENTAL ───────────────────────────────────────────────
  if (selectedModules.includes('Rental')) {
    if (!fields.rent_amount) {
      results.push({ module: 'Rental', success: false, message: 'Skipped — no Rent Amount entered in the form' })
    } else {
      const { data, error } = await supabase.from('receivables').insert({
        user_id: user.id,
        from_name: fields.landlord_name || 'Landlord',
        from_type: 'individual',
        amount: fields.rent_amount,
        amount_received: fields.rent_amount,
        due_date: new Date().toISOString().split('T')[0],
        reason: `Rent — ${fields.rent_period || fileName}`,
        status: 'received',
        is_rental: true,
        reminder_sent: false,
      }).select('id').single()
      if (error) results.push({ module: 'Rental', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Rental', success: true, message: `Rent of ₹${fields.rent_amount.toLocaleString('en-IN')} recorded`, recordId: data.id }); revalidatePath('/rental') }
    }
  }

  // ── INVESTMENTS ──────────────────────────────────────────
  if (selectedModules.includes('Investments')) {
    if (!fields.investment_name) {
      results.push({ module: 'Investments', success: false, message: 'Skipped — no Investment Name entered in the form' })
    } else {
      const { data, error } = await supabase.from('investments').insert({
        user_id: user.id,
        name: fields.investment_name,
        investment_type: fields.investment_type || 'other',
        invested_amount: fields.invested_amount || 0,
        current_value: fields.current_value || fields.invested_amount || null,
        units: fields.units || null,
        nav: fields.nav || null,
        folio_number: fields.folio_number || null,
        status: 'active',
      }).select('id').single()
      if (error) results.push({ module: 'Investments', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Investments', success: true, message: `"${fields.investment_name}" added`, recordId: data.id }); revalidatePath('/investments') }
    }
  }

  // ── NET WORTH (computed page — revalidate only) ─────────
  if (selectedModules.includes('Net Worth')) {
    const hasNW = fields.current_value || fields.invested_amount || fields.closing_balance
    if (!hasNW) {
      results.push({ module: 'Net Worth', success: false, message: 'Skipped — no relevant value to recalculate net worth' })
    } else {
      revalidatePath('/net-worth')
      results.push({ module: 'Net Worth', success: true, message: 'Net Worth page will reflect updated values' })
    }
  }

  // ── GOALS (revalidate only, manual linking) ─────────────
  if (selectedModules.includes('Goals')) {
    revalidatePath('/goals')
    results.push({ module: 'Goals', success: true, message: 'Open Goals to manually allocate this investment if relevant' })
  }

  // ── TITHE / DONATION ─────────────────────────────────────
  if (selectedModules.includes('Tithe')) {
    if (fields.donation_amount && fields.organisation_name) {
      const { data, error } = await supabase.from('tithe_entries').insert({
        user_id: user.id,
        recipient_name: fields.organisation_name,
        category: 'donation',
        amount: fields.donation_amount,
        giving_date: new Date().toISOString().split('T')[0],
        tithe_pct: 0,
        tax_deductible: fields.is_80g ?? true,
        is_recurring: false,
        financial_year: fy,
      }).select('id').single()
      if (error) results.push({ module: 'Tithe', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Tithe', success: true, message: `Donation of ₹${fields.donation_amount.toLocaleString('en-IN')} to ${fields.organisation_name} added`, recordId: data.id }); revalidatePath('/tithe') }
    } else if (fields.net_salary) {
      const titheAmount = Math.round(fields.net_salary * 0.1)
      const { data, error } = await supabase.from('tithe_entries').insert({
        user_id: user.id,
        recipient_name: 'Suggested Tithe — ' + (fields.employer_name || fileName),
        category: 'tithe',
        amount: titheAmount,
        giving_date: new Date().toISOString().split('T')[0],
        tithe_pct: 10,
        tax_deductible: false,
        is_recurring: true,
        financial_year: fy,
      }).select('id').single()
      if (error) results.push({ module: 'Tithe', success: false, message: `DB error: ${error.message}` })
      else { results.push({ module: 'Tithe', success: true, message: `Suggested tithe of ₹${titheAmount.toLocaleString('en-IN')} added`, recordId: data.id }); revalidatePath('/tithe') }
    } else {
      results.push({ module: 'Tithe', success: false, message: 'Skipped — no Net Salary or Donation Amount entered' })
    }
  }

  // ── DOCUMENTS (always succeeds if selected) ─────────────
  if (selectedModules.includes('Documents')) {
    const { data, error } = await supabase.from('documents').insert({
      user_id: user.id,
      title: fields.document_title || fileName,
      doc_type: docTypeToDocCategory(docType),
      file_url: fileUrl || null,
      file_name: fileName,
      tags: [docType],
      uploaded_at: new Date().toISOString(),
      is_sensitive: false,
    }).select('id').single()
    if (error) results.push({ module: 'Documents', success: false, message: `DB error: ${error.message}` })
    else { results.push({ module: 'Documents', success: true, message: 'Document saved to your vault', recordId: data.id }); revalidatePath('/documents') }
  }

  // ── Update job status ────────────────────────────────────
  if (jobId) {
    const successCount = results.filter(r => r.success).length
    await supabase.from('import_jobs').update({
      status: successCount > 0 ? 'completed' : 'failed',
      records_imported: successCount,
    }).eq('id', jobId)
  }

  revalidatePath('/dashboard')
  revalidatePath('/automation')

  return { ok: results.some(r => r.success), results }
}

function docTypeToDocCategory(docType: DocType): string {
  const map: Record<DocType, string> = {
    form16: 'tax_document', form26as: 'tax_document', ais: 'tax_document',
    salary_slip: 'salary_slip', insurance_receipt: 'insurance_policy',
    home_loan_cert: 'loan_document', rent_receipt: 'rental_agreement',
    bank_statement: 'bank_statement', investment_statement: 'investment_statement',
    donation_receipt: 'receipt', loan_statement: 'loan_document', other: 'other',
  }
  return map[docType] ?? 'other'
}
