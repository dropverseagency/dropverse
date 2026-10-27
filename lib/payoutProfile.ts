import { adminClient } from './adminCore'
import { missingPayoutProfileFields } from './profileCompletion'

export async function payoutProfileStatus(userId: string) {
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
  if (freelancer) {
    const [{ data, error }, verification] = await Promise.all([admin
      .from('freelancer_profiles')
      .select('niches')
      .eq('user_id', userId)
      .maybeSingle(), admin.from('freelancer_verifications').select('identity_status').eq('user_id', userId).maybeSingle()])
    if (error) throw error
    niches = Array.isArray(data?.niches) ? data.niches.map(String).filter(Boolean) : []
    if (verification.error && !/does not exist|relation/i.test(verification.error.message || '')) throw verification.error
    if (verification.data?.identity_status !== 'verified') niches.push('__identity_not_verified__')
  }

  const identityMissing = niches.includes('__identity_not_verified__')
  const missing = missingPayoutProfileFields(profile, niches.filter((n) => n !== '__identity_not_verified__'))
  if (identityMissing) missing.push('identity_verification')
  return { complete: missing.length === 0, missing }
}

export function profileIncompleteResponse(missing: string[]) {
  return new Response(JSON.stringify({
    error: 'PROFILE_INCOMPLETE',
    message: 'Complete your profile before using payouts.',
    missing,
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
