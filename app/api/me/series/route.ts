import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function windowFor(range: string) {
  const now = new Date()
  if (range === 'live') return { since: new Date(now.getTime() - 60 * 60 * 1000), until: now, mode: 'minute' }
  if (range === 'today') {
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return { since, until: now, mode: 'hour' }
  }
  if (range === 'yesterday') {
    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return { since: new Date(startToday.getTime() - 86400000), until: startToday, mode: 'hour' }
  }
  const days = range === '7' ? 7 : range === '90' ? 90 : range === '365' ? 365 : 30
  return { since: new Date(now.getTime() - days * 86400000), until: now, mode: days > 90 ? 'month' : days > 30 ? 'week' : 'day' }
}
function bucket(date: string, mode: string) {
  const d = new Date(date)
  if (mode === 'minute') return d.toISOString().slice(11, 16)
  if (mode === 'hour') return `${String(d.getUTCHours()).padStart(2, '0')}:00`
  if (mode === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (mode === 'week') return `W${String(Math.ceil(d.getUTCDate() / 7)).padStart(2, '0')}`
  return d.toISOString().slice(5, 10)
}
function series(rows: { at: string; value: number }[], mode: string) {
  const map = new Map<string, number>()
  for (const row of rows) map.set(bucket(row.at, mode), (map.get(bucket(row.at, mode)) ?? 0) + row.value)
  return [...map.entries()].map(([label, value]) => ({ label, value }))
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { get: (name: string) => cookieStore.get(name)?.value },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const range = new URL(request.url).searchParams.get('range') || '30'
  const win = windowFor(range)
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const [projects, payments, commissions] = await Promise.all([
    admin.from('projects').select('created_at').eq('user_id', data.user.id).gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(2000),
    admin.from('projects').select('client_price, payment_confirmed_at, created_at').eq('user_id', data.user.id).eq('payment_status', 'PAYMENT_CONFIRMED').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(2000),
    admin.from('referral_commissions').select('commission_amount, created_at, referral_id').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(2000),
  ])
  const { data: refs } = await admin.from('referrals').select('id').eq('referrer_id', data.user.id)
  const mine = new Set((refs ?? []).map((row) => row.id))
  const earned = (commissions.data ?? []).filter((row) => mine.has(row.referral_id))
  return NextResponse.json({
    range,
    projects: series((projects.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), win.mode),
    payments: series((payments.data ?? []).map((row) => ({ at: row.payment_confirmed_at || row.created_at, value: Number(row.client_price || 0) })), win.mode),
    commissions: series(earned.map((row) => ({ at: row.created_at, value: Number(row.commission_amount || 0) })), win.mode),
  })
}
