import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/leads/auth'
import { isFreelancerProfile } from '@/lib/samples'
import { createServiceClient } from '@/lib/supabaseService'

export async function POST() {
  try {
    const { userId } = await requireUser()
    const admin = createServiceClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('user_type,user_types')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) return NextResponse.json({ error: 'PROFILE_LOOKUP_FAILED' }, { status: 500 })
    if (!isFreelancerProfile(profile)) {
      return NextResponse.json({ error: 'FREELANCER_ONLY' }, { status: 403 })
    }

    const { error } = await admin
      .from('freelancer_verifications')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (error) {
      console.error('[freelancer verification init]', error.message)
      return NextResponse.json({ error: 'VERIFICATION_INIT_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[freelancer verification init]', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
