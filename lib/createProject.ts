'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { computeSellerProfit, computeFulfillmentCost, billingIntervalFor, type ProjectDraft } from './projectConfig'

/**
 * Creates a new client project.
 *
 * Server-side rules (never trust the client):
 *  - seller_profit = client_price - fulfillment_cost
 *  - billing_interval derived from project_type
 *  - payment_status is ALWAYS PAYMENT_PENDING on insert (never auto-confirmed)
 *  - new project starts in DRAFT status
 */
export async function createProjectServer(draft: ProjectDraft) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'NOT_AUTHENTICATED' as const }
  }

  const clientPrice = Math.round(Number(draft.clientPrice || 0) * 100) / 100
  if (!(clientPrice > 0)) {
    return { error: 'INVALID_PRICE' as const }
  }
  const fulfillmentCost = computeFulfillmentCost(draft.projectType, clientPrice)
  const sellerProfit = computeSellerProfit(clientPrice, fulfillmentCost)
  const billingInterval = billingIntervalFor(draft.projectType)

  // payment_method must match DB CHECK + TS PaymentMethod enum.
  // External gateways stay behind NEXT_PUBLIC_PAYMENTS_ENABLED at the UI/API layer.
  const requestedMethod = draft.paymentMethod
  // Keep the existing payment_method DB enum compatible; provider identifies Whop.
  const storedMethod = requestedMethod === 'WHOP' ? 'CLIENT_PAYS_DROPVERSE' : requestedMethod
  const paymentProvider = requestedMethod === 'WHOP' ? 'WHOP' : requestedMethod === 'SPACEREMIT' ? 'SPACEREMIT' : null

  const baseRow: Record<string, unknown> = {
    user_id: user.id,
    title: String(draft.title || '').trim(),
    description: String(draft.description || '').trim(),
    project_type: draft.projectType,
    billing_interval: billingInterval,
    currency: 'USD',
    client_price: clientPrice,
    fulfillment_cost: fulfillmentCost,
    seller_profit: sellerProfit,
    payment_method: storedMethod,
    payment_status: 'PAYMENT_PENDING',
    spaceremit_payment_id: draft.spaceremitPaymentId?.trim() || null,
    status: 'DRAFT',
    current_billing_period: 1,
    delivery_notes: String(draft.deliveryNotes || '').trim(),
    client_contact_email: draft.clientContactEmail?.trim() || null,
  }

  // Prefer writing payment_provider when the column exists.
  const rowWithProvider = paymentProvider
    ? { ...baseRow, payment_provider: paymentProvider }
    : baseRow

  let data: { id: string } | null = null
  let insertError: { message?: string; code?: string; details?: string } | null = null

  {
    const res = await supabase.from('projects').insert(rowWithProvider).select('id').single()
    data = res.data
    insertError = res.error
  }

  // Retry without payment_provider if the column is missing.
  if (insertError && /payment_provider/i.test(insertError.message || '')) {
    const res = await supabase.from('projects').insert(baseRow).select('id').single()
    data = res.data
    insertError = res.error
  }

  if (insertError || !data?.id) {
    console.error('createProjectServer insert error:', insertError?.message, insertError?.code, insertError?.details)
    return {
      error: 'DB_ERROR' as const,
      detail: insertError?.message || 'insert_failed',
      code: insertError?.code || null,
    }
  }

  revalidatePath('/dashboard')
  return {
    success: true as const,
    projectId: data.id as string,
    paymentMethod: storedMethod,
    paymentProvider,
  }
}
