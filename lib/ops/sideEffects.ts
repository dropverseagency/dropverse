/**
 * Fire-and-forget side effects after payment/order events.
 * NEVER throw to the caller. Payment paths must use void runAfterPaymentConfirmed(...).
 */

import { enqueueEmail } from './email'
import { sendAdminAlert } from './telegram'
import { transitionOrder, newTrackingToken, type OrderLifecycle } from '../orderEngine'
import { createServiceClient } from '../supabaseService'

function admin() {
  return createServiceClient()
}

export async function ensureTrackingToken(projectId: string): Promise<string | null> {
  try {
    const supabase = admin()
    const { data } = await supabase
      .from('projects')
      .select('tracking_token')
      .eq('id', projectId)
      .maybeSingle()
    if (data?.tracking_token) return data.tracking_token
    const token = newTrackingToken()
    const { error } = await supabase.from('projects').update({ tracking_token: token }).eq('id', projectId)
    if (error) {
      console.warn('[sideEffects] tracking_token update failed', error.message)
      return null
    }
    return token
  } catch (e) {
    console.warn('[sideEffects] ensureTrackingToken', e instanceof Error ? e.message : 'error')
    return null
  }
}

export type AfterPaymentInput = {
  projectId: string
  paymentId?: string
  actorId?: string | null
  actorType?: 'user' | 'webhook' | 'system' | 'admin'
  customerEmail?: string | null
  source: 'spaceremit_verify' | 'spaceremit_callback' | 'agency_confirm' | 'invoice_pay'
}

export async function runAfterPaymentConfirmed(input: AfterPaymentInput): Promise<void> {
  try {
    await transitionOrder({
      projectId: input.projectId,
      to: 'confirmed',
      actorId: input.actorId,
      actorType: input.actorType ?? 'system',
      reason: input.source,
      metadata: { payment_id: input.paymentId, source: input.source },
      idempotencyKey: `pay:confirm:${input.projectId}:${input.paymentId || 'unknown'}`,
      allowNoop: true,
    })
  } catch (e) {
    console.warn('[sideEffects] transitionOrder', e instanceof Error ? e.message : 'error')
  }

  try {
    await ensureTrackingToken(input.projectId)
  } catch (e) {
    console.warn('[sideEffects] token', e instanceof Error ? e.message : 'error')
  }

  try {
    await sendAdminAlert({
      key: `pay_ok:${input.projectId}`,
      text: `Payment confirmed (${input.source}) project=${input.projectId}`,
      dedupeSeconds: 86400,
    })
  } catch (e) {
    console.warn('[sideEffects] telegram', e instanceof Error ? e.message : 'error')
  }

  if (input.customerEmail) {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL || ''
      const token = await ensureTrackingToken(input.projectId)
      await enqueueEmail({
        to: input.customerEmail,
        template: 'payment_confirmed',
        subject: 'Payment confirmed — DropVerse',
        projectId: input.projectId,
        idempotencyKey: `email:pay_ok:${input.projectId}`,
        payload: {
          title: 'Payment confirmed',
          body: 'We received your payment and your order is moving forward.',
          trackUrl: token && site ? `${site}/track/${token}` : undefined,
        },
      })
    } catch (e) {
      console.warn('[sideEffects] email', e instanceof Error ? e.message : 'error')
    }
  }
}

export async function runAfterOrderCreated(input: {
  projectId: string
  customerEmail?: string | null
  title?: string
}): Promise<void> {
  try {
    await ensureTrackingToken(input.projectId)
  } catch (e) {
    console.warn('[sideEffects] create token', e instanceof Error ? e.message : 'error')
  }
  try {
    await sendAdminAlert({
      key: `order_new:${input.projectId}`,
      text: `New order ${input.projectId}${input.title ? `: ${input.title}` : ''}`,
      dedupeSeconds: 60,
    })
  } catch (e) {
    console.warn('[sideEffects] new order alert', e instanceof Error ? e.message : 'error')
  }
  if (input.customerEmail) {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL || ''
      const token = await ensureTrackingToken(input.projectId)
      await enqueueEmail({
        to: input.customerEmail,
        template: 'order_received',
        subject: 'Order received — DropVerse',
        projectId: input.projectId,
        idempotencyKey: `email:order_new:${input.projectId}`,
        payload: {
          title: 'Order received',
          body: 'We received your order. Complete payment if still pending, then track progress from your link.',
          trackUrl: token && site ? `${site}/track/${token}` : undefined,
        },
      })
    } catch (e) {
      console.warn('[sideEffects] order email', e instanceof Error ? e.message : 'error')
    }
  }
}

export async function runAfterLifecycleEmail(input: {
  projectId: string
  to: OrderLifecycle
  customerEmail?: string | null
}): Promise<void> {
  if (!input.customerEmail) return
  const map: Partial<
    Record<
      OrderLifecycle,
      { template: 'delivered' | 'revision_requested' | 'completed' | 'in_progress'; subject: string; body: string }
    >
  > = {
    delivered: {
      template: 'delivered',
      subject: 'Your order was delivered — DropVerse',
      body: 'Your order has been marked as delivered. You can approve or request a revision from the tracking page.',
    },
    revision_requested: {
      template: 'revision_requested',
      subject: 'Revision requested — DropVerse',
      body: 'A revision was requested. The team will continue work on your order.',
    },
    completed: {
      template: 'completed',
      subject: 'Order completed — DropVerse',
      body: 'Your order is complete. Thank you for working with DropVerse.',
    },
    in_progress: {
      template: 'in_progress',
      subject: 'Order in progress — DropVerse',
      body: 'Work on your order is in progress.',
    },
  }
  const cfg = map[input.to]
  if (!cfg) return
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || ''
    const token = await ensureTrackingToken(input.projectId)
    await enqueueEmail({
      to: input.customerEmail,
      template: cfg.template,
      subject: cfg.subject,
      projectId: input.projectId,
      idempotencyKey: `email:${input.to}:${input.projectId}`,
      payload: {
        title: cfg.subject,
        body: cfg.body,
        trackUrl: token && site ? `${site}/track/${token}` : undefined,
      },
    })
  } catch (e) {
    console.warn('[sideEffects] lifecycle email', e instanceof Error ? e.message : 'error')
  }
}
