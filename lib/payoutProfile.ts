import { adminClient } from './adminCore'
import { missingPayoutProfileFields } from './profileCompletion'

export type PayoutProfileStatus = {
  /** Fields the user can complete themselves (name, phone, username, niches, …). */
  complete: boolean
  missing: string[]
  /**
   * Admin-only KYC flag for freelancers.
   * Not a user-completable onboarding field — must never be pushed into `missing`
   * or the UI will loop users through /onboarding forever.
   */
  identityVerified: boolean
  requiresIdentityVerification: boolean
}

export async function payoutProfileStatus(userId: string): Promise<PayoutProfileStatus> {
  const admin = adminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('full_name, username, phone, user_type, user_types')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError

  const roles = Array.isArray(profile?.user_types) ? profile.user_types : []
  const freelancer = profile?.user_type === 'freelancer' || roles.includes('freelancer')
  let niches: string[] = []
  let identityVerified = true
  let requiresIdentityVerification = false

  if (freelancer) {
    requiresIdentityVerification = true
    const [{ data, error }, verification] = await Promise.all([
      admin.from('freelancer_profiles').select('niches').eq('user_id', userId).maybeSingle(),
      admin.from('freelancer_verifications').select('identity_status').eq('user_id', userId).maybeSingle(),
    ])
    if (error) throw error
    niches = Array.isArray(data?.niches) ? data.niches.map(String).filter(Boolean) : []
    if (verification.error && !/does not exist|relation/i.test(verification.error.message || '')) {
      throw verification.error
    }
    identityVerified = verification.data?.identity_status === 'verified'
  }

  const missing = missingPayoutProfileFields(profile, niches)
  return {
    complete: missing.length === 0,
    missing,
    identityVerified,
    requiresIdentityVerification,
  }
}

export function profileIncompleteResponse(missing: string[]) {
  return new Response(
    JSON.stringify({
      error: 'PROFILE_INCOMPLETE',
      message: 'Complete your profile before using payouts.',
      missing,
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  )
}

export function identityRequiredResponse() {
  return new Response(
    JSON.stringify({
      error: 'IDENTITY_VERIFICATION_REQUIRED',
      message:
        'Identity verification is pending admin review. You can register payment methods now; withdrawal requests open after verification.',
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  )
}
