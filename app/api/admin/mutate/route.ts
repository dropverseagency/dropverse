import { NextRequest } from 'next/server'
import { adminJson, adminClient, invalidate, audit } from '@/lib/adminCore'
import {
  confirmProjectPayment,
  setCommissionStatus,
  attributeReferral,
  type CommissionStatus,
} from '@/lib/commissionEngine'
import { COMMISSION_STATUSES, REFERRAL_STATUSES } from '@/lib/referralConfig'
import { decidePayoutStatusUpdate } from '@/lib/payoutStatus'
import { PROJECT_TYPES, FULFILLMENT_RATES } from '@/lib/projectConfig'

/**
 * Unified admin write API (server-side only):
 *   POST /api/admin/mutate with JSON body { action, ...payload }
 * Actions:
 *   confirm_payment      { projectId }
 *   set_commission       { commissionId, newStatus }   pending→approved→available→paid | reversed/cancelled
 *   set_payout           { payoutId, newStatus }       pending→approved→paid | cancelled (rejected alias)
 *   update_service       { serviceId, ...fields }
 *   update_tiers         { tiers: [{id?, name, min, max, rate}] }
 *   update_program       { holding_days?, eligibility_months? }
 *   restore_user         { email, fullName, username }
 *   confirm_user_invitation { email } — invite an email to become admin (creates user if needed)
 *   set_user_role        { userId, role }   (admin/manager only — never downgrade self)
 *   set_referral_active  { referralId, status }
 *   create_test_referral { referredUserId, code? }
 *   confirm_user         { email }  — confirm a user's email (admin tooling)
 *   create_service       { title, description?, ... }
 *   create_sample        { ... }
 */

const VALID_COMMISSION_STATUSES: CommissionStatus[] = [
  'pending', 'approved', 'available', 'paid', 'reversed', 'cancelled',
] as CommissionStatus[]

export async function POST(request: NextRequest) {
  return adminJson(async (ctx) => {
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    switch (action) {
      case 'confirm_payment': {
        const projectId = String(body.projectId ?? '')
        if (!projectId) return { error: 'MISSING_PROJECT_ID' }
        return await confirmProjectPayment({ projectId, adminUserId: ctx.userId, adminEmail: ctx.email })
      }

      case 'set_commission': {
        const commissionId = String(body.commissionId ?? '')
        const newStatus = String(body.newStatus ?? '')
        if (!commissionId || !VALID_COMMISSION_STATUSES.includes(newStatus as CommissionStatus)) {
          return { error: 'INVALID_INPUT' }
        }
        return await setCommissionStatus({ commissionId, newStatus: newStatus as CommissionStatus, actorId: ctx.userId, actorEmail: ctx.email })
      }

      case 'set_payout': {
        const payoutId = String(body.payoutId ?? '')
        const requestedStatus = String(body.newStatus ?? '')
        if (!payoutId || !requestedStatus) {
          return { error: 'INVALID_INPUT', message: 'payoutId and newStatus are required.' }
        }
        const admin = adminClient()
        const { data: row, error } = await admin.from('payout_requests').select('*').eq('id', payoutId).single()
        if (error || !row) return { error: 'PAYOUT_NOT_FOUND' }

        const decision = decidePayoutStatusUpdate(String(row.status), requestedStatus)
        if (!decision.ok) {
          return { error: decision.error, message: decision.message }
        }
        if (decision.noop) {
          return { ok: true, status: decision.status, noop: true }
        }

        const patch: Record<string, unknown> = {
          status: decision.status,
          reviewed_at: row.reviewed_at ?? new Date().toISOString(),
        }
        if (decision.status === 'paid') {
          patch.paid_at = new Date().toISOString()
          patch.reviewed_at = row.reviewed_at ?? new Date().toISOString()
        }

        const { error: updError } = await admin.from('payout_requests').update(patch).eq('id', payoutId)
        if (updError) {
          console.error('[admin/mutate set_payout]', updError)
          return {
            error: 'PAYOUT_UPDATE_FAILED',
            message: 'Could not update payout status. Check that the status is allowed by the database.',
          }
        }
        await audit({
          actorId: ctx.userId,
          actorEmail: ctx.email,
          action: `payout_${decision.status}`,
          entity: 'payout_requests',
          entityId: payoutId,
          oldValue: { status: row.status },
          newValue: { status: decision.status, requested: requestedStatus },
        })
        invalidate()
        return { ok: true, status: decision.status }
      }
