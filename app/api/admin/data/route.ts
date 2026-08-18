import { NextRequest } from 'next/server'
import { adminClient, adminJson, parsePage, AuditInput } from '@/lib/adminCore'

/**
 * Unified admin read API (server-side, service role):
 *   GET /api/admin/data?section=overview|users|agencies|projects|payments|affiliates|commissions|services|freelancers|audit|settings&q=&page=&limit=
 */
export async function GET(request: NextRequest) {
  return adminJson(async ({ userId, email }) => {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') ?? 'overview'
    const q = (searchParams.get('q') ?? '').trim()
    const { offset, limit } = parsePage(searchParams)
    const admin = adminClient()
    const countOf = async (table: string, eq: { column: string; value: string } | null) => {
      let q: any = admin.from(table).select('*', { count: 'exact', head: true })
      if (eq) q = q.eq(eq.column, eq.value)
      const { count } = await q
      return count ?? 0
    }

    const select = (table: string, columns: string) => admin.from(table).select(columns)

    switch (section) {
      case 'debug_counts': {
        const out: Record<string, unknown> = {}
        const admin = adminClient()
        const tryCount = async (name: string, table: string, opts?: { column?: string; value?: string }) => {
          try {
            let q: any = admin.from(table).select('*', { count: 'exact', head: true })
            if (opts?.column) q = q.eq(opts.column, opts.value)
            const { data, count, error } = await q
            out[name] = { count, error: error ? { message: error.message, code: error.code } : null }
          } catch (e: any) {
            out[name] = { error: String(e?.message ?? e) }
          }
        }
        await tryCount('profiles', 'profiles')
        await tryCount('profiles_all', 'profiles', { column: 'id', value: '*' })
        return { section: 'debug_counts', ...out }
      }

      case 'overview': {
        const [
          users, projects, agencies, paymentsConfirmed, paymentsPending,
          affiliatesActive, commissionsPending, commissionsPaid,
        ] = await Promise.all([
          countOf('profiles', null),
          countOf('projects', null),
          countOf('organizations', null),
          countOf('projects', { column: 'payment_status', value: 'PAYMENT_CONFIRMED' }),
          countOf('projects', { column: 'payment_status', value: 'PAYMENT_PENDING' }),
          countOf('referrals', { column: 'status', value: 'active' }),
          countOf('referral_commissions', { column: 'status', value: 'pending' }),
          countOf('referral_commissions', { column: 'status', value: 'paid' }),
        ])
        // Revenue: sum of base_amount of approved/paid commissions (ledger-grade, never client-supplied)
        const { data: revRows } = await admin
          .from('referral_commissions')
          .select('base_amount')
          .in('status', ['approved', 'available', 'paid'])
        const dvRevenue = (revRows ?? []).reduce((s, r) => s + Number(r.base_amount || 0), 0)
        const { data: payoutRows } = await admin.from('payout_requests').select('amount').eq('status', 'paid')
        const payouts = (payoutRows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
        // Last 10 audit entries
        const { data: recentAudit } = await admin
          .from('audit_logs')
          .select('id, actor_id, actor_email, action, entity, entity_id, created_at')
          .order('created_at', { ascending: false })
          .limit(10)
        // Last 5 projects
        const { data: recentProjects } = await admin
          .from('projects')
          .select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_status, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
        return {
          section: 'overview',
          totals: {
            users: users.count ?? 0,
            projects: projects.count ?? 0,
            agencies: agencies.count ?? 0,
            paymentsConfirmed: paymentsConfirmed.count ?? 0,
            paymentsPending: paymentsPending.count ?? 0,
            activeReferrals: affiliatesActive.count ?? 0,
            commissionsPending: commissionsPending.count ?? 0,
            commissionsPaid: commissionsPaid.count ?? 0,
            dvRevenue: Math.round(dvRevenue * 100) / 100,
            totalPayouts: Math.round(payouts * 100) / 100,
          },
          recentAudit: recentAudit ?? [],
          recentProjects: recentProjects ?? [],
          me: { userId, email },
        }
      }

      case 'users': {
        let query = select('profiles', 'id, full_name, username, phone, telegram_username, avatar_url, role, created_at').order('created_at', { ascending: false })
        if (q) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        const rows = (data ?? []) as unknown as { id: string; [k: string]: unknown }[]
        // emails come from auth.users via users_view or rest admin — fetch separately
        let emails: { id: string; email: string }[] = []
        if (rows.length > 0) {
          const { data: emailRows } = await admin
            .from('users_view')
            .select('id, email')
            .in('id', rows.map((d) => d.id))
          emails = (emailRows ?? []) as { id: string; email: string }[]
        }
        const byId = new Map(emails.map((e) => [e.id, e.email]))
        return { section: 'users', rows: rows.map((d) => ({ ...d, email: byId.get(d.id) ?? null })), count: count ?? 0, offset, limit }
      }

      case 'user_detail': {
        // Full profile of a single user: identity + projects + referral activity.
        const detailId = (searchParams.get('id') ?? '').trim()
        if (!detailId) return { error: 'MISSING_ID', section: 'user_detail' }
        const { data: prof, error: profError } = await admin
          .from('profiles')
          .select('id, full_name, username, phone, telegram_username, avatar_url, role, created_at')
          .eq('id', detailId)
          .maybeSingle()
        if (profError) throw profError
        if (!prof) return { error: 'USER_NOT_FOUND', section: 'user_detail' }
        const { data: emailRow } = await admin
          .from('users_view')
          .select('id, email, email_confirmed_at')
          .eq('id', detailId)
          .maybeSingle()
        const [projects, orgs] = await Promise.all([
          admin.from('projects').select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_status, status, created_at')
            .eq('user_id', detailId).order('created_at', { ascending: false }).limit(50),
          admin.from('organizations').select('id, name, status').eq('owner_id', detailId).limit(20),
        ])
        // Referral activity (as affiliate)
        const { data: codes } = await admin
          .from('referral_codes')
          .select('id, code, kind, active, created_at')
          .eq('user_id', detailId)
        const refs: any[] = []
        let totalCommission = 0
        for (const code of codes ?? []) {
          const { data: codeRefs } = await admin.from('referrals').select('id, referred_user_id, attributed_at, source_channel').eq('referral_code_id', code.id)
          for (const r of codeRefs ?? []) {
            const { data: comms } = await admin.from('referral_commissions').select('base_amount, commission_amount, status').eq('referral_id', r.id)
            for (const c of comms ?? []) totalCommission += Number(c.commission_amount || 0)
            refs.push({ ...r, referral_code_id: code.id, referral_code: code.code, commissions: comms ?? [] })
          }
        }
        // Referrals received (as referred user)
        const { data: referredBy } = await admin.from('referrals').select('id, referrer_id, attributed_at').eq('referred_user_id', detailId)
        return {
          section: 'user_detail',
          profile: { ...prof, email: emailRow?.email ?? null, email_confirmed_at: emailRow?.email_confirmed_at ?? null },
          projects: projects.data ?? [],
          organizations: orgs.data ?? [],
          referralCodes: codes ?? [],
          referralsMade: refs,
          referralCommissionEarned: Math.round(totalCommission * 100) / 100,
          referredBy: referredBy ?? [],
        }
      }

      case 'agencies': {
        let query = select('organizations', 'id, name, slug, type, plan, owner_id, status, team_size, created_at').order('created_at', { ascending: false })
        if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return { section: 'agencies', rows: data ?? [], count: count ?? 0, offset, limit }
      }

      case 'projects': {
        let query = select('projects', 'id, title, project_type, billing_interval, currency, client_price, fulfillment_cost, seller_profit, payment_method, payment_status, status, created_at, user_id, organization_id')
          .order('created_at', { ascending: false })
        if (q) query = query.or(`title.ilike.%${q}%,project_type.ilike.%${q}%,payment_status.ilike.%${q}%`)
        const ps = searchParams.get('payment_status')
        if (ps) query = query.eq('payment_status', ps)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return { section: 'projects', rows: data ?? [], count: count ?? 0, offset, limit }
      }

      case 'payments': {
        // Payment landscape derived from projects (no payment provider exists yet — foundation only)
        const [pending, confirmed, failed, disputed] = await Promise.all([
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_confirmed_at, created_at')
            .eq('payment_status', 'PAYMENT_PENDING').order('created_at', { ascending: false }),
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_confirmed_at, created_at')
            .eq('payment_status', 'PAYMENT_CONFIRMED').order('payment_confirmed_at', { ascending: false }),
          select('projects', 'id, title, client_price, payment_method, payment_status, created_at')
            .eq('payment_status', 'PAYMENT_FAILED'),
          select('projects', 'id, title, client_price, payment_method, payment_status, created_at')
            .eq('payment_status', 'PAYMENT_DISPUTED'),
        ])
        return {
          section: 'payments',
          pending: pending.data ?? [],
          confirmed: confirmed.data ?? [],
          failed: failed.data ?? [],
          disputed: disputed.data ?? [],
        }
      }

      case 'affiliates': {
        // affiliates = users with referral codes
        let query = admin
          .from('referral_codes')
          .select('id, user_id, code, kind, active, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
        if (q) query = query.ilike('code', `%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        // Enrich each code with referral/commission counts + user info
        const rows = await Promise.all(
          (data ?? []).map(async (row: any) => {
            const [{ count: rCount }, { count: eCount }, { data: refs }] = await Promise.all([
              admin.from('referrals').select('*', { count: 'exact', head: true }).eq('referral_code_id', row.id),
              admin.from('referral_commissions').select('*', { count: 'exact', head: true }).eq('referral_id', row.id),
              admin.from('referrals').select('id, referred_user_id, attributed_at, source_channel').eq('referral_code_id', row.id),
            ])
            const { data: prof } = await admin
              .from('profiles')
              .select('full_name, username, role')
              .eq('id', row.user_id)
              .single()
            const commissions = await Promise.all(
              (refs ?? []).map(async (r: any) => {
                const { data: comms } = await admin
                  .from('referral_commissions')
                  .select('id, base_amount, commission_rate, commission_amount, currency, status, created_at, available_at')
                  .eq('referral_id', r.id)
                return { ...r, commissions: comms ?? [] }
              }),
            )
            return { ...row, referrals: commissions, referralCount: rCount ?? 0, commissionCount: eCount ?? 0, profile: prof }
          }),
        )
        return { section: 'affiliates', rows, count: count ?? 0, offset, limit }
      }

      case 'commissions': {
        let query = admin
          .from('referral_commissions')
          .select('id, referral_id, project_id, base_amount, commission_rate, commission_amount, currency, status, created_at, available_at, reviewed_at, paid_at')
          .order('created_at', { ascending: false })
        const status = searchParams.get('status')
        if (status) query = query.eq('status', status)
        if (q) query = query.ilike('id', `%${q}%`)
        const { data, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        const rows = await Promise.all(
          (data ?? []).map(async (row: any) => {
            const { data: ref } = await admin
              .from('referrals')
              .select('id, referrer_id, referred_user_id, referral_code_id')
              .eq('id', row.referral_id)
              .single()
            const { data: code } = await admin.from('referral_codes').select('code, user_id').eq('id', ref?.referral_code_id ?? '').maybeSingle()
            const { data: refProf } = await admin.from('profiles').select('full_name, username').eq('id', ref?.referrer_id ?? '').maybeSingle()
            const { data: proj } = await admin.from('projects').select('title, client_price, payment_status').eq('id', row.project_id ?? '').maybeSingle()
            return { ...row, referralCode: code?.code ?? null, referrerProfile: refProf, project: proj }
          }),
        )
        return { section: 'commissions', rows, offset, limit }
      }

      case 'services': {
        let query = select('services', 'id, category_id, title, slug, description, active, base_cost_one_time, base_cost_monthly, base_cost_annual, created_at, updated_at')
          .order('created_at', { ascending: false })
        if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return { section: 'services', rows: data ?? [], count: count ?? 0, offset, limit }
      }

      case 'freelancers': {
        let query = select('freelancers', 'id, name, avatar_url, bio, specialty, skills, tools, starting_price, delivery_time, active, created_at')
          .order('created_at', { ascending: false })
        if (q) query = query.or(`name.ilike.%${q}%,specialty.ilike.%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return { section: 'freelancers', rows: data ?? [], count: count ?? 0, offset, limit }
      }

      case 'audit': {
        let query = select('audit_logs', 'id, actor_id, actor_email, action, entity, entity_id, old_value, new_value, created_at')
          .order('created_at', { ascending: false })
        if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%,actor_email.ilike.%${q}%`)
        const entity = searchParams.get('entity')
        if (entity) query = query.eq('entity', entity)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        return { section: 'audit', rows: data ?? [], count: count ?? 0, offset, limit }
      }

      case 'settings': {
        const { data: programConfig } = await admin.from('program_config').select('*').eq('id', 1).maybeSingle()
        const { data: tiers } = await admin.from('referral_tiers').select('*').eq('active', true).order('min_active_referrals', { ascending: true })
        const { data: planConfig } = await admin.from('plan_config').select('*').eq('active', true)
        return {
          section: 'settings',
          programConfig: programConfig ?? null,
          tiers: tiers ?? [],
          plans: planConfig ?? [],
        }
      }

      default:
        return { error: 'UNKNOWN_SECTION', section }
    }
  })
}
