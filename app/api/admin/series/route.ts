import { NextRequest } from 'next/server'
import { adminClient, adminJson } from '@/lib/adminCore'

const PUBLIC = ['/', '/pricing', '/earn', '/services', '/privacy', '/terms', '/contact', '/samples']

function daysFor(range: string) {
  if (range === '7') return 7
  if (range === '90') return 90
  if (range === '365') return 365
  return 30
}

function bucket(date: string, days: number) {
  const d = new Date(date)
  if (days > 90) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (days > 30) {
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7)
    return `W${String(week).padStart(2, '0')}`
  }
  return d.toISOString().slice(5, 10)
}

function series(rows: { at: string; value: number }[], days: number) {
  const map = new Map<string, number>()
  for (const row of rows) map.set(bucket(row.at, days), (map.get(bucket(row.at, days)) ?? 0) + row.value)
  return [...map.entries()].map(([label, value]) => ({ label, value }))
}

export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const range = new URL(request.url).searchParams.get('range') || '30'
    const days = daysFor(range)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const admin = adminClient()
    const [views, users, projects, payments] = await Promise.all([
      admin.from('page_views').select('path, created_at').gte('created_at', since).limit(5000),
      admin.from('profiles').select('created_at').gte('created_at', since).limit(5000),
      admin.from('projects').select('created_at').gte('created_at', since).limit(5000),
      admin.from('projects').select('client_price, payment_confirmed_at, created_at, payment_status').eq('payment_status', 'PAYMENT_CONFIRMED').gte('created_at', since).limit(5000),
    ])
    const visits = (views.data ?? []).filter((row) => PUBLIC.some((p) => row.path === p || (p !== '/' && String(row.path || '').startsWith(p + '/'))))
    return {
      range: days,
      visits: series(visits.map((row) => ({ at: row.created_at, value: 1 })), days),
      users: series((users.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), days),
      projects: series((projects.data ?? []).map((row) => ({ at: row.created_at, value: 1 })), days),
      payments: series((payments.data ?? []).map((row) => ({ at: row.payment_confirmed_at || row.created_at, value: Number(row.client_price || 0) })), days),
    }
  })
}
