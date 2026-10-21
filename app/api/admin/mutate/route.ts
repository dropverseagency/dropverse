import { NextRequest } from 'next/server'
import { adminJson, adminClient, invalidate, audit } from '@/lib/adminCore'
import {
  confirmProjectPayment,
  setCommissionStatus,
  attributeReferral,
  type CommissionStatus,
} from '@/lib/commissionEngine'
import { COMMISSION_STATUSES, REFERRAL_STATUSES } from '@/lib/referralConfig'
import { PROJECT_TYPES, FULFILLMENT_RATES } from '@/lib/projectConfig'
import {
  canTransitionPayoutStatus,
  isAllowedPayoutStatus,
  type PayoutRequestStatus,
} from '@/lib/payoutStatus'

/**
 * Unified admin write API (server-side only):
 *   POST /api/admin/mutate with JSON body { action, ...payload }
 * Actions:
 *   confirm_payment      { projectId }
 *   set_commission       { commissionId, newStatus }   pending→approved→available→paid | reversed/cancelled
 *   set_payout           { payoutId, newStatus }       pending→approved→paid | cancelled
 *   update_service       { serviceId, ...fields }
 *   update_tiers         { tiers: [{id?, name, min, max, rate}] }
 *   update_program       { holding_days?, eligibility_months? }
 *   set_user_role        { userId, role }   (admin/manager only — never downgrade self)
 *   set_referral_active  { referralId, status }
 *   create_test_referral { referrerUserId, referredUserId }  — manual attribution for testing
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
        // DB constraint: pending | approved | paid | cancelled (no rejected).
        const payoutId = String(body.payoutId ?? '')
        const rawStatus = String(body.newStatus ?? '')
        // Accept legacy alias "rejected" as invalid input with guidance — do not write it.
        if (rawStatus === 'rejected') {
          return {
            error: 'INVALID_PAYOUT_STATUS',
            message: 'Use cancelled instead of rejected. Allowed: pending, approved, paid, cancelled.',
          }
        }
        if (!payoutId || !isAllowedPayoutStatus(rawStatus)) {
          return {
            error: 'INVALID_INPUT',
            message: 'newStatus must be one of: pending, approved, paid, cancelled.',
          }
        }
        const newStatus = rawStatus as PayoutRequestStatus
        const admin = adminClient()
        const { data: row, error } = await admin.from('payout_requests').select('*').eq('id', payoutId).single()
        if (error || !row) return { error: 'PAYOUT_NOT_FOUND' }
        const fromStatus = String(row.status ?? '')
        if (!canTransitionPayoutStatus(fromStatus, newStatus)) {
          return {
            error: 'INVALID_PAYOUT_TRANSITION',
            message: `Cannot transition payout from ${fromStatus} to ${newStatus}.`,
          }
        }
        const patch: Record<string, unknown> = {
          status: newStatus,
          reviewed_at: row.reviewed_at ?? new Date().toISOString(),
        }
        if (newStatus === 'paid') {
          patch.paid_at = new Date().toISOString()
        }
        const { error: updateError } = await admin.from('payout_requests').update(patch).eq('id', payoutId)
        if (updateError) {
          console.error('[admin/mutate set_payout]', updateError)
          return {
            error: 'PAYOUT_STATUS_UPDATE_FAILED',
            message: 'Could not update payout status. No change was applied.',
          }
        }
        await audit({
          actorId: ctx.userId,
          actorEmail: ctx.email,
          action: `payout_${newStatus}`,
          entity: 'payout_requests',
          entityId: payoutId,
          oldValue: { status: row.status },
          newValue: { status: newStatus },
        })
        invalidate()
        return { ok: true }
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
          }
        }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'tiers_updated', entity: 'referral_tiers', newValue: tiers })
        invalidate()
        return { ok: true }
      }

      case 'update_program': {
        const admin = adminClient()
        const patch: Record<string, unknown> = {}
        if (typeof body.holding_days === 'number') patch.commission_holding_days = Math.max(0, Math.floor(body.holding_days))
        if (typeof body.eligibility_months === 'number') patch.referral_eligibility_months = Math.max(1, Math.floor(body.eligibility_months))
        const { error } = await admin.from('program_config').update(patch).eq('id', 1)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'program_config_updated', entity: 'program_config', newValue: patch })
        invalidate()
        return { ok: true }
      }

      case 'restore_user': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' }
        const fullName = String(body.fullName ?? '').trim() || undefined
        const userName = String(body.username ?? '').trim() || undefined
        if (!fullName || !userName) return { error: 'MISSING_NAME_OR_USERNAME' }
        const admin = adminClient()
        let existingUser: { id: string; email?: string } | null = null
        try {
          const list = await admin.auth.admin.listUsers()
          existingUser = list.data?.users?.find((u) => (u.email ?? '').toLowerCase() === email) ?? null
        } catch {
          existingUser = null
        }
        let userId = existingUser?.id ?? null
        let justInvited = false
        if (!userId) {
          const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, username: userName } })
          if (inviteError) return { error: 'INVITE_FAILED' }
          userId = invited?.user?.id ?? null
          justInvited = true
        }
        if (!userId) return { error: 'INVITE_FAILED' }
        const { data: profile } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
        if (!profile) {
          const { error: insErr } = await admin.from('profiles').insert({
            id: userId,
            full_name: fullName,
            username: userName,
            role: 'user',
          })
          if (insErr) return { error: 'PROFILE_CREATE_FAILED' }
        } else if (profile.role !== 'user') {
          // leave existing elevated roles alone on restore path
        }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'user_restored', entity: 'profiles', entityId: userId, newValue: { email, fullName, userName, justInvited } })
        invalidate()
        return { ok: true, userId, justInvited }
      }

      case 'set_user_role': {
        const userId = String(body.userId ?? '')
        const role = String(body.role ?? '')
        if (!userId || !['user', 'manager', 'admin'].includes(role)) return { error: 'INVALID_INPUT' }
        if (userId === ctx.userId && role !== 'admin') return { error: 'CANNOT_DOWNGRADE_SELF' }
        const admin = adminClient()
        const { data: before } = await admin.from('profiles').select('role').eq('id', userId).single()
        const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'role_changed', entity: 'profiles', entityId: userId, oldValue: before, newValue: { role } })
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
        const referrerUserId = String(body.referrerUserId ?? '')
        const referredUserId = String(body.referredUserId ?? '')
        if (!referrerUserId || !referredUserId) return { error: 'MISSING_IDS' }
        return await attributeReferral({ referrerUserId, referredUserId, actorId: ctx.userId, actorEmail: ctx.email })
      }

      case 'confirm_user': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return { error: 'INVALID_EMAIL' }
        const admin = adminClient()
        const list = await admin.auth.admin.listUsers()
        const user = list.data?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
        if (!user) return { error: 'USER_NOT_FOUND' }
        const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
        if (error) return { error: 'CONFIRM_FAILED' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'user_confirmed', entity: 'auth.users', entityId: user.id })
        return { ok: true }
      }

      case 'confirm_user_invitation': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' }
        const admin = adminClient()
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
        if (error) return { error: 'INVITE_FAILED' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'admin_invite', entity: 'auth.users', entityId: data?.user?.id, newValue: { email } })
        return { ok: true, userId: data?.user?.id }
      }

      default:
        return { error: 'UNKNOWN_ACTION' }
    }
  })
}
