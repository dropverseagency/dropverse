import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'
import { LEAD_COMMISSION_DEFAULT, remainingSeats, splitCommission } from '@/lib/leads/types'

export const runtime = 'nodejs'

/** POST /api/leads/[id]/checkout — create pending purchase for authenticated buyer */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, email } = await requireUser()
    const { id: packId } = await ctx.params
    if (!packId) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as { idempotencyKey?: string }
    const idempotencyKey =
      String(body?.idempotencyKey || '').trim() ||
      `lp-${packId}-${userId}-${randomBytes(8).toString('hex')}`

    const admin = adminClient()

    const { data: pack, error } = await admin
      .from('lead_packs')
      .select('id, seller_id, price_usd, max_buyers, admin_max_buyers, sold_count, status, currency')
      .eq('id', packId)
      .single()

    if (error || !pack) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (pack.status !== 'approved') {
      return NextResponse.json({ error: 'NOT_FOR_SALE' }, { status: 409 })
    }
    if (pack.seller_id === userId) {
      return NextResponse.json({ error: 'CANNOT_BUY_OWN' }, { status: 403 })
    }

    const remaining = remainingSeats(
      Number(pack.max_buyers),
      pack.admin_max_buyers as number | null,
      Number(pack.sold_count),
    )
    if (remaining <= 0) {
      return NextResponse.json({ error: 'SOLD_OUT' }, { status: 409 })
    }

    const { data: existing } = await admin
      .from('lead_pack_purchases')
      .select('id, status, price_usd, idempotency_key')
      .eq('pack_id', packId)
      .eq('buyer_id', userId)
      .maybeSingle()

    if (existing?.status === 'paid') {
      return NextResponse.json({ error: 'ALREADY_PURCHASED', purchaseId: existing.id }, { status: 409 })
    }
    if (existing?.status === 'pending_payment') {
      return NextResponse.json({
        ok: true,
        purchaseId: existing.id,
        amount: Number(existing.price_usd),
        currency: (pack.currency as string) || 'USD',
        idempotencyKey: existing.idempotency_key,
        spaceremitPublicKey: process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || '',
      })
    }

    const { data: cfg } = await admin
      .from('lead_marketplace_config')
      .select('commission_rate')
      .eq('id', 1)
      .maybeSingle()
    const rate = Number(cfg?.commission_rate ?? LEAD_COMMISSION_DEFAULT)
    const price = Math.round(Number(pack.price_usd) * 100) / 100
    const { platformFee, sellerNet } = splitCommission(price, rate)

    const { data: purchase, error: insErr } = await admin
      .from('lead_pack_purchases')
      .insert({
        pack_id: packId,
        buyer_id: userId,
        price_usd: price,
        commission_rate: rate,
        platform_fee_usd: platformFee,
        seller_net_usd: sellerNet,
        status: 'pending_payment',
        idempotency_key: idempotencyKey,
      })
      .select('id, price_usd, idempotency_key')
      .single()

    if (insErr || !purchase) {
      if (insErr?.code === '23505') {
        return NextResponse.json({ error: 'ALREADY_PURCHASED' }, { status: 409 })
      }
      console.error('[leads] checkout insert', insErr?.message)
      return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_checkout_started',
      entity: 'lead_pack_purchase',
      entityId: purchase.id,
      newValue: { packId, price },
    })

    return NextResponse.json({
      ok: true,
      purchaseId: purchase.id,
      amount: Number(purchase.price_usd),
      currency: (pack.currency as string) || 'USD',
      idempotencyKey: purchase.idempotency_key,
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
