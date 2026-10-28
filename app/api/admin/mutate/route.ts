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
import { createUserNotification } from '@/lib/userNotifications'
import { recordFunnelEvent } from '@/lib/funnel'

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
      case 'set_freelancer_verification': {
        const userId=String(body.userId||'')
        const identityStatus=String(body.identityStatus||'')
        const specialtyStatus=String(body.specialtyStatus||'')
        const verifiedLevel=String(body.verifiedLevel||'')
        const note=String(body.note||'').trim().slice(0,2000)
        const identityProviderReference=String(body.identityProviderReference||'').trim().slice(0,200)
        if(!userId||!['unsubmitted','pending','verified','rejected','expired'].includes(identityStatus)||!['unreviewed','pending','passed','failed'].includes(specialtyStatus)||!['none','identity','specialist','pro'].includes(verifiedLevel))return {error:'INVALID_VERIFICATION'}
        if(identityStatus==='verified' && (!identityProviderReference || note.length < 5 || specialtyStatus!=='passed' || !['specialist','pro'].includes(verifiedLevel)))return {error:'VERIFICATION_EVIDENCE_REQUIRED'}
        const admin = adminClient()
        const { data: previous } = await admin.from('freelancer_verifications').select('identity_status,specialty_status,verified_level').eq('user_id', userId).maybeSingle()
        const { error } = await admin.from('freelancer_verifications').upsert({ user_id: userId, identity_status: identityStatus, specialty_status: specialtyStatus, verified_level: verifiedLevel, specialty_review_note: note || null, identity_provider_reference: identityProviderReference || null, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        if (error) return { error: 'VERIFICATION_SAVE_FAILED' }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'freelancer_verification_updated', entity: 'freelancer_verifications', entityId: userId, newValue: { identityStatus, specialtyStatus, verifiedLevel, note, identityProviderReference: identityProviderReference || null } })
        const changed = !previous || previous.identity_status !== identityStatus || previous.specialty_status !== specialtyStatus || previous.verified_level !== verifiedLevel
        if (changed) {
          const approved = identityStatus === 'verified' && specialtyStatus === 'passed'
          await createUserNotification({ userId, type: 'freelancer_verification_updated', title: approved ? 'Your freelancer verification was approved' : 'Your freelancer verification was updated', body: `Identity status: ${identityStatus}. Specialty review: ${specialtyStatus}. Verification level: ${verifiedLevel}.`, href: '/dashboard', entityType: 'freelancer_verification', entityId: userId })
        }
        return { ok: true }
      }
      case 'release_project_earning': {
        const projectId = String(body.projectId ?? '')
        const reference = String(body.reference ?? '').trim().slice(0, 200)
        if (!projectId || !reference) return { error: 'PROJECT_AND_REFERENCE_REQUIRED' }
        const admin = adminClient()
        const { data: result, error } = await admin.rpc('release_project_earning_atomic', {
          p_project_id: projectId,
          p_admin_user_id: ctx.userId,
          p_reference: reference,
        })
        if (error || !result || typeof result !== 'object') {
          console.error('[admin/mutate release_project_earning]', error)
          return { error: 'PROJECT_EARNING_RELEASE_FAILED' }
        }
        if (result.ok !== true) return { error: String(result.error ?? 'EARNING_NOT_RELEASABLE') }
        // A retry after a successful commit is safe and must not duplicate notices.
        if (result.duplicate === true) return { ok: true, duplicate: true }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'project_earning_released', entity: 'projects', entityId: projectId, newValue: { reference } })
        await createUserNotification({
          userId: String(result.freelancerId),
          type: 'project_payout_released',
          title: 'Project payout released',
          body: `Your payout for ${String(result.title)} was marked as sent. Reference: ${reference}`,
          href: `/dashboard/projects/${projectId}`,
          entityType: 'project',
          entityId: projectId,
        })
        return { ok: true }
      }

      case 'resolve_project_dispute': {
        const disputeId = String(body.disputeId ?? '')
        const resolution = String(body.resolution ?? '').trim().slice(0, 3000)
        const outcome = String(body.outcome ?? '')
        const refundReference = String(body.refundReference ?? '').trim().slice(0, 200)
        const refundAmount = Math.max(0, Number(body.refundAmount ?? 0))
        if (!disputeId || resolution.length < 3 || !['resolved','refunded','rejected'].includes(outcome)) return { error: 'INVALID_DISPUTE_RESOLUTION' }
        if (outcome === 'refunded' && !refundReference) return { error: 'REFUND_REFERENCE_REQUIRED' }
        const admin = adminClient()
        const { data: dispute } = await admin.from('project_disputes').select('id,project_id,status').eq('id', disputeId).maybeSingle()
        if (!dispute || !['open','under_review'].includes(dispute.status)) return { error: 'DISPUTE_NOT_OPEN' }
        await admin.from('project_disputes').update({ status: outcome, resolution, refund_amount: outcome === 'refunded' ? refundAmount : null, refund_reference: outcome === 'refunded' ? refundReference : null, resolved_by: ctx.userId, resolved_at: new Date().toISOString() }).eq('id', disputeId)
        await admin.from('projects').update(outcome === 'refunded' ? { operations_status: 'refunded', payment_status: 'PAYMENT_REFUNDED', freelancer_payout_status: 'reversed' } : { operations_status: outcome === 'resolved' ? 'approved' : 'delivered' }).eq('id', dispute.project_id)
        if (outcome === 'refunded') await admin.from('project_earnings').update({ status: 'reversed' }).eq('project_id', dispute.project_id).neq('status','released')
        await admin.from('project_events').insert({ project_id: dispute.project_id, actor_id: ctx.userId, actor_kind: 'admin', event_type: `dispute_${outcome}`, metadata: { disputeId, refundAmount, refundReference } })
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: `project_dispute_${outcome}`, entity: 'project_disputes', entityId: disputeId, newValue: { resolution, refundAmount, refundReference } })
        return { ok: true }
      }
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

        const transferReference = String(body.reference ?? '').trim().slice(0, 200)
        const adminNote = String(body.adminNote ?? '').trim().slice(0, 2000)
        if (decision.status === 'paid' && !transferReference) {
          return { error: 'TRANSFER_REFERENCE_REQUIRED', message: 'Add the bank / PayPal transfer reference before marking this payout as paid.' }
        }

        const patch: Record<string, unknown> = {
          status: decision.status,
          reviewed_at: row.reviewed_at ?? new Date().toISOString(),
        }
        if (adminNote) patch.admin_note = adminNote
        if (decision.status === 'paid') {
          patch.paid_at = new Date().toISOString()
          patch.transfer_reference = transferReference
        }

        const { data: updated, error: updError } = await admin
          .from('payout_requests')
          .update(patch)
          .eq('id', payoutId)
          .eq('status', row.status)
          .select('id')
          .maybeSingle()
        if (updError) {
          console.error('[admin/mutate set_payout]', updError)
          return {
            error: 'PAYOUT_UPDATE_FAILED',
            message: 'Could not update payout status. Check the payout schema and try again.',
          }
        }
        if (!updated) {
          return {
            error: 'PAYOUT_STATUS_CONFLICT',
            message: 'The payout status changed while you were reviewing it. Refresh the request and try again.',
          }
        }
        await audit({
          actorId: ctx.userId,
          actorEmail: ctx.email,
          action: `payout_${decision.status}`,
          entity: 'payout_requests',
          entityId: payoutId,
          oldValue: { status: row.status },
          newValue: {
            status: decision.status,
            requested: requestedStatus,
            transferReference: decision.status === 'paid' ? transferReference : null,
            adminNote: adminNote || null,
          },
        })
        if (decision.status === 'paid') {
          await recordFunnelEvent('payout_completed',{userId:row.user_id,amountUsd:Number(row.amount||0),metadata:{payoutId}})
          await createUserNotification({
            userId: row.user_id,
            type: 'payout_paid',
            title: 'Your payout was marked as paid',
            body: `A payout of ${Number(row.amount || 0).toFixed(2)} was marked as sent. Reference: ${transferReference}`,
            href: '/dashboard/payouts',
            entityType: 'payout_request',
            entityId: payoutId,
          })
        } else if (decision.status === 'approved') {
          await createUserNotification({
            userId: row.user_id,
            type: 'payout_approved',
            title: 'Your payout request was approved',
            body: 'Your payout is approved and awaiting manual transfer on the scheduled processing cycle.',
            href: '/dashboard/payouts',
            entityType: 'payout_request',
            entityId: payoutId,
          })
        } else if (decision.status === 'cancelled') {
          await createUserNotification({
            userId: row.user_id,
            type: 'payout_cancelled',
            title: 'Your payout request was cancelled',
            body: 'Your payout request was cancelled. The reserved balance is available again.',
            href: '/dashboard/payouts',
            entityType: 'payout_request',
            entityId: payoutId,
          })
        }
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
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' }
        const admin = adminClient()
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
        const referredUserId = String(body.referredUserId ?? '')
        const code = String(body.code ?? '').trim() || undefined
        if (!referredUserId) return { error: 'MISSING_USER_ID' }
        const result = await attributeReferral({ referredUserId, code, sourceChannel: 'admin_manual' })
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'referral_manual_apply', entity: 'referrals', entityId: referredUserId, newValue: result })
        return result
      }

      case 'confirm_user': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return { error: 'MISSING_EMAIL' }
        const admin = adminClient()
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

      case 'create_service': {
        const title = String(body.title ?? '').trim()
        const description = String(body.description ?? '').trim()
        if (!title) return { error: 'MISSING_TITLE' }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'service'
        const admin = adminClient()
        const { data, error } = await admin.from('services').insert({
          title,
          description,
          slug,
          active: body.active !== false,
          base_cost_one_time: Number(body.baseCostOneTime ?? 0) || 0,
          updated_by: ctx.userId,
        }).select('id').single()
        if (error) return { error: error.message }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'service_created', entity: 'services', entityId: data?.id, newValue: { title, slug } })
        invalidate()
        return { ok: true, id: data?.id }
      }

      case 'create_sample': {
        const title = String(body.title ?? '').trim()
        const mediaUrl = String(body.mediaUrl ?? '').trim()
        if (!title || !mediaUrl) return { error: 'MISSING_SAMPLE' }
        const admin = adminClient()
        const { data, error } = await admin.from('work_samples').insert({
          title,
          description: String(body.description ?? '').trim(),
          media_url: mediaUrl,
          thumbnail_url: mediaUrl,
          featured: true,
        }).select('id').single()
        if (error) return { error: error.message }
        await audit({ actorId: ctx.userId, actorEmail: ctx.email, action: 'sample_created', entity: 'work_samples', entityId: data?.id, newValue: { title } })
        invalidate()
        return { ok: true, id: data?.id }
      }

      default:
        return { error: 'UNKNOWN_ACTION' }
    }
  })
}
