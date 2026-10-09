import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function daysFor(range: string) {
  if (range === '7') return 7
  if (range === '90') return 90
  if (range === '365') return 365
  return 30
}
function bucket(date: string, days: number) {
  const d = new Date(date)
  if (days > 90) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (days > 30) return `W${String(Math.ceil(d.getUTCDate() / 7)).padStart(2, '0')}`
  return d.toISOString().slice(5, 10)
}
function series(rows: { at: string; value: number }[], days: number) {
  const map = new Map<string, number>()
  for (const row of rows) map.set(bucket(row.at, days), (map.get(bucket(row.at, days)) ?? 0) + row.value)
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
  const days = daysFor(range)
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const [projects, payments, commissions] = await Promise.all([
    admin.from('projects').select('created_at').eq('user_id', data.user.id).gte('created_at', since).limit(2000),
    admin.from('projects').select('client_price, payment_confirmed_at, created_at').eq('user_id', data.user.id).eq('payment_status', 'PAYMENT_CONFIRMED').gte('created_at', since).limit(2000),
    admin.from('referral_commissions').select('commission_amount, created_at, referral_id').gte('created_at', since).limit(2000),
  ])
  const { data: refs } = await admin.from('referrals').select('id').eq('referrer_id', data.user.id)
  const mine = new Set((refs ?? []).map((row) => row.id))
  const earned = (commissions.data ?? []).filter((row) => mine.has(row.referral_id))
  return NextResponse.json({
    range: days,
    projects: series((projects.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), days),
    payments: series((payments.data ?? []).map((row) => ({ at: row.payment_confirmed_at || row.created_at, value: Number(row.client_price || 0) })), days),
    commissions: series(earned.map((row) => ({ at: row.created_at, value: Number(row.commission_amount || 0) })), days),
  })
}
