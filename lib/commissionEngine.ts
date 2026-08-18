/**
 * DropVerse Commission Engine — server-side only.
 *
 * Rules (enforced here, never on the client):
 *  - Commission base = eligible DropVerse revenue = client_price - fulfillment_cost.
 *    NEVER 20% of the total client project value.
 *  - Rates come from referral_tiers (DB-configurable) by active referral count.
 *  - Commissions are immutable ledger rows: PENDING → APPROVED → AVAILABLE
 *    (after holding period) → PAID. Refunds/chargebacks → REVERSED.
 *  - Self-referrals and duplicate attribution are blocked at insert time.
 */
import { adminClient, audit } from './adminCore'
import { REFERRAL_ELIGIBILITY_MONTHS, commissionRateFor } from './referralConfig'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CommissionStatus = 'pending' | 'approved' | 'available' | 'paid' | 'reversed' | 'cancelled'

const COMMISSION_STATUS_ORDER: CommissionStatus[] = [
  'pending', 'approved', 'available', 'paid',
]

/**
 * Create commissions for a project that just reached PAYMENT_CONFIRMED.
 * Idempotent: skips if a commission already exists for this project/referral.
 */
export async function createCommissionsForProject(params: {
  projectId: string
  userId: string            // project owner (used for context only)
  referralId?: string | null
  code?: string | null
}) {
  const admin = adminClient()

  // Load project financials server-side — never trust the client.
  const { data: project } = await admin
    .from('projects')
    .select('id, title, client_price, fulfillment_cost, currency, project_type, user_id')
    .eq('id', params.projectId)
    .single()
  if (!project || !project.client_price) return { created: false, reason: 'PROJECT_NOT_FOUND' }
  if (!(project.client_price > 0)) return { created: false, reason: 'INVALID_PRICE' }

  const eligible = Math.round((Number(project.client_price) - Number(project.fulfillment_cost || 0)) * 100) / 100
  if (!(eligible > 0)) return { created: false, reason: 'NO_ELIGIBLE_REVENUE' }

  let referralId = params.referralId
  if (!referralId && params.code) {
    // Resolve code → referral for this project owner
    const { data: codeRow } = await admin
      .from('referral_codes')
      .select('id')
      .eq('code', params.code)
      .single()
    if (codeRow) {
      const { data: ref } = await admin
        .from('referrals')
        .select('id, referrer_id, referred_user_id, locked_at')
        .eq('referral_code_id', codeRow.id)
        .eq('referred_user_id', project.user_id)
        .not('status', 'eq', 'cancelled')
        .maybeSingle()
      referralId = ref?.id ?? null
    }
  }
  if (!referralId) return { created: false, reason: 'NO_REFERRAL' }

  // Existing commission for this project/referral pair? skip (idempotent).
  const { data: existing } = await admin
    .from('referral_commissions')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('referral_id', referralId)
    .maybeSingle()
  if (existing) return { created: false, reason: 'DUPLICATE' }

  // Rate from DB tier by active referral count.
  const { count } = await admin
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', project.user_id) // count referrals made BY this user? use proper referrer below
  const { data: refRow } = await admin
    .from('referrals')
    .select('referrer_id, created_at')
    .eq('id', referralId)
    .single()
  const { count: activeCount } = await admin
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', refRow?.referrer_id ?? '')
    .eq('status', 'active')
  const rate = commissionRateFor(activeCount ?? 0)
  if (!(rate > 0)) return { created: false, reason: 'ZERO_RATE' }

  const amount = Math.round(eligible * rate * 100) / 100

  // Holding period end (configurable, default 30 days)
  const { data: config } = await admin.from('program_config').select('commission_holding_days').eq('id', 1).maybeSingle()
  const holdDays = config?.commission_holding_days ?? 30
  const availableAt = new Date(Date.now() + holdDays * 24 * 3600 * 1000).toISOString()

  const { error } = await admin.from('referral_commissions').insert({
    referral_id: referralId,
    project_id: params.projectId,
    base_amount: eligible,
    commission_rate: rate,
    commission_amount: amount,
    currency: project.currency ?? 'USD',
    status: 'pending',
    available_at: availableAt,
  })
  if (error) return { created: false, reason: 'DB_ERROR', detail: error.message }

  await audit({
    actorId: params.userId,
    actorEmail: null,
    action: 'commission_created',
    entity: 'referral_commissions',
    entityId: params.projectId,
    newValue: { eligible, rate, amount, referralId },
  })
  return { created: true, eligible, rate, amount }
}

/**
 * Lock referral attribution at signup time. Server action only.
 * Blocks: self-referral, duplicates, missing/unknown codes, already-referred users.
 */
export async function attributeReferral(params: {
  referredUserId: string
  code?: string | null       // user-provided code
  sourceUrl?: string | null
  sourceChannel?: string | null
}) {
  const admin = adminClient()
  const code = (params.code ?? '').trim().toUpperCase()
  if (!code) return { referred: false, reason: 'NO_CODE' }

  const { data: codeRow } = await admin
    .from('referral_codes')
    .select('id, user_id, active, kind')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle()
  if (!codeRow) return { referred: false, reason: 'INVALID_CODE' }
  if (codeRow.user_id === params.referredUserId) return { referred: false, reason: 'SELF_REFERRAL' } as const
  const refKind = (codeRow as { kind?: string }).kind ?? 'user'

  const { data: existing } = await admin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', params.referredUserId)
    .maybeSingle()
  if (existing) return { referred: false, reason: 'ALREADY_REFERRED' } // locked — never changeable

  const { error } = await admin.from('referrals').insert({
    referral_code_id: codeRow.id,
    referrer_id: codeRow.user_id,
    referred_user_id: params.referredUserId,
    kind: refKind,
    status: 'active',
    source_url: params.sourceUrl,
    source_channel: params.sourceChannel,
    attributed_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),
  })
  if (error) return { referred: false, reason: 'DB_ERROR', detail: error.message }

  await audit({
    actorId: params.referredUserId,
    actorEmail: null,
    action: 'referral_attributed',
    entity: 'referrals',
    entityId: codeRow.id,
    newValue: { code, referredUserId: params.referredUserId, referrerId: codeRow.user_id },
  })
  return { referred: true, referrerId: codeRow.user_id }
}

/**
 * Update project payment status with financial audit trail and
 * auto commission creation when a payment is confirmed.
 */
export async function confirmProjectPayment(params: {
  projectId: string
  adminUserId: string
  adminEmail: string | null
}) {
  const admin = adminClient()
  const { data: project, error } = await admin
    .from('projects')
    .select('*')
    .eq('id', params.projectId)
    .single()
  if (error || !project) return { ok: false, reason: 'PROJECT_NOT_FOUND' }
  if (project.payment_status === 'PAYMENT_CONFIRMED') return { ok: true, reason: 'ALREADY_CONFIRMED' }

  const { error: updateError } = await admin
    .from('projects')
    .update({
      payment_status: 'PAYMENT_CONFIRMED',
      payment_confirmed_at: new Date().toISOString(),
    })
    .eq('id', params.projectId)

  if (updateError) return { ok: false, reason: 'DB_ERROR' }

  await audit({
    actorId: params.adminUserId,
    actorEmail: params.adminEmail,
    action: 'payment_confirmed',
    entity: 'projects',
    entityId: params.projectId,
    oldValue: { payment_status: project.payment_status },
    newValue: { payment_status: 'PAYMENT_CONFIRMED' },
  })

  // Auto-create affiliate commissions for the project's referral, if any.
  const commResult = await createCommissionsForProject({
    projectId: params.projectId,
    userId: params.adminUserId,
  })
  return { ok: true, commission: commResult }
}

/**
 * Advance/reverse a commission status. Only valid transitions allowed.
 */
export async function setCommissionStatus(params: {
  commissionId: string
  newStatus: CommissionStatus
  actorId: string
  actorEmail: string | null
}) {
  const admin = adminClient()
  const { data: row, error } = await admin
    .from('referral_commissions')
    .select('*')
    .eq('id', params.commissionId)
    .single()
  if (error || !row) return { ok: false, reason: 'NOT_FOUND' }

  const fromIdx = COMMISSION_STATUS_ORDER.indexOf(row.status as CommissionStatus)
  const toIdx = COMMISSION_STATUS_ORDER.indexOf(params.newStatus)
  const isReversal = params.newStatus === 'reversed' || params.newStatus === 'cancelled'
  if (!isReversal && toIdx <= fromIdx) return { ok: false, reason: 'INVALID_TRANSITION' }
  if (fromIdx === -1 && !isReversal) return { ok: false, reason: 'INVALID_TRANSITION' }

  const { error: updateError } = await admin
    .from('referral_commissions')
    .update({
      status: params.newStatus,
      reviewed_at: new Date().toISOString(),
      paid_at: params.newStatus === 'paid' ? new Date().toISOString() : row.paid_at,
      reviewer_id: params.actorId,
    })
    .eq('id', params.commissionId)
  if (updateError) return { ok: false, reason: 'DB_ERROR' }

  await audit({
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: `commission_${params.newStatus}`,
    entity: 'referral_commissions',
    entityId: params.commissionId,
    oldValue: { status: row.status, amount: row.commission_amount },
    newValue: { status: params.newStatus },
  })
  return { ok: true }
}
