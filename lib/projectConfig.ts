/**
 * Centralized DropVerse project / billing configuration.
 *
 * Core business rule: NO CONFIRMED PAYMENT = NO FULFILLMENT.
 * Recurring billing automation is NOT implemented yet — this config only
 * stores intervals, periods and statuses so future billing can be layered on.
 */

export type ProjectType = 'ONE_TIME' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM_RECURRING'
export type BillingInterval = 'ONE_TIME' | 'MONTH' | 'YEAR' | 'CUSTOM'

export const PROJECT_TYPES: { id: ProjectType; label: string; description: string; comingSoon?: boolean }[] = [
  {
    id: 'ONE_TIME',
    label: 'One-Time Project',
    description: 'Pay once for the complete project. Full amount is paid before fulfillment begins.',
  },
  {
    id: 'MONTHLY',
    label: 'Monthly Subscription',
    description: 'Recurring monthly service. The full first month is paid upfront before fulfillment starts.',
  },
  {
    id: 'ANNUAL',
    label: 'Annual Subscription',
    description: 'Recurring yearly service. The full first year is paid upfront — not twelve monthly payments.',
  },
  {
    id: 'CUSTOM_RECURRING',
    label: 'Custom Recurring',
    description: 'Quarterly, bi-monthly or custom recurring contracts.',
    comingSoon: true,
  },
]

export type PaymentMethod = 'CLIENT_PAYS_DROPVERSE' | 'SELLER_COLLECTED'

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; description: string; recommended?: boolean }[] = [
  {
    id: 'CLIENT_PAYS_DROPVERSE',
    label: 'Client Pays DropVerse',
    description: 'The client pays the required amount directly to DropVerse.',
    recommended: true,
  },
  {
    id: 'SELLER_COLLECTED',
    label: 'I Already Collected Payment',
    description: 'You already collected payment from the client. You only send the DropVerse fulfillment amount.',
  },
]

export type PaymentStatus = 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED'
export type ProjectStatus =
  | 'DRAFT'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'READY_FOR_FULFILLMENT'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAST_DUE'
  | 'EXPIRED'

// Payment flow: PAYMENT_PENDING -> PAYMENT_CONFIRMED -> READY_FOR_FULFILLMENT -> IN_PROGRESS
export const PAYMENT_FLOW = ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_FOR_FULFILLMENT', 'IN_PROGRESS'] as const

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  READY_FOR_FULFILLMENT: 'Ready for Fulfillment',
  ACTIVE: 'Active',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PAST_DUE: 'Past Due',
  EXPIRED: 'Expired',
}

/** Allowed transitions from a given status. */
export const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['READY_FOR_FULFILLMENT', 'CANCELLED'],
  READY_FOR_FULFILLMENT: ['ACTIVE', 'IN_PROGRESS', 'CANCELLED'],
  ACTIVE: ['IN_PROGRESS', 'PAST_DUE', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'COMPLETED', 'PAST_DUE', 'CANCELLED'],
  IN_REVIEW: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  PAST_DUE: ['PAYMENT_CONFIRMED', 'EXPIRED', 'CANCELLED'],
  EXPIRED: ['CANCELLED'],
}

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

/** Fulfillment statuses require payment confirmation first. */
export const FULFILLMENT_STATUSES: ProjectStatus[] = [
  'READY_FOR_FULFILLMENT',
  'ACTIVE',
  'IN_PROGRESS',
  'IN_REVIEW',
  'COMPLETED',
]

export function isFulfillmentStatus(status: string): boolean {
  return FULFILLMENT_STATUSES.includes(status as ProjectStatus)
}

export function billingIntervalFor(type: ProjectType): BillingInterval {
  switch (type) {
    case 'ONE_TIME': return 'ONE_TIME'
    case 'MONTHLY': return 'MONTH'
    case 'ANNUAL': return 'YEAR'
    case 'CUSTOM_RECURRING': return 'CUSTOM'
  }
}

export interface MoneyLabel {
  priceLabel: string
  costLabel: string
  profitLabel: string
  periodSuffix: string
  paymentNowMessage: string
  fulfillmentMessage: string
}

/** Labels that adapt to the chosen project type (seller-facing only). */
export function moneyLabels(type: ProjectType): MoneyLabel {
  switch (type) {
    case 'ONE_TIME':
      return {
        priceLabel: 'Client Price',
        costLabel: 'DropVerse Fulfillment Cost',
        profitLabel: 'Estimated Seller Profit',
        periodSuffix: ' one-time',
        paymentNowMessage: 'One-time payment',
        fulfillmentMessage: 'Fulfillment begins after the full payment is confirmed.',
      }
    case 'MONTHLY':
      return {
        priceLabel: 'Monthly Client Price',
        costLabel: 'Monthly DropVerse Fulfillment Cost',
        profitLabel: 'Estimated Monthly Seller Profit',
        periodSuffix: ' / month',
        paymentNowMessage: 'First payment due now',
        fulfillmentMessage: 'Fulfillment begins after the first month\u2019s payment is confirmed.',
      }
    case 'ANNUAL':
      return {
        priceLabel: 'Annual Client Price',
        costLabel: 'Annual DropVerse Fulfillment Cost',
        profitLabel: 'Estimated Annual Seller Profit',
        periodSuffix: ' / year',
        paymentNowMessage: 'First annual payment due now',
        fulfillmentMessage: 'Fulfillment begins after the full annual payment is confirmed.',
      }
    case 'CUSTOM_RECURRING':
      return {
        priceLabel: 'Client Price',
        costLabel: 'DropVerse Fulfillment Cost',
        profitLabel: 'Estimated Seller Profit',
        periodSuffix: ' / period',
        paymentNowMessage: 'Initial period payment due now',
        fulfillmentMessage: 'Fulfillment begins after the initial period payment is confirmed.',
      }
  }
}

/**
 * PLATFORM FULFILLMENT RATES (set once by DropVerse, applied automatically).
 * The seller never enters a fulfillment cost — it is computed from the client
 * price using the rate configured for the chosen project type. These rates are
 * derived from the service pricing we will define in the platform later; they
 * are the single source of truth so cost can never be faked by the client.
 *
 * When real per-service pricing tables exist, replace computeFulfillmentCost
 * with a lookup; the interface (type + client price -> cost) stays the same.
 */
export const FULFILLMENT_RATES: Record<ProjectType, number> = {
  ONE_TIME: 0.40, // 40% of client price
  MONTHLY: 0.40,
  ANNUAL: 0.35,   // discounted rate for annual commitments
  CUSTOM_RECURRING: 0.40,
}

/** Automatic fulfillment cost from the platform rates. Never trust the client. */
export function computeFulfillmentCost(type: ProjectType, clientPrice: number): number {
  const cost = clientPrice * (FULFILLMENT_RATES[type] ?? 0.40)
  return Math.round(cost * 100) / 100
}

/** Server-side rule: profit = client price - fulfillment cost. Never trust the client. */
export function computeSellerProfit(clientPrice: number, fulfillmentCost: number): number {
  const profit = clientPrice - fulfillmentCost
  return Math.round(profit * 100) / 100
}

export function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export interface ProjectDraft {
  title: string
  description: string
  projectType: ProjectType
  clientPrice: number
  /** Ignored by the server — fulfillment cost is auto-computed from platform rates. */
  fulfillmentCost: number
  paymentMethod: PaymentMethod
  deliveryNotes: string
  clientContactEmail: string
}

/** Required upfront payment for the current period (seller-facing "Payment Required Now"). */
export function paymentRequiredNow(d: ProjectDraft): number {
  switch (d.projectType) {
    case 'ONE_TIME': return d.fulfillmentCost
    case 'MONTHLY': return d.fulfillmentCost
    case 'ANNUAL': return d.fulfillmentCost
    case 'CUSTOM_RECURRING': return d.fulfillmentCost
  }
}

export function firstBillingPeriodLabel(type: ProjectType): string {
  switch (type) {
    case 'ONE_TIME': return 'One-time project'
    case 'MONTHLY': return '1 month'
    case 'ANNUAL': return '1 year'
    case 'CUSTOM_RECURRING': return 'Custom period'
  }
}
