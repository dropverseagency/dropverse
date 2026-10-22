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
  /** When false, UI shows Coming soon and API rejects requests. */
  enabled: boolean
  description: string
}

/**
 * Supported withdrawal methods. Crypto/USDT intentionally omitted.
 * Local Payments is available for registration and withdrawal requests.
 */
export const PAYOUT_METHODS: PayoutMethodConfig[] = [
  {
    id: 'paypal',
    label: 'PayPal',
    minUsd: 50,
    enabled: false,
    description: 'Withdraw to a PayPal account in USD. Minimum $50.',
  },
  {
    id: 'local',
    label: 'Local Payments',
    minUsd: 25,
    enabled: false,
    description:
      'Local bank transfer or mobile money (Egypt / regional). Minimum $25 equivalent. Ops confirms corridor details before sending.',
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
