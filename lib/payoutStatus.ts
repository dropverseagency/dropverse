/**
 * Payout request status model aligned with production DB constraint:
 * CHECK (status = ANY (ARRAY['pending','approved','paid','cancelled']))
 *
 * "rejected" is intentionally not a DB status. Admin UIs should use cancelled.
 */

export const PAYOUT_REQUEST_STATUSES = [
  'pending',
  'approved',
  'paid',
  'cancelled',
] as const

export type PayoutRequestStatus = (typeof PAYOUT_REQUEST_STATUSES)[number]

export function isAllowedPayoutStatus(status: string): status is PayoutRequestStatus {
  return (PAYOUT_REQUEST_STATUSES as readonly string[]).includes(status)
}

/**
 * Allowed transitions for admin status management.
 * Terminal: paid, cancelled.
 */
const ALLOWED_TRANSITIONS: Record<PayoutRequestStatus, readonly PayoutRequestStatus[]> = {
  pending: ['approved', 'cancelled', 'pending'],
  approved: ['paid', 'cancelled', 'approved', 'pending'],
  paid: ['paid'],
  cancelled: ['cancelled'],
}

export function canTransitionPayoutStatus(
  from: string,
  to: string,
): boolean {
  if (!isAllowedPayoutStatus(from) || !isAllowedPayoutStatus(to)) return false
  return ALLOWED_TRANSITIONS[from].includes(to)
}
