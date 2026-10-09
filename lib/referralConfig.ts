// Centralized configuration layer for the DropVerse Partner Program.
// Commission amounts must always be calculated server-side, never trusted from the client.

export const REFERRAL_HOST = 'dropverse-nu.vercel.app'
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

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled'
export const COMMISSION_STATUSES: CommissionStatus[] = ['pending', 'approved', 'paid', 'cancelled']

export type ReferralStatus = 'active' | 'expired' | 'cancelled'
export const REFERRAL_STATUSES: ReferralStatus[] = ['active', 'expired', 'cancelled']

export type ReferralKind = 'user' | 'client'
export const REFERRAL_KINDS: ReferralKind[] = ['user', 'client']
