'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  computeSellerProfit,
  computeFulfillmentCost,
  billingIntervalFor,
  paymentsEnabled,
  isPaymentMethod,
  type ProjectDraft,
  type PaymentMethod,
} from './projectConfig'

/**
 * Creates a new client project.
 *
 * Server-side rules (never trust the client):
 *  - seller_profit = client_price - fulfillment_cost
 *  - billing_interval derived from project_type
 *  - payment_status is ALWAYS PAYMENT_PENDING on insert (never auto-confirmed)
 *  - new project starts in DRAFT status
 *  - when NEXT_PUBLIC_PAYMENTS_ENABLED is not "true", payment_method is forced to PENDING_MANUAL
 *  - payment_method must be in the DB allow-list; anything else is rejected
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

  // --- Resolve payment_method (server is source of truth) ---
  const requested = draft.paymentMethod
  let paymentMethod: PaymentMethod

  if (!paymentsEnabled()) {
    // Flag off: never call a gateway; ignore client choice entirely.
    paymentMethod = 'PENDING_MANUAL'
  } else if (!isPaymentMethod(requested) || requested === 'PENDING_MANUAL') {
    // PENDING_MANUAL is server-only; clients cannot choose it when payments are on.
    console.error('[createProject] rejected payment_method', {
      code: 'INVALID_PAYMENT_METHOD',
      value: typeof requested === 'string' ? requested.slice(0, 64) : typeof requested,
    })
    return { error: 'INVALID_PAYMENT_METHOD' as const }
  } else {
    paymentMethod = requested
  }

  const row = {
    user_id: user.id,
    title: String(draft.title || '').trim(),
    description: String(draft.description || '').trim(),
    project_type: draft.projectType,
    billing_interval: billingInterval,
    currency: 'USD',
    client_price: clientPrice,
    fulfillment_cost: fulfillmentCost,
    seller_profit: sellerProfit,
    payment_method: paymentMethod,
    payment_status: 'PAYMENT_PENDING' as const,
    spaceremit_payment_id: draft.spaceremitPaymentId?.trim() || null,
    status: 'DRAFT' as const,
    current_billing_period: 1,
    delivery_notes: String(draft.deliveryNotes || '').trim(),
    client_contact_email: draft.clientContactEmail?.trim() || null,
  }

  const { data, error: insertError } = await supabase
    .from('projects')
    .insert(row)
    .select('id')
    .single()

  if (insertError || !data?.id) {
    // Log original insert failure (no PII). This is the real unexplained failure
    // that the old PADDLE retry path was masking.
    console.error('[createProject] insert failed', {
      code: insertError?.code ?? null,
      message: insertError?.message ?? 'insert_failed',
      details: insertError?.details ?? null,
      hint: insertError?.hint ?? null,
      payment_method: paymentMethod,
      project_type: draft.projectType,
      billing_interval: billingInterval,
    })
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
    paymentMethod,
  }
}
