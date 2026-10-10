import { NextRequest } from 'next/server'
import { adminClient, adminJson } from '@/lib/adminCore'

const PUBLIC = ['/', '/pricing', '/earn', '/services', '/privacy', '/terms', '/contact', '/samples']

function windowFor(range: string) {
  const now = new Date()
  if (range === 'live') return { since: new Date(now.getTime() - 60 * 60 * 1000), until: now, mode: 'minute' as const }
  if (range === 'today') {
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return { since, until: now, mode: 'hour' as const }
  }
  if (range === 'yesterday') {
    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return { since: new Date(startToday.getTime() - 86400000), until: startToday, mode: 'hour' as const }
  }
  const days = range === '7' ? 7 : range === '90' ? 90 : range === '365' ? 365 : 30
  return { since: new Date(now.getTime() - days * 86400000), until: now, mode: (days > 90 ? 'month' : days > 30 ? 'week' : 'day') as 'month' | 'week' | 'day' }
}

function bucket(date: string, mode: string) {
  const d = new Date(date)
  if (mode === 'minute') return d.toISOString().slice(11, 16)
  if (mode === 'hour') return `${String(d.getUTCHours()).padStart(2, '0')}:00`
  if (mode === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (mode === 'week') {
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7)
    return `W${String(week).padStart(2, '0')}`
  }
  return d.toISOString().slice(5, 10)
}

function series(rows: { at: string; value: number }[], mode: string) {
  const map = new Map<string, number>()
  for (const row of rows) map.set(bucket(row.at, mode), (map.get(bucket(row.at, mode)) ?? 0) + row.value)
  return [...map.entries()].map(([label, value]) => ({ label, value }))
}

export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const range = new URL(request.url).searchParams.get('range') || '30'
    const win = windowFor(range)
    const admin = adminClient()
    const [views, users, projects, payments] = await Promise.all([
      admin.from('page_views').select('path, created_at').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(5000),
      admin.from('profiles').select('created_at').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(5000),
      admin.from('projects').select('created_at').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(5000),
      admin.from('projects').select('client_price, payment_confirmed_at, created_at, payment_status').eq('payment_status', 'PAYMENT_CONFIRMED').gte('created_at', win.since.toISOString()).lt('created_at', win.until.toISOString()).limit(5000),
    ])
    const visits = (views.data ?? []).filter((row) => PUBLIC.some((p) => row.path === p || (p !== '/' && String(row.path || '').startsWith(p + '/'))))
    return {
      range,
      visits: series(visits.map((row) => ({ at: row.created_at, value: 1 })), win.mode),
      users: series((users.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), win.mode),
      projects: series((projects.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), win.mode),
      payments: series((payments.data ?? []).map((row) => ({ at: row.payment_confirmed_at || row.created_at, value: Number(row.client_price || 0) })), win.mode),
    }
  })
}
