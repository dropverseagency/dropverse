import { createClient } from './supabase'

function normalisePortfolioLink(raw: string) {
  const url = new URL(raw.trim())
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) {
    throw new Error('Portfolio links must use a valid HTTPS URL.')
  }
  const host = url.hostname.toLowerCase()
  const platform = host === 'behance.net' || host.endsWith('.behance.net')
    ? 'behance'
    : host === 'dribbble.com' || host.endsWith('.dribbble.com')
      ? 'dribbble'
      : host === 'upwork.com' || host.endsWith('.upwork.com')
        ? 'upwork'
        : 'other'
  return { platform, url: url.toString() }
}

export async function saveFreelancerDetails(userId: string, displayName: string, niches: string[], otherNiche: string, links: string[]) {
  const supabase = createClient()
  const selectedNiches = [...new Set(niches.map((niche) => niche.trim()).filter(Boolean))]
  if (!selectedNiches.length) throw new Error('Select at least one freelancer niche.')
  if (links.length < 1 || links.length > 5) throw new Error('Add between 1 and 5 portfolio links.')
  const normalisedLinks = links.map(normalisePortfolioLink)

  const { error: profileError } = await supabase.from('freelancer_profiles').upsert({
    user_id: userId,
    display_name: displayName.trim().slice(0, 80) || 'Freelancer',
    category: selectedNiches[0],
    niches: selectedNiches,
    other_niche: selectedNiches.includes('Other') ? otherNiche.trim().slice(0, 100) : null,
  }, { onConflict: 'user_id' })
  if (profileError) throw profileError

  // Create defaults only for first-time profiles. Do not overwrite a freelancer's
  // chosen availability or an existing verification review on later profile edits.
  const { error: availabilityError } = await supabase.from('freelancer_availability').upsert({
    user_id: userId,
    available: true,
    capacity: 1,
    typical_turnaround_days: 3,
  }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (availabilityError) throw availabilityError

  const verificationResponse = await fetch('/api/freelancers/verification', {
    method: 'POST',
    credentials: 'include',
  })
  if (!verificationResponse.ok) {
    throw new Error('Could not initialise freelancer verification. Please retry.')
  }

  // Replace portfolio links rather than accumulating duplicates on each edit.
  const { error: deleteLinksError } = await supabase.from('freelancer_links').delete().eq('user_id', userId)
  if (deleteLinksError) throw deleteLinksError
  if (normalisedLinks.length) {
    const { error: linksError } = await supabase.from('freelancer_links').insert(normalisedLinks.map((link) => ({
      user_id: userId,
      platform: link.platform,
      url: link.url,
    })))
    if (linksError) throw linksError
  }
}
