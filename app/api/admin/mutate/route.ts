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

/**
 * Unified admin write API (server-side only):
 *   POST /api/admin/mutate with JSON body { action, ...payload }
 * Actions:
 *   confirm_payment      { projectId }
 *   set_commission       { commissionId, newStatus }   pending→approved→available→paid | reversed/cancelled
 *   set_payout           { payoutId, newStatus }       pending→approved→paid | rejected
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
        const payoutId = String(body.payoutId ?? '')
        const newStatus = String(body.newStatus ?? '')
        if (!payoutId || !['pending', 'approved', 'paid', 'rejected'].includes(newStatus)) {
          return { error: 'INVALID_INPUT' }
        }
        const admin = adminClient()
        const { data: row, error } = await admin.from('payout_requests').select('*').eq('id', payoutId).single()
        if (error || !row) return { error: 'PAYOUT_NOT_FOUND' }
        if (newStatus === 'paid') {
          await admin.from('payout_requests').update({ status: 'paid', paid_at: new Date().toISOString(), reviewed_at: row.reviewed_at ?? new Date().toISOString() }).eq('id', payoutId)
        } else {
          await admin.from('payout_requests').update({ status: newStatus, reviewed_at: new Date().toISOString() }).eq('id', payoutId)
        }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: `payout_${newStatus}`, entity: 'payout_requests', entityId: payoutId, oldValue: { status: row.status }, newValue: { status: newStatus } })
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
        // Restore a previously deleted user: invite their email via the admin
        // auth API (Supabase sends a set-password confirmation email), then
        // create the public profile with the original name/username and role=user.
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' }
        const fullName = String(body.fullName ?? '').trim() || undefined
        const userName = String(body.username ?? '').trim() || undefined
        if (!fullName || !userName) return { error: 'MISSING_NAME_OR_USERNAME' }
        const admin = adminClient()
        // 1. Look up existing auth user (avoid duplicates)
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
        // 2. Ensure a public profile with role=user and original metadata
        const { data: profile } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
        if (!profile) {
          const { error: insErr } = await admin.from('profiles').insert({
            id: userId,
            full_name: fullName,
            username: userName,
            role: 'user',
          })
          if (insErr) return { error: 'PROFILE_FAILED' }
        } else if (profile.role !== 'user') {
          const { error: updErr } = await admin.from('profiles').update({ role: 'user' }).eq('id', userId)
          if (updErr) return { error: 'ROLE_FAILED' }
        }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'user_restored', entity: 'auth.users', entityId: userId, newValue: { email, full_name: fullName, username: userName } })
        invalidate()
        return { ok: true, email, justInvited }
      }

      case 'confirm_user_invitation': {
        // Invite an email to become an admin. If the email is not yet a user,
        // Supabase sends an invite link so the person can set their own password.
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' }
        const admin = adminClient()
        // 1. Look up existing auth user
        let existingUser: { id: string; email?: string } | null = null
        try {
          const list = await admin.auth.admin.listUsers()
          existingUser = list.data?.users?.find((u) => (u.email ?? '').toLowerCase() === email) ?? null
        } catch {
          existingUser = null
        }
        let userId = existingUser?.id ?? null
        if (!userId) {
          const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { role: 'admin' } })
          if (inviteError) return { error: 'INVITE_FAILED' }
          userId = invited?.user?.id ?? null
        }
        if (!userId) return { error: 'INVITE_FAILED' }
        // 2. Ensure a profile with admin role exists
        const { data: profile } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
        if (!profile) {
          const { error: insErr } = await admin.from('profiles').insert({ id: userId, role: 'admin' })
          if (insErr) return { error: 'PROFILE_FAILED' }
        } else if (profile.role !== 'admin') {
          const { error: updErr } = await admin.from('profiles').update({ role: 'admin' }).eq('id', userId)
          if (updErr) return { error: 'ROLE_FAILED' }
        }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'admin_invited', entity: 'profiles', entityId: userId, oldValue: { role: profile?.role ?? null }, newValue: { role: 'admin', email } })
        invalidate()
        return { ok: true, email }
      }

      case 'set_user_role': {
        const userId = String(body.userId ?? '')
        const role = String(body.role ?? '')
        if (!userId || !['user', 'manager', 'admin'].includes(role)) return { error: 'INVALID_INPUT' }
        if (userId === ctx.userId) return { error: 'CANNOT_CHANGE_OWN_ROLE' }
        const admin = adminClient()
        const { data: before } = await admin.from('profiles').select('role').eq('id', userId).single()
        const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
        if (error) return { error: 'DB_ERROR' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'user_role_changed', entity: 'profiles', entityId: userId, oldValue: { role: before?.role }, newValue: { role } })
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
        // Debug action: apply a real referral code to a given user and return the
        // full attributeReferral result (incl. DB_ERROR detail) so attribution
        // failures are observable rather than silent.
        const referredUserId = String(body.referredUserId ?? '')
        const code = String(body.code ?? '').trim() || undefined
        if (!referredUserId) return { error: 'MISSING_USER_ID' }
        const result = await attributeReferral({ referredUserId, code, sourceChannel: 'admin_manual' })
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'referral_manual_apply', entity: 'referrals', entityId: referredUserId, newValue: result })
        return result
      }

      case 'confirm_user': {
        // Confirm a user's email address (service role, bypasses RLS). Logged to audit.
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return { error: 'MISSING_EMAIL' }
        const admin = adminClient()
        // Search auth users by email via the admin auth API (the 'users' table
        // lives in the auth schema and is not directly queryable via .from()).
        let targetId: string | null = null
        try {
          const list = await admin.auth.admin.listUsers()
          targetId = list.data?.users?.find((u) => (u.email ?? '').toLowerCase() === email)?.id ?? null
        } catch {
          targetId = null
        }
        if (!targetId) return { error: 'USER_NOT_FOUND' }
        const userId = targetId
        const { error: updError } = await admin.auth.admin.updateUserById(userId, { email_confirm: true })
        if (updError) return { error: 'CONFIRM_FAILED' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'user_email_confirmed', entity: 'auth.users', entityId: userId, newValue: { email } })
        return { ok: true }
      }

      default:
        return { error: 'UNKNOWN_ACTION' }
    }
  })
}
