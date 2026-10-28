import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../lib/supabaseService'

export async function GET() {
  const jar = await cookies()
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => jar.get(name)?.value } },
  )
  const { data: authData } = await auth.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const admin = createServiceClient()
  const { data: profiles, error: profileError } = await admin
    .from('freelancer_profiles')
    .select('user_id,display_name,category,bio')
    .order('display_name')
  if (profileError) return NextResponse.json({ error: 'FREELANCERS_UNAVAILABLE' }, { status: 500 })

  const ids = (profiles || []).map((row) => row.user_id)
  if (!ids.length) return NextResponse.json({ freelancers: [] })

  const [{ data: availability, error: availabilityError }, { data: verifications, error: verificationError }, { data: activeProjects, error: projectsError }] = await Promise.all([
    admin.from('freelancer_availability').select('user_id,available,capacity,next_available_at,typical_turnaround_days').in('user_id', ids),
    admin.from('freelancer_verifications').select('user_id,identity_status,specialty_status,verified_level').in('user_id', ids),
    admin.from('projects').select('assigned_freelancer_id').in('assigned_freelancer_id', ids).in('operations_status', ['assigned', 'in_progress', 'revision_requested']),
  ])
  if (availabilityError || verificationError || projectsError) {
    return NextResponse.json({ error: 'FREELANCER_OPERATIONS_UNAVAILABLE' }, { status: 500 })
  }

  const availabilityById = new Map((availability || []).map((row) => [row.user_id, row]))
  const verificationById = new Map((verifications || []).map((row) => [row.user_id, row]))
  const activeCounts = new Map<string, number>()
  for (const project of activeProjects || []) {
    if (project.assigned_freelancer_id) {
      activeCounts.set(project.assigned_freelancer_id, (activeCounts.get(project.assigned_freelancer_id) || 0) + 1)
    }
  }

  const freelancers = (profiles || []).filter((row) => {
    const v = verificationById.get(row.user_id)
    const a = availabilityById.get(row.user_id)
    return Boolean(
      v?.identity_status === 'verified' &&
      v?.specialty_status === 'passed' &&
      ['specialist', 'pro'].includes(v?.verified_level || '') &&
      a?.available === true &&
      Number(a.capacity || 0) > (activeCounts.get(row.user_id) || 0),
    )
  }).map((row) => ({
    ...row,
    availability: availabilityById.get(row.user_id),
    verification: verificationById.get(row.user_id),
    active_project_count: activeCounts.get(row.user_id) || 0,
  }))

  return NextResponse.json({ freelancers })
}
