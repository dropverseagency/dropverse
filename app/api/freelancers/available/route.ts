import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../lib/supabaseService'

export async function GET() {
  const jar = await cookies()
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name) => jar.get(name)?.value } })
  if (!(await auth.auth.getUser()).data.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const admin = createServiceClient()
  const { data } = await admin.from('freelancer_profiles').select('user_id,display_name,category,bio').order('display_name')
  const ids = (data || []).map((row) => row.user_id)
  const { data: availability } = ids.length ? await admin.from('freelancer_availability').select('*').in('user_id', ids) : { data: [] }
  const byId = new Map((availability || []).map((row) => [row.user_id, row]))
  return NextResponse.json({ freelancers: (data || []).map((row) => ({ ...row, availability: byId.get(row.user_id) || { available: true, capacity: 1 } })).filter((row) => row.availability.available) })
}
