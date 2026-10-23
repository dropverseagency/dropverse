import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'
import { leadCommissionRateForPrice, remainingSeats, splitCommission } from '@/lib/leads/types'
import { createWhopPlan, createWhopCheckout } from '@/lib/whop'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await requireUser()
    const body = await request.json().catch(() => ({})) as { packId?: string; acceptedTerms?: boolean; termsVersion?: string }
    const packId = String(body.packId || '').trim()
    if (!packId) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    if (body.acceptedTerms !== true || body.termsVersion !== '2026-10-23') {
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: pack, error: packError } = await admin.from('lead_packs')
      .select('id,seller_id,title,price_usd,max_buyers,admin_max_buyers,sold_count,status,currency')
      .eq('id', packId).single()
    if (packError || !pack) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (pack.status !== 'approved') return NextResponse.json({ error: 'NOT_FOR_SALE' }, { status: 409 })
    if (pack.seller_id === userId) return NextResponse.json({ error: 'CANNOT_BUY_OWN' }, { status: 403 })
    if (remainingSeats(Number(pack.max_buyers), pack.admin_max_buyers as number | null, Number(pack.sold_count)) <= 0) {
      return NextResponse.json({ error: 'SOLD_OUT' }, { status: 409 })
    }

    const { error: consentError } = await admin.from('audit_logs').insert({
      actor_id: userId, actor_email: email, action: 'checkout_terms_accepted', entity: 'lead_pack',
      entity_id: packId, new_value: {
        accepted: true, terms_version: '2026-10-23', refund_policy_version: '2026-10-23',
        accepted_at: new Date().toISOString(),
        ip: (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 80) || null,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
        method: 'explicit_checkbox_before_checkout',
      },
    })
    if (consentError) return NextResponse.json({ error: 'TERMS_ACCEPTANCE_COULD_NOT_BE_RECORDED' }, { status: 503 })

    const { data: existing } = await admin.from('lead_pack_purchases')
      .select('id,status,price_usd').eq('pack_id', packId).eq('buyer_id', userId).maybeSingle()
    if (existing?.status === 'paid') return NextResponse.json({ error: 'ALREADY_PURCHASED' }, { status: 409 })

    const amount = Math.round(Number(existing?.price_usd ?? pack.price_usd) * 100) / 100
    const rate = leadCommissionRateForPrice(amount)
    const { platformFee, sellerNet } = splitCommission(amount, rate)
    let purchaseId = existing?.id as string | undefined
    if (existing?.status === 'pending_payment') {
      const { error } = await admin.from('lead_pack_purchases').update({
        commission_rate: rate, platform_fee_usd: platformFee, seller_net_usd: sellerNet, payment_provider: 'WHOP',
      }).eq('id', existing.id).eq('status', 'pending_payment')
      if (error) return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
    } else {
      const { data: purchase, error } = await admin.from('lead_pack_purchases').insert({
        pack_id: packId, buyer_id: userId, price_usd: amount, commission_rate: rate,
        platform_fee_usd: platformFee, seller_net_usd: sellerNet, status: 'pending_payment',
        payment_provider: 'WHOP', idempotency_key: `whop-${packId}-${userId}-${randomUUID()}`,
      }).select('id').single()
      if (error || !purchase) return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
      purchaseId = purchase.id
    }

    const { data: priorSession } = await admin.from('whop_checkout_sessions')
      .select('id,checkout_id,expected_amount')
      .eq('target_type', 'lead_pack').eq('target_id', purchaseId).eq('user_id', userId)
      .eq('status', 'pending').not('checkout_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (priorSession?.checkout_id && Math.abs(Number(priorSession.expected_amount) - amount) < 0.01) {
      return NextResponse.json({ ok: true, purchaseId, sessionId: priorSession.checkout_id, amount, currency: 'USD' })
    }

    const { planId } = await createWhopPlan({
      productId: process.env.WHOP_LEAD_PACK_PRODUCT_ID || '',
      title: `DV Lead ${pack.id.slice(0, 8)}`,
      amount,
      planType: 'one_time',
    })
    const { data: session, error: sessionError } = await admin.from('whop_checkout_sessions').insert({
      plan_id: planId, target_type: 'lead_pack', target_id: purchaseId, user_id: userId,
      expected_amount: amount, currency: 'USD', status: 'pending',
    }).select('id').single()
    if (sessionError || !session) return NextResponse.json({ error: 'CHECKOUT_SESSION_FAILED' }, { status: 500 })
    const { sessionId } = await createWhopCheckout(planId, session.id)
    const { error: checkoutIdError } = await admin.from('whop_checkout_sessions')
      .update({ checkout_id: sessionId }).eq('id', session.id)
    if (checkoutIdError) return NextResponse.json({ error: 'CHECKOUT_SESSION_FAILED' }, { status: 500 })

    await audit({ actorId: userId, actorEmail: email, action: 'lead_checkout_started', entity: 'lead_pack_purchase', entityId: purchaseId, newValue: { packId, amount, provider: 'WHOP' } })
    return NextResponse.json({ ok: true, purchaseId, sessionId, amount, currency: 'USD' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'INTERNAL'
    if (message === 'NOT_AUTHENTICATED') return NextResponse.json({ error: message }, { status: 401 })
    if (message === 'WHOP_NOT_CONFIGURED' || message === 'WHOP_PRODUCT_NOT_CONFIGURED') return NextResponse.json({ error: message }, { status: 503 })
    console.error('[whop] lead pack checkout failed', message)
    return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
  }
}
