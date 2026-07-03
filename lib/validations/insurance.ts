import { z } from 'zod'

export const insurancePolicySchema = z.object({
  policy_name: z.string().min(1, 'Policy name required').max(100),
  insurer_name: z.string().min(1, 'Insurer name required').max(100),
  policy_number: z.string().optional(),
  insurance_type: z.enum(['health','life','vehicle','property','term','ulip','travel','corporate','other']),
  sum_insured: z.number().positive('Sum insured must be positive'),
  annual_premium: z.number().positive('Premium must be positive'),
  premium_frequency: z.enum(['monthly','quarterly','semi_annual','annual']).default('annual'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  renewal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  grace_period_days: z.number().int().min(0).default(30),
  auto_renew: z.boolean().default(false),
  nominees: z.array(z.object({
    name: z.string().min(1),
    relation: z.string().min(1),
    share_pct: z.number().min(0).max(100),
  })).optional().default([]),
  notes: z.string().optional(),
}).refine(d => d.end_date > d.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
})

export const insuranceClaimSchema = z.object({
  policy_id: z.string().uuid(),
  claim_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  claim_amount: z.number().positive(),
  description: z.string().optional(),
})

export type InsurancePolicyFormData = z.infer<typeof insurancePolicySchema>