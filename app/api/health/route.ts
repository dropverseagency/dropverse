import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness probe — no secrets, Cache-Control: no-store.
 * Returns 200 when core dependencies respond; 503 otherwise.
 */
export async function GET() {
  const time = new Date().toISOString()
  const checks: Record<string, 'ok' | 'error' | 'skip'> = {
    supabase: 'skip',
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    checks.supabase = 'error'
    return NextResponse.json(
      { status: 'degraded', checks, time },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // Trivial connectivity probe — public active categories (RLS allows anon read when active)
    const { error } = await supabase.from('categories').select('id').limit(1)
    checks.supabase = error ? 'error' : 'ok'
  } catch {
    checks.supabase = 'error'
  }

  const healthy = checks.supabase === 'ok'
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks, time },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
