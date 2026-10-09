import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const path = String(body?.path || '').slice(0, 180)
  if (!path.startsWith('/') || path.startsWith('/api')) {
    return NextResponse.json({ ok: false })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ ok: false })
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await admin.from('page_views').insert({ path })
  return NextResponse.json({ ok: !error })
}
