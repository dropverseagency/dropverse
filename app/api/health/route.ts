import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { reportOpsError } from '@/lib/opsAlerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET() {
  const startedAt = Date.now()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[health] required server configuration is unavailable')
    return NextResponse.json(
      { status: 'error', checks: { database: 'unavailable' }, timestamp: new Date().toISOString() },
      { status: 503, headers: responseHeaders },
    )
  }

  const admin = createServiceClient()
  try {
    const { error } = await admin
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) throw error

    return NextResponse.json(
      {
        status: 'ok',
        checks: { database: 'ok' },
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: responseHeaders },
    )
  } catch (error) {
    console.error(
      '[health] database check failed',
      error instanceof Error ? error.message.slice(0, 180) : 'unknown',
    )
    await reportOpsError(admin, error, {
      source: 'health-check',
      path: '/api/health',
      method: 'GET',
      route: '/api/health',
      routeType: 'health',
    })

    return NextResponse.json(
      { status: 'degraded', checks: { database: 'error' }, timestamp: new Date().toISOString() },
      { status: 503, headers: responseHeaders },
    )
  }
}
