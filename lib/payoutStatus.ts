/**
 * Payout request status model aligned with production DB constraint:
 * CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))
 *
 * Business meaning:
 * - pending: user requested; awaiting ops review
 * - approved: ops approved; transfer not yet completed
 * - paid: funds sent / marked complete
 * - cancelled: request closed without payment (admin decline / user cancel)
 *
 * "rejected" is intentionally NOT a stored status. Map any legacy client input
 * to cancelled at the API boundary so the DB constraint is never violated.
 *
 * Transition policy (2026-10-22):
 * Reopening (approved→pending or cancelled→pending) is NOT a product requirement.
 * Use a strict forward model so cancelled and paid are terminal. Ops that need a
 * new attempt should create a new payout request rather than reopen a closed one.
 */

export const PAYOUT_REQUEST_STATUSES = ['pending', 'approved', 'paid', 'cancelled'] as const
export type PayoutRequestStatus = (typeof PAYOUT_REQUEST_STATUSES)[number]

/** Statuses an admin may set via set_payout (includes alias "rejected" → cancelled). */
export const ADMIN_PAYOUT_STATUS_INPUTS = [
  'pending',
  'approved',
  'paid',
  'cancelled',
  'rejected', // alias only; never persisted
] as const
export type AdminPayoutStatusInput = (typeof ADMIN_PAYOUT_STATUS_INPUTS)[number]

export function isPayoutRequestStatus(value: string): value is PayoutRequestStatus {
  return (PAYOUT_REQUEST_STATUSES as readonly string[]).includes(value)
}

/** Normalize admin/client input to a persistable status. */
export function normalizePayoutStatusInput(raw: string): PayoutRequestStatus | null {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'rejected') return 'cancelled'
  if (isPayoutRequestStatus(v)) return v
  return null
}

/**
 * Allowed transitions for admin status changes.
 * Same-status is a no-op success (idempotent).
 * paid and cancelled are terminal.
 */
const ALLOWED: Record<PayoutRequestStatus, readonly PayoutRequestStatus[]> = {
  pending: ['pending', 'approved', 'cancelled'],
  approved: ['approved', 'paid', 'cancelled'],
  paid: ['paid'],
  cancelled: ['cancelled'],
}

export function canTransitionPayoutStatus(
  from: PayoutRequestStatus,
  to: PayoutRequestStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export type PayoutStatusDecision =
  | { ok: true; status: PayoutRequestStatus; noop: boolean }
  | { ok: false; error: 'INVALID_STATUS' | 'INVALID_TRANSITION'; message: string }

export function decidePayoutStatusUpdate(
  currentRaw: string,
  requestedRaw: string,
): PayoutStatusDecision {
  if (!isPayoutRequestStatus(currentRaw)) {
    return { ok: false, error: 'INVALID_STATUS', message: `Unknown current status: ${currentRaw}` }
  }
  const next = normalizePayoutStatusInput(requestedRaw)
  if (!next) {
    return {
      ok: false,
      error: 'INVALID_STATUS',
      message:
        'Status must be pending, approved, paid, or cancelled (rejected is accepted as cancelled).',
    }
  }
  if (!canTransitionPayoutStatus(currentRaw, next)) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      message: `Cannot change payout status from ${currentRaw} to ${next}.`,
    }
  }
  return { ok: true, status: next, noop: currentRaw === next }
}
