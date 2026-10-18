/**
 * Server-side order lifecycle. Single place for legal status transitions.
 * Maps product language to existing projects.status values.
 * Fail-open: if order_events table is missing, still updates projects and logs a warning.
 */

import { createServiceClient } from './supabaseService'

export type OrderLifecycle =
  | 'pending_payment'
  | 'confirmed'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'

export type DbProjectStatus =
  | 'DRAFT'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'READY_FOR_FULFILLMENT'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DELIVERED'
  | 'REVISION_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'PAYMENT_FAILED'

const LIFECYCLE_TO_DB: Record<OrderLifecycle, DbProjectStatus> = {
  pending_payment: 'PAYMENT_PENDING',
  confirmed: 'PAYMENT_CONFIRMED',
  in_progress: 'IN_PROGRESS',
  delivered: 'DELIVERED',
  revision_requested: 'REVISION_REQUESTED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  payment_failed: 'PAYMENT_FAILED',
}

export const LIFECYCLE_TRANSITIONS: Record<OrderLifecycle, OrderLifecycle[]> = {
  pending_payment: ['confirmed', 'cancelled', 'payment_failed'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: ['revision_requested', 'completed', 'cancelled'],
  revision_requested: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  payment_failed: ['pending_payment', 'cancelled'],
}

export function dbStatusToLifecycle(status: string | null | undefined): OrderLifecycle | null {
  switch (status) {
    case 'DRAFT':
    case 'PAYMENT_PENDING':
      return 'pending_payment'
    case 'PAYMENT_CONFIRMED':
    case 'READY_FOR_FULFILLMENT':
      return 'confirmed'
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return 'in_progress'
    case 'IN_REVIEW':
    case 'DELIVERED':
      return 'delivered'
    case 'REVISION_REQUESTED':
      return 'revision_requested'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELLED':
      return 'cancelled'
    case 'PAYMENT_FAILED':
    case 'PAST_DUE':
    case 'EXPIRED':
      return 'payment_failed'
    default:
      return null
  }
}

export function canLifecycleTransition(from: OrderLifecycle, to: OrderLifecycle): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false
}

export type TransitionInput = {
  projectId: string
  to: OrderLifecycle
  actorId?: string | null
  actorType?: 'system' | 'user' | 'admin' | 'webhook' | 'cron'
  reason?: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string
  allowNoop?: boolean
}

export type TransitionResult =
  | { ok: true; from: OrderLifecycle | null; to: OrderLifecycle; noop?: boolean }
  | { ok: false; error: string }

function admin() {
  return createServiceClient()
}

export async function transitionOrder(input: TransitionInput): Promise<TransitionResult> {
  const supabase = admin()
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, status, payment_status')
    .eq('id', input.projectId)
    .maybeSingle()

  if (error || !project) {
    return { ok: false, error: 'PROJECT_NOT_FOUND' }
  }

  const from = dbStatusToLifecycle(project.status)
  const to = input.to

  if (from === to) {
    return { ok: true, from, to, noop: true }
  }

  if (!from) {
    return { ok: false, error: 'UNKNOWN_STATUS' }
  }

  if (!canLifecycleTransition(from, to)) {
    return { ok: false, error: 'ILLEGAL_TRANSITION' }
  }

  const dbStatus = LIFECYCLE_TO_DB[to]
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: dbStatus,
    last_activity_at: now,
  }

  if (to === 'confirmed') {
    patch.payment_status = 'PAYMENT_CONFIRMED'
    patch.payment_confirmed_at = now
  }
  if (to === 'pending_payment') {
    patch.payment_status = 'PAYMENT_PENDING'
  }
  if (to === 'payment_failed') {
    patch.payment_status = 'PAYMENT_PENDING'
  }
  if (to === 'delivered') {
    patch.delivered_at = now
  }

  const { error: updErr } = await supabase.from('projects').update(patch).eq('id', input.projectId)
  if (updErr) {
    console.warn('[orderEngine] update failed', updErr.message)
    return { ok: false, error: 'DB_UPDATE_FAILED' }
  }

  try {
    const { error: evErr } = await supabase.from('order_events').insert({
      project_id: input.projectId,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType ?? 'system',
      from_status: from ? LIFECYCLE_TO_DB[from] : project.status,
      to_status: dbStatus,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    if (evErr && evErr.code !== '23505') {
      console.warn('[orderEngine] order_events insert failed (apply migration?)', evErr.message)
    }
  } catch (e) {
    console.warn('[orderEngine] order_events unavailable', e instanceof Error ? e.message : 'error')
  }

  return { ok: true, from, to }
}

export function newTrackingToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
