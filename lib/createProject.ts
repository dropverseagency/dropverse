'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { computeSellerProfit, billingIntervalFor, type ProjectDraft } from './projectConfig'

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
    return { error: 'NOT_AUTHENTICATED' }
  }

  // --- Server-side computation (no hardcoded client values) ---
  const clientPrice = Math.round(Number(draft.clientPrice || 0) * 100) / 100
  const fulfillmentCost = Math.round(Number(draft.fulfillmentCost || 0) * 100) / 100

  if (!(clientPrice > 0)) {
    return { error: 'INVALID_PRICE' }
  }
  if (!(fulfillmentCost > 0) || fulfillmentCost >= clientPrice) {
    return { error: 'INVALID_COST' }
  }

  const sellerProfit = computeSellerProfit(clientPrice, fulfillmentCost)
  const billingInterval = billingIntervalFor(draft.projectType)

  const { error: insertError } = await supabase.from('projects').insert({
    user_id: user.id,
    title: String(draft.title || '').trim(),
    description: String(draft.description || '').trim(),
    project_type: draft.projectType,
    billing_interval: billingInterval,
    currency: 'USD',
    client_price: clientPrice,
    fulfillment_cost: fulfillmentCost,
    seller_profit: sellerProfit,
    payment_method: draft.paymentMethod,
    payment_status: 'PAYMENT_PENDING',
    status: 'DRAFT',
    current_billing_period: 1,
    delivery_notes: String(draft.deliveryNotes || '').trim(),
    client_contact_email: draft.clientContactEmail?.trim() || null,
  })

  if (insertError) {
    console.error('createProjectServer insert error:', insertError.message)
    return { error: 'DB_ERROR' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
