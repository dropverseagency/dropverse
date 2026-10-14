import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { DODO_API_BASE, dodoConfigured, dodoHeaders, dodoProductConfigured, dodoReturnUrl } from '@/lib/dodo'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!dodoConfigured()) return NextResponse.json({ error: 'DODO_NOT_CONFIGURED' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const sampleId = typeof body.sampleId === 'string' ? body.sampleId.trim() : ''
  if (!sampleId) return NextResponse.json({ error: 'SAMPLE_REQUIRED' }, { status: 400 })

  const admin = adminClient()
  const { data: sample, error } = await admin.from('work_samples').select('id, title, description, price').eq('id', sampleId).eq('featured', true).maybeSingle()
  if (error || !sample) return NextResponse.json({ error: 'SAMPLE_NOT_FOUND' }, { status: 404 })
  const productId = process.env.DODO_SAMPLE_PRODUCT_ID
  if (!dodoProductConfigured(productId)) return NextResponse.json({ error: 'DODO_SAMPLE_PRODUCT_NOT_CONFIGURED' }, { status: 503 })

  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await sessionClient()
    const { data } = await session.auth.getUser()
    userId = data.user?.id ?? null
    email = data.user?.email ?? null
  } catch {}

  const response = await fetch(`${DODO_API_BASE}/checkouts`, {
    method: 'POST',
    headers: dodoHeaders(),
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: email ? { email } : undefined,
      return_url: dodoReturnUrl('/payment/success'),
      cancel_url: dodoReturnUrl('/pricing'),
      metadata: { dropverse_sample_id: sample.id, dropverse_user_id: userId || 'guest' },
      billing_currency: 'USD',
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.checkout_url) {
    console.error('[dodo] sample checkout failed', payload)
    return NextResponse.json({ error: 'DODO_CHECKOUT_FAILED' }, { status: 502 })
  }

  const { error: orderError } = await admin.from('paddle_orders').insert({
    transaction_id: payload.payment_id || payload.session_id,
    sample_id: sample.id,
    user_id: userId,
    status: 'checkout_created',
    amount: Number(sample.price) || 0,
    currency_code: 'USD',
    customer_email: email,
    metadata: { provider: 'dodo', session_id: payload.session_id, sample_title: sample.title },
  })
  if (orderError) console.error('[dodo] order log failed', orderError)
  return NextResponse.json({ checkoutUrl: payload.checkout_url, sessionId: payload.session_id })
}
