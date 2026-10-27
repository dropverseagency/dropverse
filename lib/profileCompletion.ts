export type ProfileForPayout = {
  full_name?: string | null
  username?: string | null
  phone?: string | null
  user_type?: string | null
  user_types?: string[] | null
}

export function missingPayoutProfileFields(profile: ProfileForPayout | null, niches: string[] = []): string[] {
  const missing: string[] = []
  if (!profile?.full_name?.trim() || profile.full_name.trim().length < 2) missing.push('full name')
  if (!profile?.username?.trim() || profile.username.trim().length < 3) missing.push('username')
  if (!profile?.phone?.trim() || profile.phone.replace(/\D/g, '').length < 7) missing.push('mobile number')
  const roles = Array.isArray(profile?.user_types) ? profile.user_types : []
  const primaryRole = profile?.user_type?.trim() || ''
  if (!primaryRole && roles.length === 0) missing.push('account type')
  if ((primaryRole === 'freelancer' || roles.includes('freelancer')) && niches.length === 0) missing.push('freelancer niche')
  return missing
}
