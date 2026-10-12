import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { paddleApiBase, paddleCheckoutPayload } from '@/lib/paddle'

export const runtime = 'nodejs'

function paddleErrorMessage(payload: unknown): string {
  const error = (payload as { error?: { code?: string; detail?: string } })?.error
  if (!error) return 'PADDLE_TRANSACTION_FAILED'
  if (error.code === 'transaction_default_checkout_url_not_set') {
    return 'Set Default payment link in Paddle → Checkout → Checkout settings to https://dropverse-nu.vercel.app/pricing then retry.'
  }
  if (error.code === 'transaction_checkout_url_domain_is_not_approved' || /domain that has been approved/i.test(error.detail || '')) {
    return 'Paddle rejected the return URL domain. Set Default payment link in Paddle and clear NEXT_PUBLIC_PADDLE_CHECKOUT_URL if set.'
  }
  return error.detail || error.code || 'PADDLE_TRANSACTION_FAILED'
}

export async function POST(request: Request) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const sampleId = typeof body.sampleId === 'string' ? body.sampleId.trim() : ''
  if (!sampleId) return NextResponse.json({ error: 'SAMPLE_REQUIRED' }, { status: 400 })

  const admin = adminClient()
  const { data: sample, error: sampleError } = await admin
    .from('work_samples')
    .select('id, title, description, price, service_id')
    .eq('id', sampleId)
    .eq('featured', true)
    .maybeSingle()
  if (sampleError || !sample) return NextResponse.json({ error: 'SAMPLE_NOT_FOUND' }, { status: 404 })

  const amount = Number(sample.price)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'SAMPLE_PRICE_NOT_CONFIGURED' }, { status: 422 })
  }

  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await sessionClient()
    const { data } = await session.auth.getUser()
    userId = data.user?.id ?? null
    email = data.user?.email ?? null
  } catch {
    // Public buyers can check out without a DropVerse account.
  }

  const checkout = paddleCheckoutPayload()

  const transactionResponse = await fetch(`${paddleApiBase()}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1',
    },
    body: JSON.stringify({
      collection_mode: 'automatic',
      ...(checkout ? { checkout } : {}),
      items: [{
        quantity: 1,
        price: {
          description: sample.description || `DropVerse service sample: ${sample.title}`,
          name: sample.title,
          product: {
            name: sample.title,
            tax_category: 'saas',
          },
          unit_price: {
            amount: String(Math.round(amount * 100)),
            currency_code: 'USD',
          },
          tax_mode: 'account_setting',
        },
      }],
      custom_data: {
        dropverse_sample_id: sample.id,
        dropverse_user_id: userId,
      },
      ...(email ? { customer: { email } } : {}),
    }),
  })
  const transactionPayload = await transactionResponse.json().catch(() => ({}))
  if (!transactionResponse.ok) {
    console.error('[paddle] transaction creation failed', transactionPayload)
    return NextResponse.json({
      error: paddleErrorMessage(transactionPayload),
      code: (transactionPayload as { error?: { code?: string } })?.error?.code ?? 'PADDLE_TRANSACTION_FAILED',
      detail: transactionPayload,
    }, { status: 502 })
  }

  const transaction = transactionPayload.data
  const { error: orderError } = await admin.from('paddle_orders').insert({
    transaction_id: transaction.id,
    sample_id: sample.id,
    user_id: userId,
    status: transaction.status || 'draft',
    amount,
    currency_code: 'USD',
    customer_email: email,
    metadata: { source: 'sample_card', sample_title: sample.title },
  })
  if (orderError) {
    console.error('[paddle] order log failed', orderError)
    return NextResponse.json({ error: 'ORDER_LOG_FAILED' }, { status: 500 })
  }

  return NextResponse.json({
    transactionId: transaction.id,
    checkoutUrl: transaction.checkout?.url ?? null,
  })
}
