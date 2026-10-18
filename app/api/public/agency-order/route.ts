import { NextRequest, NextResponse } from 'next/server'
import { limitPublicForm, rateLimitResponse } from '@/lib/rateLimit'
import { createLandingPageOrder } from '../../../../lib/agency/createLandingOrder'

function sanitizeText(value: string, max: number): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
}

export async function POST(request: NextRequest) {
  const _rl = await limitPublicForm(request)
  if (!_rl.success) return rateLimitResponse(_rl, 'Too many order attempts. Please wait and try again.')

  const body = await request.json().catch(() => ({}))
  const idempotencyKey =
    request.headers.get('idempotency-key') ||
    (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined)

  const rawAttachments = Array.isArray(body.attachmentUrls) ? body.attachmentUrls : []
  const attachmentUrls = rawAttachments
    .map((u: unknown) => String(u || '').trim())
    .filter((u: string) => /^https:\/\//i.test(u))
    .slice(0, 5)

  const result = await createLandingPageOrder({
    slug: String(body.slug || ''),
    packageId: String(body.packageId || ''),
    customerName: sanitizeText(String(body.customerName || ''), 120),
    customerEmail: String(body.customerEmail || '').trim().toLowerCase().slice(0, 254),
    customerPhone: body.customerPhone ? sanitizeText(String(body.customerPhone), 40) : undefined,
    briefTitle: sanitizeText(String(body.briefTitle || ''), 200),
    briefNotes: sanitizeText(String(body.briefNotes || ''), 4000),
    attachmentUrls,
    idempotencyKey: idempotencyKey ? String(idempotencyKey).slice(0, 80) : undefined,
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
      ATTRIBUTION_FAILED: 500,
      DB_ERROR: 500,
    }
    return NextResponse.json({ error: result.error }, { status: map[result.error] || 400 })
  }

  const amount = 'amount' in result ? result.amount : null
  const currency = 'currency' in result ? result.currency : 'USD'
  const packageName = 'packageName' in result ? result.packageName : null
  const serviceTitle = 'serviceTitle' in result ? result.serviceTitle : null
  const agencyName = 'agencyName' in result ? result.agencyName : null

  return NextResponse.json({
    success: true,
    projectId: result.projectId,
    amount,
    currency,
    packageName,
    serviceTitle,
    agencyName,
    paymentStatus: 'PAYMENT_PENDING',
    duplicate: 'duplicate' in result ? Boolean(result.duplicate) : false,
    spaceremitPublicKey: process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || null,
    paymentsConfigured: Boolean(process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY),
  })
}
