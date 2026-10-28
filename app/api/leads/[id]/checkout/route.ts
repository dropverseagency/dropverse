import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'

export const runtime = 'nodejs'

/** POST /api/leads/[id]/checkout — reserve a seat and create/reuse a pending purchase atomically. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, email } = await requireUser()
    const { id: packId } = await ctx.params
    if (!packId) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as {
      idempotencyKey?: string
      acceptedTerms?: boolean
      termsVersion?: string
    }
    if (body.acceptedTerms !== true || body.termsVersion !== '2026-10-28') {
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
    }

    const admin = adminClient()
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const ip = forwardedFor.split(',')[0]?.trim().slice(0, 80) || request.headers.get('x-real-ip') || null
    const { error: acceptanceError } = await admin.from('audit_logs').insert({
      actor_id: userId,
      actor_email: email,
      action: 'checkout_terms_accepted',
      entity: 'lead_pack',
      entity_id: packId,
      new_value: {
        accepted: true,
        terms_version: '2026-10-28',
        refund_policy_version: '2026-10-28',
        accepted_at: new Date().toISOString(),
        ip,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
        method: 'explicit_checkbox_before_checkout',
      },
    })
    if (acceptanceError) {
      console.error('[leads checkout] terms acceptance audit failed', acceptanceError.message)
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_COULD_NOT_BE_RECORDED' }, { status: 503 })
    }

    const requestedKey = String(body.idempotencyKey || '').trim()
    if (requestedKey.length > 120) return NextResponse.json({ error: 'INVALID_IDEMPOTENCY_KEY' }, { status: 400 })
    const idempotencyKey = requestedKey || `lp-${packId}-${userId}-${randomBytes(8).toString('hex')}`

    const { data, error } = await admin.rpc('create_lead_pack_purchase_atomic', {
      p_pack_id: packId,
      p_buyer_id: userId,
      p_idempotency_key: idempotencyKey,
    })

    if (error || !data || typeof data !== 'object') {
      const reason = error?.message || 'CHECKOUT_FAILED'
      if (reason.includes('NOT_FOUND')) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      if (reason.includes('NOT_FOR_SALE')) return NextResponse.json({ error: 'NOT_FOR_SALE' }, { status: 409 })
      if (reason.includes('CANNOT_BUY_OWN')) return NextResponse.json({ error: 'CANNOT_BUY_OWN' }, { status: 403 })
      if (reason.includes('ALREADY_PURCHASED')) return NextResponse.json({ error: 'ALREADY_PURCHASED' }, { status: 409 })
      if (reason.includes('SOLD_OUT')) return NextResponse.json({ error: 'SOLD_OUT' }, { status: 409 })
      if (reason.includes('INVALID_LEAD_PRICE')) return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
      console.error('[leads] atomic checkout failed', reason)
      return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
    }

    const purchase = data as {
      purchaseId?: string
      amount?: number | string
      currency?: string
      idempotencyKey?: string
      expiresAt?: string | null
      alreadyPending?: boolean
    }
    if (!purchase.purchaseId) {
      console.error('[leads] atomic checkout returned no purchase id')
      return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_checkout_started',
      entity: 'lead_pack_purchase',
      entityId: purchase.purchaseId,
      newValue: {
        packId,
        amount: Number(purchase.amount),
        commissionRate: 0.2,
        expiresAt: purchase.expiresAt ?? null,
        alreadyPending: purchase.alreadyPending === true,
      },
    })

    return NextResponse.json({
      ok: true,
      purchaseId: purchase.purchaseId,
      amount: Number(purchase.amount),
      currency: purchase.currency || 'USD',
      idempotencyKey: purchase.idempotencyKey || idempotencyKey,
      expiresAt: purchase.expiresAt ?? null,
      spaceremitPublicKey: process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || '',
    })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[leads] checkout', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
