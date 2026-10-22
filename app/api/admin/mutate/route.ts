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
 *   set_user_role        { userId, role }   (admin/manager only — never downgrade self)
 *   set_referral_active  { referralId, status }
 *   create_test_referral { referredUserId, code }  — manual attribution for testing
 *   confirm_user         { email }  — confirm a user's email (admin tooling)
 *   confirm_user_invitation { email } — invite an email to become admin (creates user if needed)
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

      case 'update_service': {
        const serviceId = String(body.serviceId ?? '')
        if (!serviceId) return { error: 'MISSING_SERVICE_ID' }
        const allowed = ['title', 'description', 'slug', 'active', 'base_cost_one_time', 'base_cost_monthly', 'base_cost_annual'] as const
        const patch: Record<string, unknown> = {}
        for (const k of allowed) if (k in body) patch[k] = body[k]
        const admin = adminClient()
        const { data: before } = await admin.from('services').select('*').eq('id', serviceId).single()
        const { error } = await admin.from('services').update({ ...patch, updated_by: ctx.userId }).eq('id', serviceId)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'service_updated', entity: 'services', entityId: serviceId, oldValue: before, newValue: patch })
        invalidate()
        return { ok: true }
      }

      case 'update_tiers': {
        const tiers = (body.tiers ?? []) as { id?: string; name: string; min_active_referrals: number; max_active_referrals: number; commission_rate: number }[]
        if (!Array.isArray(tiers)) return { error: 'INVALID_INPUT' }
        const admin = adminClient()
        for (const tier of tiers) {
          if (typeof tier.commission_rate !== 'number' || tier.commission_rate < 0 || tier.commission_rate > 1) return { error: 'INVALID_RATE' }
          if (tier.id) {
            await admin.from('referral_tiers').update({
              name: tier.name,
              min_active_referrals: tier.min_active_referrals,
              max_active_referrals: tier.max_active_referrals,
              commission_rate: tier.commission_rate,
            }).eq('id', tier.id)
          } else {
            await admin.from('referral_tiers').insert({
              name: tier.name,
              min_active_referrals: tier.min_active_referrals,
              max_active_referrals: tier.max_active_referrals,
              commission_rate: tier.commission_rate,
            })
          }
        }
        invalidate()
        return { ok: true }
      }

      case 'update_program': {
        const admin = adminClient()
        const patch: Record<string, unknown> = {}
        if (typeof body.holding_days === 'number') patch.commission_holding_days = Math.max(0, Math.floor(body.holding_days))
        if (typeof body.eligibility_months === 'number') patch.eligibility_months = Math.max(0, Math.floor(body.eligibility_months))
        if (!Object.keys(patch).length) return { error: 'NO_CHANGES' }
        const { data: rows } = await admin.from('referral_program_settings').select('id').limit(1)
        if (rows?.[0]?.id) {
          await admin.from('referral_program_settings').update(patch).eq('id', rows[0].id)
        } else {
          await admin.from('referral_program_settings').insert(patch)
        }
        invalidate()
        return { ok: true }
      }

      case 'set_user_role': {
        const userId = String(body.userId ?? '')
        const role = String(body.role ?? '')
        if (!userId || !['user', 'admin', 'manager'].includes(role)) return { error: 'INVALID_INPUT' }
        if (userId === ctx.userId && role !== 'admin') return { error: 'CANNOT_DOWNGRADE_SELF' }
        const admin = adminClient()
        const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: `role_${role}`, entity: 'profiles', entityId: userId })
        invalidate()
        return { ok: true }
      }

      case 'set_referral_active': {
        const referralId = String(body.referralId ?? '')
        const status = String(body.status ?? '')
        if (!referralId || !REFERRAL_STATUSES.includes(status as any)) return { error: 'INVALID_INPUT' }
        const admin = adminClient()
        const { error } = await admin.from('referrals').update({ status }).eq('id', referralId)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: `referral_${status}`, entity: 'referrals', entityId: referralId })
        invalidate()
        return { ok: true }
      }

      case 'create_test_referral': {
        const referredUserId = String(body.referredUserId ?? '')
        const code = String(body.code ?? body.referralCode ?? '')
        if (!referredUserId || !code) {
          return { error: 'INVALID_INPUT', message: 'referredUserId and code are required.' }
        }
        return await attributeReferral({
          referredUserId,
          code,
          sourceChannel: 'admin_test',
        })
      }

      case 'confirm_user': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return { error: 'INVALID_INPUT' }
        const admin = adminClient()
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
        const user = list?.users?.find((u) => (u.email || '').toLowerCase() === email)
        if (!user) return { error: 'USER_NOT_FOUND' }
        await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
        return { ok: true }
      }

      case 'confirm_user_invitation': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return { error: 'INVALID_INPUT' }
        const admin = adminClient()
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
        if (error) return { error: 'INVITE_FAILED', message: error.message }
        return { ok: true, userId: data.user?.id }
      }

      default:
        return { error: 'UNKNOWN_ACTION' }
    }
  })
}
