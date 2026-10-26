import { NextRequest, NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

async function requireUserId() {
  const supabase = await sessionClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

/** GET /api/notifications — list current user's notifications */
export async function GET(request: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)))
  const unreadOnly = request.nextUrl.searchParams.get('unread') === '1'

  try {
    const admin = adminClient()
    let q = admin
      .from('user_notifications')
      .select('id, type, title, body, href, entity_type, entity_id, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (unreadOnly) q = q.is('read_at', null)

    const { data, error } = await q
    if (error) {
      if (/does not exist|relation/i.test(error.message || '')) {
        return NextResponse.json({ items: [], unreadCount: 0, available: false })
      }
      console.error('[notifications GET]', error.message)
      return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })
    }

    const { count } = await admin
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)

    return NextResponse.json({
      items: data ?? [],
      unreadCount: count ?? 0,
      available: true,
    })
  } catch (e) {
    console.error('[notifications GET]', e)
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications
 * Body: { ids?: string[], markAll?: boolean }
 * Marks notifications as read for the current user only.
 */
export async function PATCH(request: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  let body: { ids?: unknown; markAll?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const markAll = body.markAll === true
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 100)
    : []

  if (!markAll && ids.length === 0) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  }

  try {
    const admin = adminClient()
    const now = new Date().toISOString()
    let q = admin
      .from('user_notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
    if (!markAll) q = q.in('id', ids)

    const { error } = await q
    if (error) {
      if (/does not exist|relation/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, available: false })
      }
      console.error('[notifications PATCH]', error.message)
      return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notifications PATCH]', e)
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
  }
}
