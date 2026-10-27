export type ProjectActor = 'seller' | 'freelancer' | 'admin'

export type ProjectOperationAction =
  | { type: 'assign'; freelancerId: string; dueAt?: string; payoutAmount?: number }
  | { type: 'respond_assignment'; decision: 'accepted' | 'declined'; note?: string }
  | { type: 'message'; body: string }
  | { type: 'request_revision'; details: string }
  | { type: 'approve_delivery' }
  | { type: 'open_dispute'; reason: string }
  | { type: 'reassign'; freelancerId: string; dueAt?: string; payoutAmount?: number }

export function revisionCharge(requestNumber: number, includedLimit: number, extraPrice: number) {
  const included = requestNumber <= Math.max(0, includedLimit)
  return { included, priceUsd: included ? 0 : Math.max(0, extraPrice), paymentStatus: included ? 'not_required' : 'pending' }
}

export function canReleasePayout(project: { operations_status?: string; payment_status?: string; freelancer_payout_status?: string }) {
  return project.operations_status === 'approved'
    && project.payment_status === 'PAYMENT_CONFIRMED'
    && project.freelancer_payout_status !== 'released'
}
