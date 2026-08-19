import { NextRequest, NextResponse } from 'next/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '../../../lib/supabaseService'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Create an organization + owner membership + settings row in one
 * service-role transaction. Client-side direct inserts fail because
 * PostgREST's returning-select is denied by the member-only SELECT policy
 * (the owner isn't a member yet at return time).
 */
export async function POST(req: NextRequest) {
  const hdrs = await headers()
  const bearer = (hdrs.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  let user = null as any
  if (bearer) {
    const supa = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const res = await supa.auth.getUser(bearer)
    user = res.data.user
  } else {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
        },
      },
    )
    const res = await supabase.auth.getUser()
    user = res.data.user
  }
  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }
  const userId = user.id

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'MISSING_BODY' }, { status: 400 })
  }
  const { name, plan, industry, teamSize } = body as {
    name?: string
    plan?: string
    industry?: string
    teamSize?: string
  }
  if (!name?.trim() || !plan || !teamSize) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Ensure the user has no active organization already.
  const { data: memberRows } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
  if (memberRows && memberRows.length > 0) {
    return NextResponse.json({ error: 'ALREADY_MEMBER', organizationId: memberRows[0].organization_id }, { status: 409 })
  }

  // Ensure no duplicate org name for this user.
  let slug = slugify(name)
  let orgId: string | null = null
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        slug: slug + (i === 0 ? '' : '-' + Math.random().toString(36).slice(2, 8)),
        type: 'agency',
        plan,
        owner_id: userId,
        industry: industry ?? 'General Agency',
        team_size: teamSize,
        status: 'active',
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') {
        slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 8)
        continue
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    orgId = (data as { id: string }).id
    break
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Could not create organization' }, { status: 500 })
  }

  const { error: memError } = await supabase.from('organization_members').insert({
    organization_id: orgId,
    user_id: userId,
    role: 'OWNER',
    status: 'active',
    joined_at: new Date().toISOString(),
  })
  if (memError) {
    return NextResponse.json({ error: memError.message }, { status: 400 })
  }

  await supabase.from('organization_settings').upsert(
    { organization_id: orgId },
    { onConflict: 'organization_id' },
  )

  return NextResponse.json({ ok: true, organizationId: orgId })
}
