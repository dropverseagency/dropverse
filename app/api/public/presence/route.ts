import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PUBLIC = [/^\/$/, /^\/pricing(?:\/|$)/, /^\/earn(?:\/|$)/, /^\/services(?:\/|$)/, /^\/privacy(?:\/|$)/, /^\/terms(?:\/|$)/, /^\/contact(?:\/|$)/, /^\/samples(?:\/|$)/]
const BOT = /bot|crawl|spider|preview|slurp|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse/i

function cleanPath(value: string) {
  const path = value.split('?')[0].split('#')[0].slice(0, 120)
  if (!path.startsWith('/') || path.includes('..')) return null
  return PUBLIC.some((rule) => rule.test(path)) ? path : null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const path = cleanPath(String(body?.path || ''))
  const agent = request.headers.get('user-agent') || ''
  if (!path || !agent || BOT.test(agent)) return NextResponse.json({ ok: false, skipped: true })

  let visitorId = request.cookies.get('dv_vid')?.value || ''
  if (!/^[a-zA-Z0-9_-]{16,40}$/.test(visitorId)) {
    visitorId = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ ok: false })
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await admin.from('site_presence').upsert({
    visitor_id: visitorId,
    path,
    last_seen: new Date().toISOString(),
  })
  const response = NextResponse.json({ ok: !error, ready: !error })
  response.cookies.set('dv_vid', visitorId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 30 })
  return response
}
