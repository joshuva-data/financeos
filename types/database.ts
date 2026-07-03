export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Enums ────────────────────────────────────────────────────────────────────

export type AccountType =
  | 'savings' | 'current' | 'salary' | 'fd' | 'rd' | 'ppf' | 'nps'
  | 'wallet' | 'cash' | 'credit_card' | 'loan' | 'demat' | 'other'

export type AccountStatus = 'active' | 'inactive' | 'closed'

export type TxnType = 'income' | 'expense' | 'transfer' | 'investment' | 'loan_payment' | 'other'
export type TxnStatus = 'cleared' | 'pending' | 'reconciled' | 'void'
export type TxnDirection = 'credit' | 'debit'

export type IncomeType =
  | 'salary' | 'freelance' | 'rental' | 'dividend' | 'interest'
  | 'bonus' | 'capital_gains' | 'business' | 'gift' | 'other'

export type InsuranceType =
  | 'health' | 'life' | 'vehicle' | 'property'
  | 'term' | 'ulip' | 'travel' | 'corporate' | 'other'

export type InsuranceStatus = 'active' | 'lapsed' | 'renewal_due' | 'expired' | 'claimed'
export type PremiumFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

export type InvestmentType =
  | 'equity_stock' | 'mutual_fund' | 'fd' | 'rd' | 'ppf' | 'epf'
  | 'nps' | 'gold' | 'bonds' | 'reits' | 'etf' | 'crypto' | 'other'

export type DebtType =
  | 'home_loan' | 'vehicle_loan' | 'personal_loan' | 'education_loan'
  | 'gold_loan' | 'credit_card_outstanding' | 'bnpl' | 'friend_family' | 'other'

export type ReceivableStatus = 'pending' | 'partially_received' | 'received' | 'overdue' | 'written_off'
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export type CalendarEventType =
  | 'emi_due' | 'insurance_renewal' | 'tax_deadline' | 'goal_milestone'
  | 'investment_maturity' | 'rent_due' | 'receivable_due' | 'custom'

export type DocType =
  | 'insurance_policy' | 'tax_document' | 'salary_slip' | 'bank_statement'
  | 'investment_statement' | 'property_document' | 'vehicle_document'
  | 'identity_document' | 'loan_document' | 'rental_agreement' | 'receipt' | 'other'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type ImportSource = 'excel' | 'csv' | 'pdf' | 'gmail' | 'angel_one' | 'indmoney' | 'manual'
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
export type InsightType = 'alert' | 'recommendation' | 'anomaly' | 'forecast' | 'summary'
export type InsightSeverity = 'info' | 'warning' | 'critical'

// ─── Row Types (DB → App) ─────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  display_name: string | null
  email: string
  phone: string | null
  pan_number: string | null
  aadhaar_last4: string | null
  date_of_birth: string | null
  financial_year: string
  currency: string
  timezone: string
  avatar_url: string | null
  onboarding_done: boolean
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  account_type: AccountType
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  balance: number
  credit_limit: number | null
  interest_rate: number | null
  status: AccountStatus
  is_primary: boolean
  color: string | null
  icon: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  to_account_id: string | null
  txn_type: TxnType
  amount: number
  direction: TxnDirection
  category: string
  subcategory: string | null
  description: string | null
  notes: string | null
  merchant: string | null
  reference_no: string | null
  tags: string[]
  txn_date: string
  value_date: string | null
  status: TxnStatus
  is_recurring: boolean
  recurring_id: string | null
  document_id: string | null
  is_tax_relevant: boolean
  tax_category: string | null
  created_at: string
  updated_at: string
}

export interface IncomeEntry {
  id: string
  user_id: string
  account_id: string | null
  transaction_id: string | null
  income_type: IncomeType
  source_name: string
  gross_amount: number
  tds_deducted: number
  net_amount: number  // computed
  month: number
  financial_year: string
  is_taxable: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsurancePolicy {
  id: string
  user_id: string
  policy_name: string
  insurer_name: string
  policy_number: string | null
  insurance_type: InsuranceType
  status: InsuranceStatus
  sum_insured: number
  annual_premium: number
  premium_frequency: PremiumFrequency
  start_date: string
  end_date: string
  renewal_date: string
  grace_period_days: number
  premium_account_id: string | null
  nominees: InsuranceNominee[]
  coverage_details: Record<string, Json>
  agent_name: string | null
  agent_phone: string | null
  document_url: string | null
  auto_renew: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsuranceNominee {
  name: string
  relation: string
  share_pct: number
}

export interface InsuranceClaim {
  id: string
  user_id: string
  policy_id: string
  claim_number: string | null
  claim_date: string
  incident_date: string | null
  claim_amount: number
  approved_amount: number | null
  settled_amount: number | null
  status: 'filed' | 'under_review' | 'approved' | 'rejected' | 'settled' | 'withdrawn'
  description: string | null
  document_urls: string[]
  settled_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Investment {
  id: string
  user_id: string
  investment_type: InvestmentType
  name: string
  symbol: string | null
  isin: string | null
  account_id: string | null
  units: number | null
  avg_buy_price: number | null
  current_price: number | null
  current_value: number | null
  invested_amount: number
  unrealized_pnl: number | null
  xirr: number | null
  folio_number: string | null
  broker: string | null
  start_date: string | null
  maturity_date: string | null
  interest_rate: number | null
  maturity_amount: number | null
  is_tax_saving: boolean
  lock_in_until: string | null
  last_synced_at: string | null
  sync_source: string | null
  external_id: string | null
  metadata: Record<string, Json>
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DebtAccount {
  id: string
  user_id: string
  account_id: string | null
  debt_type: DebtType
  lender_name: string
  loan_account_no: string | null
  original_amount: number
  outstanding: number
  emi_amount: number | null
  interest_rate: number
  rate_type: 'fixed' | 'floating'
  disbursement_date: string | null
  emi_start_date: string | null
  tenure_months: number | null
  remaining_months: number | null
  next_emi_date: string | null
  emi_account_id: string | null
  prepayment_penalty: boolean
  collateral: string | null
  co_borrower: string | null
  document_url: string | null
  is_active: boolean
  closed_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Receivable {
  id: string
  user_id: string
  from_name: string
  from_type: 'individual' | 'company' | 'tenant' | 'other'
  amount: number
  amount_received: number
  balance_due: number  // computed
  due_date: string
  reason: string
  status: ReceivableStatus
  contact_phone: string | null
  contact_email: string | null
  is_rental: boolean
  rental_id: string | null
  reminder_sent: boolean
  last_reminder: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RentalProperty {
  id: string
  user_id: string
  property_name: string
  address: string
  property_type: 'residential' | 'commercial' | 'plot' | 'other'
  unit_label: string | null
  built_up_area: number | null
  purchase_price: number | null
  current_value: number | null
  monthly_rent: number
  advance_deposit: number
  maintenance_charge: number
  loan_id: string | null
  is_occupied: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  user_id: string
  property_id: string
  tenant_name: string
  phone: string | null
  email: string | null
  aadhaar_last4: string | null
  lease_start: string
  lease_end: string | null
  monthly_rent: number
  deposit_paid: number
  rent_due_day: number
  is_active: boolean
  notes: string | null
  document_urls: string[]
  created_at: string
  updated_at: string
}

export interface TaxProfile {
  id: string
  user_id: string
  financial_year: string
  assessment_year: string
  regime: 'old' | 'new'
  gross_salary: number
  hra_received: number
  hra_exemption: number
  standard_deduction: number
  total_tds: number
  advance_tax_paid: number
  self_assessment_tax: number
  estimated_liability: number | null
  balance_tax_due: number | null
  itr_filed: boolean
  itr_filed_date: string | null
  itr_form: string | null
  acknowledgement_no: string | null
  refund_amount: number | null
  refund_received: boolean | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TaxDeduction {
  id: string
  user_id: string
  tax_profile_id: string
  section: string
  instrument: string
  amount_claimed: number
  max_allowed: number | null
  investment_id: string | null
  insurance_id: string | null
  document_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CorporateBenefits {
  id: string
  user_id: string
  employer_name: string
  financial_year: string
  epf_employee_contrib: number
  epf_employer_contrib: number
  epf_balance: number
  uan_number: string | null
  gratuity_eligible: boolean
  years_of_service: number | null
  estimated_gratuity: number | null
  corporate_health_cover: number | null
  corporate_life_cover: number | null
  annual_bonus: number
  joining_bonus: number
  retention_bonus: number
  variable_pay: number
  lta_balance: number
  medical_reimbursement: number
  learning_budget: number
  learning_used: number
  notice_period_days: number | null
  total_leaves: number | null
  leaves_taken: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TitheEntry {
  id: string
  user_id: string
  account_id: string | null
  recipient_name: string
  amount: number
  giving_date: string
  category: 'tithe' | 'offering' | 'charity' | 'donation' | 'other'
  gross_income_ref: number | null
  tithe_pct: number
  is_recurring: boolean
  receipt_no: string | null
  document_url: string | null
  tax_deductible: boolean
  section_80g: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinancialGoal {
  id: string
  user_id: string
  name: string
  description: string | null
  target_amount: number
  current_amount: number
  target_date: string | null
  priority: 1 | 2 | 3 | 4 | 5
  status: GoalStatus
  category: string | null
  linked_account_id: string | null
  color: string | null
  icon: string | null
  monthly_contrib: number | null
  notes: string | null
  completed_date: string | null
  created_at: string
  updated_at: string
}

export interface NetWorthSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number  // computed
  liquid_cash: number
  investments_val: number
  receivables_val: number
  real_estate_val: number
  debt_total: number
  metadata: Record<string, Json>
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  doc_type: DocType
  title: string
  description: string | null
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string
  storage_bucket: string
  linked_id: string | null
  linked_type: string | null
  expiry_date: string | null
  tags: string[]
  is_sensitive: boolean
  financial_year: string | null
  uploaded_at: string
  created_at: string
  updated_at: string
}

export interface AIInsight {
  id: string
  user_id: string
  insight_type: InsightType
  title: string
  body: string
  severity: InsightSeverity
  is_read: boolean
  is_dismissed: boolean
  data_context: Record<string, Json>
  linked_module: string | null
  expires_at: string | null
  created_at: string
}

// ─── Insert Types (App → DB) ───────────────────────────────────────────────────

export type AccountInsert = Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type TransactionInsert = Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type InsurancePolicyInsert = Omit<InsurancePolicy, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type InvestmentInsert = Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type DebtAccountInsert = Omit<DebtAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type ReceivableInsert = Omit<Receivable, 'id' | 'user_id' | 'balance_due' | 'created_at' | 'updated_at'>
export type FinancialGoalInsert = Omit<FinancialGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type TitheEntryInsert = Omit<TitheEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type DocumentInsert = Omit<Document, 'id' | 'user_id' | 'uploaded_at' | 'created_at' | 'updated_at'>

// ─── Update Types ──────────────────────────────────────────────────────────────

export type AccountUpdate = Partial<AccountInsert>
export type TransactionUpdate = Partial<TransactionInsert>
export type InsurancePolicyUpdate = Partial<InsurancePolicyInsert>
export type InvestmentUpdate = Partial<InvestmentInsert>
export type DebtAccountUpdate = Partial<DebtAccountInsert>
export type FinancialGoalUpdate = Partial<FinancialGoalInsert>

// ─── Supabase Database type (for createClient<Database>()) ────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      accounts: { Row: Account; Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>; Update: AccountUpdate }
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>; Update: TransactionUpdate }
      income_entries: { Row: IncomeEntry; Insert: Omit<IncomeEntry, 'id' | 'net_amount' | 'created_at' | 'updated_at'>; Update: Partial<IncomeEntry> }
      insurance_policies: { Row: InsurancePolicy; Insert: Omit<InsurancePolicy, 'id' | 'created_at' | 'updated_at'>; Update: InsurancePolicyUpdate }
      insurance_claims: { Row: InsuranceClaim; Insert: Omit<InsuranceClaim, 'id' | 'created_at' | 'updated_at'>; Update: Partial<InsuranceClaim> }
      investments: { Row: Investment; Insert: Omit<Investment, 'id' | 'created_at' | 'updated_at'>; Update: InvestmentUpdate }
      debt_accounts: { Row: DebtAccount; Insert: Omit<DebtAccount, 'id' | 'created_at' | 'updated_at'>; Update: DebtAccountUpdate }
      receivables: { Row: Receivable; Insert: ReceivableInsert; Update: Partial<ReceivableInsert> }
      rental_properties: { Row: RentalProperty; Insert: Omit<RentalProperty, 'id' | 'created_at' | 'updated_at'>; Update: Partial<RentalProperty> }
      tenants: { Row: Tenant; Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Tenant> }
      tax_profiles: { Row: TaxProfile; Insert: Omit<TaxProfile, 'id' | 'created_at' | 'updated_at'>; Update: Partial<TaxProfile> }
      tax_deductions: { Row: TaxDeduction; Insert: Omit<TaxDeduction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<TaxDeduction> }
      corporate_benefits: { Row: CorporateBenefits; Insert: Omit<CorporateBenefits, 'id' | 'created_at' | 'updated_at'>; Update: Partial<CorporateBenefits> }
      tithe_entries: { Row: TitheEntry; Insert: TitheEntryInsert; Update: Partial<TitheEntryInsert> }
      financial_goals: { Row: FinancialGoal; Insert: FinancialGoalInsert; Update: FinancialGoalUpdate }
      net_worth_snapshots: { Row: NetWorthSnapshot; Insert: Omit<NetWorthSnapshot, 'id' | 'net_worth' | 'created_at'>; Update: never }
      documents: { Row: Document; Insert: DocumentInsert; Update: Partial<DocumentInsert> }
      ai_insights: { Row: AIInsight; Insert: Omit<AIInsight, 'id' | 'created_at'>; Update: Pick<AIInsight, 'is_read' | 'is_dismissed'> }
    }
    Functions: {
      compute_net_worth: { Args: { p_user_id: string }; Returns: NetWorthSnapshot }
      seed_default_categories: { Args: { p_user_id: string }; Returns: void }
    }
  }
}

// ─── App-layer computed types ──────────────────────────────────────────────────

export interface DashboardSummary {
  netWorth: number
  netWorthChange: number
  netWorthChangePct: number
  liquidCash: number
  investedValue: number
  receivablesTotal: number
  debtTotal: number
  monthlyIncome: number
  monthlyExpenses: number
  savingsRate: number
  insuranceRenewalsNext30Days: InsurancePolicy[]
  emisDueThisMonth: DebtAccount[]
  overdueReceivables: Receivable[]
  overdueRentals: { tenant: Tenant; property: RentalProperty; amountDue: number }[]
  topExpenseCategories: { category: string; amount: number; pct: number }[]
  netWorthHistory: NetWorthSnapshot[]
  aiInsights: AIInsight[]
}

export interface FinancialYearSummary {
  fy: string
  grossIncome: number
  totalExpenses: number
  totalSaved: number
  totalInvested: number
  totalTithe: number
  totalDebtRepaid: number
  netWorthStart: number
  netWorthEnd: number
  netWorthGrowth: number
}

export interface TaxEstimate {
  regime: 'old' | 'new'
  grossSalary: number
  totalDeductions: number
  taxableIncome: number
  taxBeforeCess: number
  educationCess: number
  totalTax: number
  tdsPaid: number
  advanceTaxPaid: number
  balanceDue: number
  refundDue: number
}

// ─── AI Copilot types ──────────────────────────────────────────────────────────

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolUsed?: string
  dataContext?: Record<string, Json>
}

export interface CopilotQuery {
  query: string
  userId: string
  financialContext: DashboardSummary
}

// ─── Integration / Connector types ────────────────────────────────────────────

export interface IntegrationProvider {
  id: string
  name: string
  connect: (credentials: Record<string, string>) => Promise<boolean>
  sync: () => Promise<ImportJob>
  disconnect: () => Promise<void>
  refresh: () => Promise<boolean>
  validate: () => Promise<boolean>
}

export interface ImportJob {
  id: string
  user_id: string
  source_type: ImportSource
  source_name: string
  status: ImportStatus
  total_records: number | null
  imported_records: number | null
  failed_records: number | null
  error_details: { row?: number; message: string; raw?: string }[]
  file_path: string | null
  mapping_config: Record<string, string>
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// ─── Form schemas (paired with Zod in lib/validations/) ───────────────────────

export interface AccountFormValues {
  name: string
  account_type: AccountType
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  balance: number
  credit_limit?: number
  status: AccountStatus
  is_primary: boolean
  notes?: string
}

export interface TransactionFormValues {
  account_id: string
  txn_type: TxnType
  direction: TxnDirection
  amount: number
  category: string
  subcategory?: string
  description?: string
  merchant?: string
  tags?: string[]
  txn_date: string
  status: TxnStatus
  is_tax_relevant?: boolean
  tax_category?: string
}

export interface InsurancePolicyFormValues {
  policy_name: string
  insurer_name: string
  policy_number?: string
  insurance_type: InsuranceType
  sum_insured: number
  annual_premium: number
  premium_frequency: PremiumFrequency
  start_date: string
  end_date: string
  renewal_date: string
  auto_renew: boolean
  nominees?: InsuranceNominee[]
}

export interface GoalFormValues {
  name: string
  target_amount: number
  current_amount?: number
  target_date?: string
  priority?: 1 | 2 | 3 | 4 | 5
  category?: string
  monthly_contrib?: number
  notes?: string
}