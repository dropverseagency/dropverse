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

  // Live DB may only allow the original four payment_method values.
  // International (Paddle) is stored as CLIENT_PAYS_DROPVERSE + payment_provider=PADDLE
  // when a strict check constraint rejects 'PADDLE'.
  const requestedMethod = draft.paymentMethod
  const storedMethod =
    requestedMethod === 'PADDLE' ? 'CLIENT_PAYS_DROPVERSE' : requestedMethod
  const paymentProvider =
    requestedMethod === 'PADDLE'
      ? 'PADDLE'
      : requestedMethod === 'SPACEREMIT'
        ? 'SPACEREMIT'
        : null

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

  // Retry with explicit PADDLE as payment_method if preferred by a newer schema.
  if (insertError && requestedMethod === 'PADDLE') {
    const res = await supabase
      .from('projects')
      .insert({ ...baseRow, payment_method: 'PADDLE' })
      .select('id')
      .single()
    if (!res.error && res.data) {
      data = res.data
      insertError = null
    }
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
