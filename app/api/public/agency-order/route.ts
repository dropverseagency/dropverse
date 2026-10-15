import { NextRequest, NextResponse } from 'next/server'
import { createLandingPageOrder } from '../../../../lib/agency/createLandingOrder'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const idempotencyKey =
    request.headers.get('idempotency-key') ||
    (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined)

  const result = await createLandingPageOrder({
    slug: String(body.slug || ''),
    packageId: String(body.packageId || ''),
    customerName: String(body.customerName || ''),
    customerEmail: String(body.customerEmail || ''),
    customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
    briefTitle: String(body.briefTitle || ''),
    briefNotes: String(body.briefNotes || ''),
    idempotencyKey,
  })

  if ('error' in result && result.error) {
    const map: Record<string, number> = {
      INVALID_INPUT: 400,
      INVALID_NAME: 400,
      INVALID_EMAIL: 400,
      INVALID_TITLE: 400,
      PAGE_NOT_FOUND: 404,
      ORG_INACTIVE: 403,
      PLAN_REQUIRED: 403,
      PACKAGE_NOT_FOUND: 404,
      PACKAGE_NOT_ON_PAGE: 400,
      SERVICE_INACTIVE: 400,
      INVALID_PRICE: 400,
      DB_ERROR: 500,
    }
    return NextResponse.json({ error: result.error }, { status: map[result.error] || 400 })
  }

  return NextResponse.json({
    success: true,
    projectId: result.projectId,
    amount: result.amount,
    currency: result.currency,
    packageName: result.packageName,
    serviceTitle: result.serviceTitle,
    agencyName: result.agencyName,
    paymentStatus: 'PAYMENT_PENDING',
    spaceremitPublicKey: process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || null,
    paymentsConfigured: Boolean(process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY),
  })
}
