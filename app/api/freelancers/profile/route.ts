import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/leads/auth'
import { isFreelancerProfile } from '@/lib/samples'
import { createServiceClient } from '@/lib/supabaseService'

async function context() {
  const { userId } = await requireUser()
  const admin = createServiceClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('user_type,user_types')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error('PROFILE_LOOKUP_FAILED')
  if (!isFreelancerProfile(profile)) throw new Error('FREELANCER_ONLY')
  return { userId, admin }
}

export async function GET() {
  try {
    const { userId, admin } = await context()
    const [{ data: profile, error: profileError }, { data: availability, error: availabilityError }, { data: verification, error: verificationError }] = await Promise.all([
      admin.from('freelancer_profiles').select('user_id,display_name,category,niches,other_niche,bio,created_at,updated_at').eq('user_id', userId).maybeSingle(),
      admin.from('freelancer_availability').select('available,capacity,next_available_at,typical_turnaround_days,updated_at').eq('user_id', userId).maybeSingle(),
      admin.from('freelancer_verifications').select('identity_status,specialty_status,verified_level,specialty_review_note,reviewed_at').eq('user_id', userId).maybeSingle(),
    ])
    if (profileError || availabilityError || verificationError) {
      return NextResponse.json({ error: 'FREELANCER_PROFILE_UNAVAILABLE' }, { status: 500 })
    }
    return NextResponse.json({
      profile: profile ?? null,
      availability: availability ?? { available: false, capacity: 1, typical_turnaround_days: 3 },
      verification: verification ?? { identity_status: 'unsubmitted', specialty_status: 'unreviewed', verified_level: 'none' },
    })
  } catch (error) {
    const code = (error as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[freelancer profile GET]', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}

function normalisePortfolioLink(raw: unknown): { platform: string; url: string } | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null
    const host = url.hostname.toLowerCase()
    const platform = host === 'behance.net' || host.endsWith('.behance.net')
      ? 'behance'
      : host === 'dribbble.com' || host.endsWith('.dribbble.com')
        ? 'dribbble'
        : host === 'upwork.com' || host.endsWith('.upwork.com')
          ? 'upwork'
          : 'other'
    return { platform, url: url.toString() }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, admin } = await context()
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const displayName = String(body.displayName || '').trim().slice(0, 80)
    const niches = Array.isArray(body.niches)
      ? [...new Set(body.niches.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
      : []
    const otherNiche = String(body.otherNiche || '').trim().slice(0, 100)
    const rawLinks = Array.isArray(body.links) ? body.links : []
    const links = rawLinks.map(normalisePortfolioLink)

    if (displayName.length < 2 || niches.length < 1 || niches.length > 50 || (niches.includes('Other') && !otherNiche)) {
      return NextResponse.json({ error: 'INVALID_PROFILE' }, { status: 400 })
    }
    if (rawLinks.length < 1 || rawLinks.length > 5 || links.some((link) => link === null)) {
      return NextResponse.json({ error: 'INVALID_PORTFOLIO_LINKS' }, { status: 400 })
    }

    const { error: profileError } = await admin.from('freelancer_profiles').upsert({
      user_id: userId,
      display_name: displayName,
      category: niches[0],
      niches,
      other_niche: niches.includes('Other') ? otherNiche : null,
    }, { onConflict: 'user_id' })
    if (profileError) {
      console.error('[freelancer profile POST]', profileError.message)
      return NextResponse.json({ error: 'PROFILE_SAVE_FAILED' }, { status: 400 })
    }

    const { error: availabilityError } = await admin.from('freelancer_availability').upsert({
      user_id: userId,
      available: true,
      capacity: 1,
      typical_turnaround_days: 3,
    }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (availabilityError) return NextResponse.json({ error: 'AVAILABILITY_INIT_FAILED' }, { status: 500 })

    const { error: verificationError } = await admin.from('freelancer_verifications').upsert({
      user_id: userId,
    }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (verificationError) return NextResponse.json({ error: 'VERIFICATION_INIT_FAILED' }, { status: 500 })

    const { error: deleteLinksError } = await admin.from('freelancer_links').delete().eq('user_id', userId)
    if (deleteLinksError) return NextResponse.json({ error: 'PORTFOLIO_LINKS_SAVE_FAILED' }, { status: 500 })
    const validLinks = links as { platform: string; url: string }[]
    const { error: linksError } = await admin.from('freelancer_links').insert(validLinks.map((link) => ({
      user_id: userId,
      platform: link.platform,
      url: link.url,
    })))
    if (linksError) return NextResponse.json({ error: 'PORTFOLIO_LINKS_SAVE_FAILED' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[freelancer profile POST]', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, admin } = await context()
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const available = body.available
    const capacity = Number(body.capacity)
    const turnaround = Number(body.typicalTurnaroundDays)
    if (typeof available !== 'boolean' || !Number.isInteger(capacity) || capacity < 0 || capacity > 50) {
      return NextResponse.json({ error: 'INVALID_AVAILABILITY' }, { status: 400 })
    }
    if (available && capacity < 1) {
      return NextResponse.json({ error: 'AVAILABLE_REQUIRES_CAPACITY' }, { status: 400 })
    }
    if (!Number.isInteger(turnaround) || turnaround < 1 || turnaround > 90) {
      return NextResponse.json({ error: 'INVALID_TURNAROUND' }, { status: 400 })
    }

    const { error } = await admin.from('freelancer_availability').upsert({
      user_id: userId,
      available,
      capacity,
      typical_turnaround_days: turnaround,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) {
      console.error('[freelancer profile PATCH]', error.message)
      return NextResponse.json({ error: 'AVAILABILITY_SAVE_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[freelancer profile PATCH]', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
