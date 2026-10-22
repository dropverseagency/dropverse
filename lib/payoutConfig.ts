/**
 * DropVerse payout product settings.
 * Single source of truth for fee, schedule, and method minimums.
 * Adjust here — do not duplicate across UI/API.
 */

export const PAYOUT_CURRENCY = 'USD' as const

/** Flat DropVerse fee charged once per successful payout request. */
export const DROPVERSE_PAYOUT_FEE_USD = 2

/** Scheduled processing days of the month (calendar). */
export const PAYOUT_SCHEDULE_DAYS = [5, 20] as const

export type PayoutMethodId = 'paypal' | 'local'

export type PayoutMethodConfig = {
  id: PayoutMethodId
  label: string
  minUsd: number
  /**
   * When true, users may submit a withdrawal request for admin review.
   * This does not mean automatic/provider transfers are enabled.
   */
  enabled: boolean
  description: string
}

/**
 * Request intake is enabled for PayPal and Local Payments so requests can
 * appear in the admin workflow. All payouts remain manually reviewed/processed;
 * no automatic provider transfer is initiated by this setting. Crypto/USDT
 * intentionally omitted.
 */
export const PAYOUT_METHODS: PayoutMethodConfig[] = [
  {
    id: 'paypal',
    label: 'PayPal',
    minUsd: 50,
    enabled: true,
    description:
      'Submit a PayPal withdrawal request for admin review. Minimum $50. Requests are not paid automatically; transfer eligibility and processing are reviewed manually.',
  },
  {
    id: 'local',
    label: 'Local Payments',
    minUsd: 25,
    enabled: true,
    description:
      'Submit a local bank/mobile-money withdrawal request for admin review (minimum equivalent of $25). Requests are not paid automatically; availability and processing are reviewed manually.',
  },
]

export function methodById(id: string | null | undefined): PayoutMethodConfig | undefined {
  return PAYOUT_METHODS.find((m) => m.id === id)
}

/** Next scheduled processing date (UTC date at 00:00). Not a guaranteed arrival date. */
export function nextScheduledProcessingDate(from: Date = new Date()): Date {
  const y = from.getUTCFullYear()
  const m = from.getUTCMonth()
  const d = from.getUTCDate()
  for (const day of PAYOUT_SCHEDULE_DAYS) {
    if (d < day) return new Date(Date.UTC(y, m, day))
  }
  // Roll to first schedule day next month
  return new Date(Date.UTC(y, m + 1, PAYOUT_SCHEDULE_DAYS[0]))
}

export function estimateNetUsd(grossUsd: number): {
  gross: number
  dropverseFee: number
  estimatedNet: number
} {
  const gross = Math.max(0, Math.round(Number(grossUsd) * 100) / 100)
  const dropverseFee = gross > 0 ? DROPVERSE_PAYOUT_FEE_USD : 0
  const estimatedNet = Math.round((gross - dropverseFee) * 100) / 100
  return { gross, dropverseFee, estimatedNet }
}

export function formatUsd(n: number | null | undefined): string {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
}
