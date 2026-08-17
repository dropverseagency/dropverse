// Centralized configuration layer for the DropVerse Partner Program.
// All business rules live here (and later in the Supabase program_config table),
// NOT in UI components, so admin can change them without touching the frontend.
// NOTE: commission amounts must ALWAYS be calculated server-side (e.g., in a Supabase
// database function or server route) — never trusted from the client.

export const REFERRAL_HOST = 'dropverse.com'
export const REFERRAL_PATH_PREFIX = '/r'

export const REFERRAL_ELIGIBILITY_MONTHS = 12

export const REFERRAL_TIERS = [
  { name: 'STARTER', min: 1, max: 5, ratePct: 10 },
  { name: 'GROWTH', min: 6, max: 20, ratePct: 15 },
  { name: 'PRO', min: 21, max: 50, ratePct: 20 },
  { name: 'PARTNER', min: 51, max: Infinity, ratePct: 25 },
] as const

export function commissionRateFor(activeReferralCount: number): number {
  for (const tier of REFERRAL_TIERS) {
    if (activeReferralCount >= tier.min && activeReferralCount <= tier.max) return tier.ratePct / 100
  }
  return 0
}

export function referralLinkFor(code: string, baseHost?: string): string {
  return `https://${baseHost ?? REFERRAL_HOST}${REFERRAL_PATH_PREFIX}/${code}`
}

// Commission statuses enforced server-side
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled'
export const COMMISSION_STATUSES: CommissionStatus[] = ['pending', 'approved', 'paid', 'cancelled']

// Referral statuses
export type ReferralStatus = 'active' | 'expired' | 'cancelled'
export const REFERRAL_STATUSES: ReferralStatus[] = ['active', 'expired', 'cancelled']

// Separate commission architecture for user referrals vs client referrals,
// so both can be configured independently later (e.g., different rates/pools).
export type ReferralKind = 'user' | 'client'
export const REFERRAL_KINDS: ReferralKind[] = ['user', 'client']
