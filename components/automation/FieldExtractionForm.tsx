'use client'

import { useState } from 'react'
import type { DocType, ExtractedFields } from '@/lib/actions/automation'
import { cn } from '@/lib/utils'

interface Props {
  docType:  DocType
  fileName: string
  onConfirm: (fields: ExtractedFields) => void
  onCancel:  () => void
  loading:   boolean
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label style={{ color: '#8b97a7', fontSize: '0.6875rem', fontWeight: 500 }}>{label}</label>
      {children}
      {hint && <p style={{ color: '#3d4d5c', fontSize: '0.625rem' }}>{hint}</p>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? '0'}
      style={{ width: '100%', backgroundColor: '#0b0d0f', border: '1px solid #1e252d', color: '#f5f7fa', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem' }}
      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)' }}
      onBlur={e => { e.target.style.borderColor = '#1e252d'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function TxtInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? ''}
      style={{ width: '100%', backgroundColor: '#0b0d0f', border: '1px solid #1e252d', color: '#f5f7fa', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem' }}
      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)' }}
      onBlur={e => { e.target.style.borderColor = '#1e252d'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', backgroundColor: '#0b0d0f', border: '1px solid #1e252d', color: '#f5f7fa', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem' }}
      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)' }}
      onBlur={e => { e.target.style.borderColor = '#1e252d'; e.target.style.boxShadow = 'none' }}
    />
  )
}

const MONTHS = [
  { value: '4', label: 'April' },   { value: '5', label: 'May' },
  { value: '6', label: 'June' },    { value: '7', label: 'July' },
  { value: '8', label: 'August' },  { value: '9', label: 'September' },
  { value: '10', label: 'October' },{ value: '11', label: 'November' },
  { value: '12', label: 'December'},{ value: '1', label: 'January' },
  { value: '2', label: 'February' },{ value: '3', label: 'March' },
]

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', backgroundColor: '#0b0d0f', border: '1px solid #1e252d', color: value ? '#f5f7fa' : '#3d4d5c', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem' }}>
      <option value="">Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

const now = new Date()
const defaultFY = now.getMonth() >= 3
  ? `${now.getFullYear()}-${now.getFullYear() + 1}`
  : `${now.getFullYear() - 1}-${now.getFullYear()}`

export function FieldExtractionForm({ docType, fileName, onConfirm, onCancel, loading }: Props) {
  // ── Form 16 / Salary Slip fields ─────────────────────────
  const [grossSalary,    setGrossSalary]    = useState('')
  const [basicSalary,    setBasicSalary]    = useState('')
  const [hra,            setHra]            = useState('')
  const [tds,            setTds]            = useState('')
  const [netSalary,      setNetSalary]      = useState('')
  const [bonus,          setBonus]          = useState('')
  const [pfDeduction,    setPfDeduction]    = useState('')
  const [employerName,   setEmployerName]   = useState('')
  const [month,          setMonth]          = useState(String(now.getMonth() + 1))
  const [fy,             setFy]             = useState(defaultFY)

  // ── Insurance fields ──────────────────────────────────────
  const [policyName,     setPolicyName]     = useState('')
  const [insurerName,    setInsurerName]    = useState('')
  const [policyNumber,   setPolicyNumber]   = useState('')
  const [insuranceType,  setInsuranceType]  = useState('')
  const [annualPremium,  setAnnualPremium]  = useState('')
  const [sumAssured,     setSumAssured]     = useState('')
  const [renewalDate,    setRenewalDate]    = useState('')
  const [nomineeName,    setNomineeName]    = useState('')

  // ── Debt / Loan fields ────────────────────────────────────
  const [lenderName,     setLenderName]     = useState('')
  const [loanAccountNo,  setLoanAccountNo]  = useState('')
  const [originalAmount, setOriginalAmount] = useState('')
  const [outstanding,    setOutstanding]    = useState('')
  const [interestRate,   setInterestRate]   = useState('')
  const [emiAmount,      setEmiAmount]      = useState('')
  const [tenureMonths,   setTenureMonths]   = useState('')
  const [nextEmiDate,    setNextEmiDate]    = useState('')
  const [debtType,       setDebtType]       = useState('')

  // ── Investment fields ─────────────────────────────────────
  const [investmentName, setInvestmentName] = useState('')
  const [investmentType, setInvestmentType] = useState('')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue,   setCurrentValue]   = useState('')
  const [units,          setUnits]          = useState('')
  const [nav,            setNav]            = useState('')
  const [folioNumber,    setFolioNumber]    = useState('')
  const [capitalGains,   setCapitalGains]   = useState('')

  // ── Rental fields ─────────────────────────────────────────
  const [rentAmount,     setRentAmount]     = useState('')
  const [landlordName,   setLandlordName]   = useState('')
  const [propertyAddr,   setPropertyAddr]   = useState('')
  const [rentPeriod,     setRentPeriod]     = useState('')

  // ── Bank fields ───────────────────────────────────────────
  const [bankName,       setBankName]       = useState('')
  const [accountNumber,  setAccountNumber]  = useState('')
  const [closingBalance, setClosingBalance] = useState('')

  // ── Donation fields ───────────────────────────────────────
  const [orgName,        setOrgName]        = useState('')
  const [donationAmount, setDonationAmount] = useState('')
  const [is80g,          setIs80g]          = useState(true)

  // ── Computed net salary ───────────────────────────────────
  const computedNet = grossSalary && tds
    ? (parseFloat(grossSalary) - parseFloat(tds || '0')).toFixed(0)
    : netSalary

  const handleConfirm = () => {
    const fields: ExtractedFields = {
      // Income
      gross_salary:    grossSalary    ? parseFloat(grossSalary)    : undefined,
      basic_salary:    basicSalary    ? parseFloat(basicSalary)    : undefined,
      hra:             hra            ? parseFloat(hra)            : undefined,
      tds_deducted:    tds            ? parseFloat(tds)            : undefined,
      net_salary:      computedNet    ? parseFloat(computedNet)    : undefined,
      bonus:           bonus          ? parseFloat(bonus)          : undefined,
      pf_deduction:    pfDeduction    ? parseFloat(pfDeduction)    : undefined,
      employer_name:   employerName   || undefined,
      month:           month          ? parseInt(month)            : undefined,
      financial_year:  fy             || undefined,
      // Insurance
      policy_name:     policyName     || undefined,
      insurer_name:    insurerName    || undefined,
      policy_number:   policyNumber   || undefined,
      insurance_type:  insuranceType  || undefined,
      annual_premium:  annualPremium  ? parseFloat(annualPremium) : undefined,
      sum_assured:     sumAssured     ? parseFloat(sumAssured)    : undefined,
      renewal_date:    renewalDate    || undefined,
      nominee_name:    nomineeName    || undefined,
      // Debt
      lender_name:     lenderName     || undefined,
      loan_account_no: loanAccountNo  || undefined,
      original_amount: originalAmount ? parseFloat(originalAmount): undefined,
      outstanding:     outstanding    ? parseFloat(outstanding)   : undefined,
      interest_rate:   interestRate   ? parseFloat(interestRate)  : undefined,
      emi_amount:      emiAmount      ? parseFloat(emiAmount)     : undefined,
      tenure_months:   tenureMonths   ? parseInt(tenureMonths)    : undefined,
      next_emi_date:   nextEmiDate    || undefined,
      debt_type:       debtType       || undefined,
      // Investment
      investment_name: investmentName || undefined,
      investment_type: investmentType || undefined,
      invested_amount: investedAmount ? parseFloat(investedAmount): undefined,
      current_value:   currentValue   ? parseFloat(currentValue)  : undefined,
      units:           units          ? parseFloat(units)         : undefined,
      nav:             nav            ? parseFloat(nav)           : undefined,
      folio_number:    folioNumber    || undefined,
      capital_gains:   capitalGains   ? parseFloat(capitalGains)  : undefined,
      // Rental
      rent_amount:     rentAmount     ? parseFloat(rentAmount)    : undefined,
      landlord_name:   landlordName   || undefined,
      property_address:propertyAddr   || undefined,
      rent_period:     rentPeriod     || undefined,
      // Bank
      bank_name:       bankName       || undefined,
      account_number:  accountNumber  || undefined,
      closing_balance: closingBalance ? parseFloat(closingBalance): undefined,
      // Donation
      organisation_name: orgName      || undefined,
      donation_amount: donationAmount ? parseFloat(donationAmount): undefined,
      is_80g:          is80g,
      // Document
      document_title:  fileName,
    }
    onConfirm(fields)
  }

  const btnStyle = {
    padding: '8px 20px', borderRadius: 8, fontSize: '0.8125rem',
    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  }

  // ── Income section (Form 16 / Salary Slip) ────────────────
  const showIncome = ['form16', 'salary_slip', 'form26as', 'ais'].includes(docType)
  // ── Insurance section ─────────────────────────────────────
  const showInsurance = ['insurance_receipt'].includes(docType)
  // ── Debt section ──────────────────────────────────────────
  const showDebt = ['home_loan_cert', 'loan_statement'].includes(docType)
  // ── Investment section ────────────────────────────────────
  const showInvestment = ['investment_statement'].includes(docType)
  // ── Rental section ────────────────────────────────────────
  const showRental = ['rent_receipt'].includes(docType)
  // ── Bank section ──────────────────────────────────────────
  const showBank = ['bank_statement'].includes(docType)
  // ── Donation section ──────────────────────────────────────
  const showDonation = ['donation_receipt'].includes(docType)

  const SectionTitle = ({ title, color = '#8b97a7' }: { title: string; color?: string }) => (
    <p style={{ color, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {title}
    </p>
  )

  return (
    <div className="space-y-5">
      <div style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ color: '#93c5fd', fontSize: '0.75rem' }}>
          📋 Fill in the values from <strong>{fileName}</strong>. Only filled fields will be synced.
        </p>
      </div>

      {/* ── INCOME FIELDS ─────────────────────────────────── */}
      {showIncome && (
        <div>
          <SectionTitle title="Income / Salary Details" color="#10b981" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employer Name">
              <TxtInput value={employerName} onChange={setEmployerName} placeholder="Amazon, Infosys…" />
            </Field>
            <Field label="Month">
              <SelectInput value={month} onChange={setMonth} options={MONTHS} />
            </Field>
            <Field label="Financial Year">
              <TxtInput value={fy} onChange={setFy} placeholder="2024-2025" />
            </Field>
            <Field label="Gross Salary / Income" hint="Before any deductions">
              <NumInput value={grossSalary} onChange={setGrossSalary} placeholder="e.g. 80000" />
            </Field>
            <Field label="Basic Salary">
              <NumInput value={basicSalary} onChange={setBasicSalary} />
            </Field>
            <Field label="HRA">
              <NumInput value={hra} onChange={setHra} />
            </Field>
            <Field label="TDS Deducted" hint="Goes to Taxes page">
              <NumInput value={tds} onChange={setTds} placeholder="e.g. 8000" />
            </Field>
            <Field label="PF Deduction">
              <NumInput value={pfDeduction} onChange={setPfDeduction} />
            </Field>
            <Field label="Net Salary" hint="Auto-computed if blank">
              <NumInput value={computedNet} onChange={setNetSalary} placeholder="Auto" />
            </Field>
            <Field label="Bonus / Incentive">
              <NumInput value={bonus} onChange={setBonus} />
            </Field>
          </div>
        </div>
      )}

      {/* ── INSURANCE FIELDS ──────────────────────────────── */}
      {showInsurance && (
        <div>
          <SectionTitle title="Insurance Policy Details" color="#f59e0b" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Policy Name" hint="Goes to Insurance page">
              <TxtInput value={policyName} onChange={setPolicyName} placeholder="Health Plus, LIC Jeevan…" />
            </Field>
            <Field label="Insurer Name">
              <TxtInput value={insurerName} onChange={setInsurerName} placeholder="LIC, HDFC Life…" />
            </Field>
            <Field label="Insurance Type">
              <SelectInput value={insuranceType} onChange={setInsuranceType} options={[
                { value: 'health', label: 'Health' }, { value: 'life_term', label: 'Term Life' },
                { value: 'life_endowment', label: 'Endowment' }, { value: 'vehicle', label: 'Vehicle' },
                { value: 'home', label: 'Home' }, { value: 'other', label: 'Other' },
              ]} />
            </Field>
            <Field label="Policy Number">
              <TxtInput value={policyNumber} onChange={setPolicyNumber} />
            </Field>
            <Field label="Annual Premium" hint="Goes to Insurance + Taxes">
              <NumInput value={annualPremium} onChange={setAnnualPremium} />
            </Field>
            <Field label="Sum Assured / Coverage">
              <NumInput value={sumAssured} onChange={setSumAssured} />
            </Field>
            <Field label="Renewal Date" hint="Goes to Calendar">
              <DateInput value={renewalDate} onChange={setRenewalDate} />
            </Field>
            <Field label="Nominee Name">
              <TxtInput value={nomineeName} onChange={setNomineeName} />
            </Field>
          </div>
        </div>
      )}

      {/* ── DEBT FIELDS ───────────────────────────────────── */}
      {showDebt && (
        <div>
          <SectionTitle title="Loan / Debt Details" color="#ef4444" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lender Name">
              <TxtInput value={lenderName} onChange={setLenderName} placeholder="SBI, HDFC Bank…" />
            </Field>
            <Field label="Loan Type">
              <SelectInput value={debtType} onChange={setDebtType} options={[
                { value: 'home_loan', label: 'Home Loan' }, { value: 'vehicle_loan', label: 'Vehicle Loan' },
                { value: 'personal_loan', label: 'Personal Loan' }, { value: 'education_loan', label: 'Education Loan' },
                { value: 'gold_loan', label: 'Gold Loan' }, { value: 'other', label: 'Other' },
              ]} />
            </Field>
            <Field label="Original Loan Amount">
              <NumInput value={originalAmount} onChange={setOriginalAmount} />
            </Field>
            <Field label="Outstanding Balance">
              <NumInput value={outstanding} onChange={setOutstanding} />
            </Field>
            <Field label="Interest Rate (% p.a.)">
              <NumInput value={interestRate} onChange={setInterestRate} placeholder="8.5" />
            </Field>
            <Field label="Monthly EMI">
              <NumInput value={emiAmount} onChange={setEmiAmount} />
            </Field>
            <Field label="Tenure (months)">
              <NumInput value={tenureMonths} onChange={setTenureMonths} placeholder="240" />
            </Field>
            <Field label="Next EMI Date">
              <DateInput value={nextEmiDate} onChange={setNextEmiDate} />
            </Field>
            <Field label="Loan Account Number">
              <TxtInput value={loanAccountNo} onChange={setLoanAccountNo} />
            </Field>
          </div>
        </div>
      )}

      {/* ── INVESTMENT FIELDS ─────────────────────────────── */}
      {showInvestment && (
        <div>
          <SectionTitle title="Investment Details" color="#00C896" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investment Name">
              <TxtInput value={investmentName} onChange={setInvestmentName} placeholder="Axis Bluechip, HDFC FD…" />
            </Field>
            <Field label="Investment Type">
              <SelectInput value={investmentType} onChange={setInvestmentType} options={[
                { value: 'mutual_fund', label: 'Mutual Fund' }, { value: 'stock', label: 'Stock' },
                { value: 'fd', label: 'Fixed Deposit' }, { value: 'ppf', label: 'PPF' },
                { value: 'nps', label: 'NPS' }, { value: 'elss', label: 'ELSS' },
                { value: 'gold', label: 'Gold' }, { value: 'bonds', label: 'Bonds' },
                { value: 'etf', label: 'ETF' }, { value: 'other', label: 'Other' },
              ]} />
            </Field>
            <Field label="Amount Invested">
              <NumInput value={investedAmount} onChange={setInvestedAmount} />
            </Field>
            <Field label="Current Value">
              <NumInput value={currentValue} onChange={setCurrentValue} />
            </Field>
            <Field label="Units / Quantity">
              <NumInput value={units} onChange={setUnits} />
            </Field>
            <Field label="NAV / Price per Unit">
              <NumInput value={nav} onChange={setNav} />
            </Field>
            <Field label="Folio Number">
              <TxtInput value={folioNumber} onChange={setFolioNumber} />
            </Field>
            <Field label="Capital Gains" hint="Goes to Taxes page">
              <NumInput value={capitalGains} onChange={setCapitalGains} />
            </Field>
          </div>
        </div>
      )}

      {/* ── RENTAL FIELDS ─────────────────────────────────── */}
      {showRental && (
        <div>
          <SectionTitle title="Rental Details" color="#c9a227" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rent Amount" hint="Goes to Rental + Taxes">
              <NumInput value={rentAmount} onChange={setRentAmount} />
            </Field>
            <Field label="Landlord Name">
              <TxtInput value={landlordName} onChange={setLandlordName} />
            </Field>
            <Field label="Property Address">
              <TxtInput value={propertyAddr} onChange={setPropertyAddr} placeholder="Anna Nagar, Chennai…" />
            </Field>
            <Field label="Rent Period" hint="e.g. April 2025">
              <TxtInput value={rentPeriod} onChange={setRentPeriod} placeholder="April 2025" />
            </Field>
          </div>
        </div>
      )}

      {/* ── BANK FIELDS ───────────────────────────────────── */}
      {showBank && (
        <div>
          <SectionTitle title="Bank Account Details" color="#3b82f6" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name">
              <TxtInput value={bankName} onChange={setBankName} placeholder="SBI, HDFC…" />
            </Field>
            <Field label="Account Number (last 4)">
              <TxtInput value={accountNumber} onChange={setAccountNumber} placeholder="XXXX" />
            </Field>
            <Field label="Closing Balance" hint="Goes to Accounts page">
              <NumInput value={closingBalance} onChange={setClosingBalance} />
            </Field>
          </div>
        </div>
      )}

      {/* ── DONATION FIELDS ───────────────────────────────── */}
      {showDonation && (
        <div>
          <SectionTitle title="Donation Details" color="#ec4899" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organisation Name">
              <TxtInput value={orgName} onChange={setOrgName} placeholder="CRY, HelpAge…" />
            </Field>
            <Field label="Donation Amount" hint="Goes to Tithe + Taxes (80G)">
              <NumInput value={donationAmount} onChange={setDonationAmount} />
            </Field>
            <Field label="80G Eligible">
              <div className="flex items-center gap-3 mt-1">
                {[{ v: true, l: 'Yes (80G)' }, { v: false, l: 'No' }].map(opt => (
                  <label key={String(opt.v)} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#c9d5e0' }}>
                    <input type="radio" checked={is80g === opt.v} onChange={() => setIs80g(opt.v)} />
                    {opt.l}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* ── OTHER ─────────────────────────────────────────── */}
      {docType === 'other' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: '#8b97a7', fontSize: '0.8125rem' }}>
            Document type could not be identified. It will be saved to <strong style={{ color: '#f5f7fa' }}>Documents</strong> only.
          </p>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #1e252d' }}>
        <button onClick={handleConfirm} disabled={loading} style={{ ...btnStyle, backgroundColor: '#00C896', color: '#000' }}>
          {loading ? 'Syncing to all modules…' : '✓ Confirm & Sync to Modules'}
        </button>
        <button onClick={onCancel} disabled={loading} style={{ ...btnStyle, backgroundColor: 'rgba(255,255,255,0.05)', color: '#8b97a7', fontWeight: 400 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
