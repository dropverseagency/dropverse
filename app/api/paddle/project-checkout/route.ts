import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { paddleApiBase, paddleCheckoutPayload } from '@/lib/paddle'

export const runtime = 'nodejs'

function paddleErrorMessage(payload: unknown): string {
  const error = (payload as { error?: { code?: string; detail?: string } })?.error
  if (!error) return 'PADDLE_TRANSACTION_FAILED'
  if (error.code === 'transaction_default_checkout_url_not_set') {
    return 'Set Default payment link in Paddle → Checkout → Checkout settings to https://dropverse-nu.vercel.app/dashboard then retry.'
  }
  if (error.code === 'transaction_checkout_url_domain_is_not_approved' || /domain that has been approved/i.test(error.detail || '')) {
    return 'Paddle rejected the return URL domain. Leave checkout.url empty (code default) and set Default payment link in Paddle, or approve the domain under Website approval.'
  }
  return error.detail || error.code || 'PADDLE_TRANSACTION_FAILED'
}

export async function POST(request: Request) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  if (!projectId) return NextResponse.json({ error: 'PROJECT_REQUIRED' }, { status: 400 })

  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await sessionClient()
    const { data } = await session.auth.getUser()
    userId = data.user?.id ?? null
    email = data.user?.email ?? null
  } catch {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }
  if (!userId) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const admin = adminClient()
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, title, client_price, fulfillment_cost, payment_method, user_id, payment_status')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (projectError || !project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  if (project.payment_status === 'PAYMENT_CONFIRMED') {
    return NextResponse.json({ error: 'ALREADY_CONFIRMED' }, { status: 409 })
  }

  const chargeFulfillmentOnly = project.payment_method === 'SELLER_COLLECTED'
  const amount = Number(chargeFulfillmentOnly ? project.fulfillment_cost : project.client_price)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 422 })
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
          description: `DropVerse project: ${project.title}`,
          name: project.title,
          product: {
            name: project.title,
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
        dropverse_project_id: project.id,
        dropverse_user_id: userId,
        dropverse_source: 'create_project',
      },
      ...(email ? { customer: { email } } : {}),
    }),
  })
  const transactionPayload = await transactionResponse.json().catch(() => ({}))
  if (!transactionResponse.ok) {
    console.error('[paddle] project transaction failed', transactionPayload)
    return NextResponse.json({
      error: paddleErrorMessage(transactionPayload),
      code: (transactionPayload as { error?: { code?: string } })?.error?.code ?? 'PADDLE_TRANSACTION_FAILED',
    }, { status: 502 })
  }

  const transaction = transactionPayload.data
  await admin.from('paddle_orders').insert({
    transaction_id: transaction.id,
    user_id: userId,
    status: transaction.status || 'draft',
    amount,
    currency_code: 'USD',
    customer_email: email,
    metadata: {
      source: 'create_project',
      project_id: project.id,
      project_title: project.title,
    },
  }).then(({ error }) => {
    if (error) console.error('[paddle] project order log failed', error)
  })

  return NextResponse.json({
    transactionId: transaction.id,
    checkoutUrl: transaction.checkout?.url ?? null,
    amount,
  })
}
