import { createClient } from './supabase'
export async function saveFreelancerDetails(userId: string, displayName: string, niches: string[], otherNiche: string, links: string[]) {
  const supabase = createClient()
  const { error: profileError } = await supabase.from('freelancer_profiles').upsert({
    user_id: userId, display_name: displayName.trim().slice(0, 80) || 'Freelancer',
    category: niches[0], niches, other_niche: niches.includes('Other') ? otherNiche.trim() : null
  }, { onConflict: 'user_id' })
  if (profileError) throw profileError
  const { error: linksError } = await supabase.from('freelancer_links').insert(links.map(url => ({
    user_id: userId, platform: new URL(url).hostname.slice(0, 80), url: url.trim()
  })))
  if (linksError) throw linksError
}
