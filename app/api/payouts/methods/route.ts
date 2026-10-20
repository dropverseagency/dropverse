import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient, audit, sessionClient } from '@/lib/adminCore'
import { methodById, type PayoutMethodId } from '@/lib/payoutConfig'

async function resolveUser(request: NextRequest) {
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (bearer) {
    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const res = await supa.auth.getUser(bearer)
    return res.data?.user ?? null
  }
  const supabase = await sessionClient()
  const res = await supabase.auth.getUser()
  return res.data?.user ?? null
}

type SavedMethods = {
  preferredMethod: PayoutMethodId | null
  paypalEmail: string | null
  localDetails: string | null
}

function readMeta(user: { user_metadata?: Record<string, unknown> }): SavedMethods {
  const m = user.user_metadata ?? {}
  const preferred =
    typeof m.payout_preferred_method === 'string' && methodById(m.payout_preferred_method)
      ? (m.payout_preferred_method as PayoutMethodId)
      : null
  return {
    preferredMethod: preferred,
    paypalEmail: typeof m.payout_paypal_email === 'string' ? m.payout_paypal_email : null,
    localDetails: typeof m.payout_local_details === 'string' ? m.payout_local_details : null,
  }
}

/**
 * GET /api/payouts/methods
 * Returns the user's saved withdrawal destinations (from auth user_metadata).
 * Works with zero balance — registration only.
 */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, methods: readMeta(user) }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * POST /api/payouts/methods
 * Body: { preferredMethod?: 'paypal'|'local', paypalEmail?: string, localDetails?: string }
 * Saves payout destination details even when the user has $0 available balance.
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    preferredMethod?: unknown
    paypalEmail?: unknown
    localDetails?: unknown
  } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const current = readMeta(user)
  let preferredMethod = current.preferredMethod
  let paypalEmail = current.paypalEmail
  let localDetails = current.localDetails

  if (typeof body.preferredMethod === 'string') {
    const m = methodById(body.preferredMethod)
    if (!m || !m.enabled) {
      return new Response(JSON.stringify({ error: 'INVALID_METHOD' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    preferredMethod = m.id
  }

  if (typeof body.paypalEmail === 'string') {
    const email = body.paypalEmail.trim().slice(0, 200)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_PAYPAL_EMAIL', message: 'Enter a valid PayPal email.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    paypalEmail = email || null
  }

  if (typeof body.localDetails === 'string') {
    localDetails = body.localDetails.trim().slice(0, 500) || null
  }

  const admin = adminClient()
  const { data: updated, error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      payout_preferred_method: preferredMethod,
      payout_paypal_email: paypalEmail,
      payout_local_details: localDetails,
    },
  })

  if (error) {
    console.error('[payouts/methods]', error)
    return new Response(JSON.stringify({ error: 'SAVE_FAILED', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'payout_methods_saved',
    entity: 'user',
    entityId: user.id,
    newValue: {
      preferredMethod,
      paypalEmail: paypalEmail ? '[set]' : null,
      localDetails: localDetails ? '[set]' : null,
    },
  })

  const methods = readMeta(updated?.user ?? user)
  // Prefer what we just wrote in case metadata lag
  const saved: SavedMethods = {
    preferredMethod,
    paypalEmail,
    localDetails,
  }

  return new Response(
    JSON.stringify({
      ok: true,
      methods: saved.preferredMethod || saved.paypalEmail || saved.localDetails ? saved : methods,
      message: 'Payment method details saved. You can request a withdrawal once you have available balance.',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
