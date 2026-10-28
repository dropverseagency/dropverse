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
