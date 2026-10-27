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
    const { data, error } = await admin
      .from('freelancer_profiles')
      .select('niches')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    niches = Array.isArray(data?.niches) ? data.niches.map(String).filter(Boolean) : []
  }

  const missing = missingPayoutProfileFields(profile, niches)
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
