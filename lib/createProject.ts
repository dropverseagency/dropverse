'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { computeSellerProfit, computeFulfillmentCost, billingIntervalFor, type ProjectDraft } from './projectConfig'
import { adminClient } from './adminCore'
import { projectRevisionColumns, type SampleRevisionRow } from './sampleProjectRevisions'
import { recordFunnelEvent } from './funnel'

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

  const sampleId = String(draft.sampleId || '').trim()
  let sample: SampleRevisionRow | null = null
  if (sampleId) {
    const { data, error: sampleError } = await adminClient()
      .from('samples')
      .select('revision_limit, revision_price_usd, status')
      .eq('id', sampleId)
      .maybeSingle()
    if (!sampleError && data) sample = data
  }
  const revisionTerms = projectRevisionColumns(sampleId, sample)
  if (!revisionTerms.ok) {
    return { error: revisionTerms.error, status: 409 as const }
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
  const storedMethod = requestedMethod
  const paymentProvider = requestedMethod === 'SPACEREMIT' ? 'SPACEREMIT' : null

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
    ...revisionTerms.columns,
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
  await recordFunnelEvent('project_created', { userId:user.id, projectId:data.id, sampleId:sampleId||undefined, amountUsd:clientPrice })
  const { count: priorProjects } = await adminClient().from('projects').select('*',{count:'exact',head:true}).eq('user_id',user.id).neq('id',data.id)
  if ((priorProjects||0)>0) await recordFunnelEvent('repeat_project',{userId:user.id,projectId:data.id,sampleId:sampleId||undefined,amountUsd:clientPrice})
  return {
    success: true as const,
    projectId: data.id as string,
    paymentMethod: storedMethod,
    paymentProvider,
  }
}
