import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'
import { paddleApiBase, paddleCheckoutPayload } from '@/lib/paddle'

export const runtime = 'nodejs'

function paddleErrorMessage(payload: unknown): string {
  const error = (payload as { error?: { code?: string; detail?: string } })?.error
  if (!error) return 'PADDLE_TRANSACTION_FAILED'
  if (error.code === 'transaction_default_checkout_url_not_set') {
    return 'Set Default payment link in Paddle → Checkout settings, then retry.'
  }
  if (error.code === 'transaction_checkout_url_domain_is_not_approved' || /domain that has been approved/i.test(error.detail || '')) {
    return 'Paddle rejected the return URL domain. Set Default payment link in Paddle Checkout settings.'
  }
  return error.detail || error.code || 'PADDLE_TRANSACTION_FAILED'
}

/** Public — no auth. Client pays an invoice via International checkout. */
export async function POST(request: Request) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : ''
  if (!invoiceId) return NextResponse.json({ error: 'INVOICE_REQUIRED' }, { status: 400 })

  const admin = adminClient()
  const { data: invoice, error: invError } = await admin
    .from('invoices')
    .select('id, invoice_number, amount, currency, status, client_email, project_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invError || !invoice) return NextResponse.json({ error: 'INVOICE_NOT_FOUND' }, { status: 404 })
  if (invoice.status !== 'PENDING') {
    return NextResponse.json({ error: 'INVOICE_NOT_PAYABLE', status: invoice.status }, { status: 400 })
  }

  const amount = Number(invoice.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 422 })
  }

  const checkout = paddleCheckoutPayload()
  const email = typeof invoice.client_email === 'string' && invoice.client_email.includes('@')
    ? invoice.client_email
    : null

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
          description: `Invoice ${invoice.invoice_number}`,
          name: `DropVerse Invoice ${invoice.invoice_number}`,
          product: {
            name: `Invoice ${invoice.invoice_number}`,
            tax_category: 'saas',
          },
          unit_price: {
            amount: String(Math.round(amount * 100)),
            currency_code: (invoice.currency as string) || 'USD',
          },
          tax_mode: 'account_setting',
        },
      }],
      custom_data: {
        dropverse_invoice_id: invoice.id,
        dropverse_project_id: invoice.project_id,
        dropverse_source: 'public_invoice',
      },
      ...(email ? { customer: { email } } : {}),
    }),
  })
  const transactionPayload = await transactionResponse.json().catch(() => ({}))
  if (!transactionResponse.ok) {
    console.error('[paddle] invoice transaction failed', transactionPayload)
    return NextResponse.json({
      error: paddleErrorMessage(transactionPayload),
      code: (transactionPayload as { error?: { code?: string } })?.error?.code ?? 'PADDLE_TRANSACTION_FAILED',
    }, { status: 502 })
  }

  const transaction = transactionPayload.data
  await admin.from('paddle_orders').insert({
    transaction_id: transaction.id,
    status: transaction.status || 'draft',
    amount,
    currency_code: (invoice.currency as string) || 'USD',
    customer_email: email,
    metadata: {
      source: 'public_invoice',
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      invoice_number: invoice.invoice_number,
    },
  }).then(({ error }) => {
    if (error) console.error('[paddle] invoice order log failed', error)
  })

  return NextResponse.json({
    transactionId: transaction.id,
    checkoutUrl: transaction.checkout?.url ?? null,
    amount,
  })
}
