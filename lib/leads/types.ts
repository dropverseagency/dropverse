export type LeadPackStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'sold_out'

export type LeadPurchaseStatus = 'pending_payment' | 'paid' | 'refunded' | 'cancelled'

export type LeadLedgerEvent = 'sale_credit' | 'refund_debit' | 'payout' | 'adjustment'

export type LeadPackPublic = {
  id: string
  seller_id: string
  title: string
  description: string
  niche: string
  countries: string[]
  price_usd: number
  currency: string
  max_buyers: number
  admin_max_buyers: number | null
  sold_count: number
  effective_max_buyers: number
  remaining_seats: number
  status: LeadPackStatus
  preview_meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const LEAD_COMMISSION_DEFAULT = 0.2
export const LEAD_DEFAULT_MAX_BUYERS = 10
export const LEAD_MAX_FILE_BYTES = 10 * 1024 * 1024
export const LEAD_ALLOWED_MIME = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/csv',
  'text/plain',
])

export function effectiveMaxBuyers(maxBuyers: number, adminMax: number | null | undefined): number {
  if (adminMax == null || Number.isNaN(Number(adminMax))) return maxBuyers
  return Math.min(maxBuyers, Number(adminMax))
}

export function remainingSeats(maxBuyers: number, adminMax: number | null | undefined, sold: number): number {
  return Math.max(0, effectiveMaxBuyers(maxBuyers, adminMax) - sold)
}

export function splitCommission(priceUsd: number, rate: number): { platformFee: number; sellerNet: number } {
  const price = Math.round(Number(priceUsd) * 100) / 100
  const platformFee = Math.round(price * rate * 100) / 100
  const sellerNet = Math.round((price - platformFee) * 100) / 100
  return { platformFee, sellerNet }
}
