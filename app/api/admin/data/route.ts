import { NextRequest } from 'next/server'
import { adminClient, adminJson, parsePage } from '@/lib/adminCore'

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
      let qry: any = admin.from(table).select('*', { count: 'exact', head: true })
      if (eq) qry = qry.eq(eq.column, eq.value)
      const { count } = await qry
      return count ?? 0
    }

    const select = (table: string, columns: string) => admin.from(table).select(columns)

    switch (section) {
      case 'overview': {
        const [
          users, projects, agencies, paymentsConfirmed, paymentsPending,
          affiliatesActive, commissionsPending, commissionsPaid, publishedServices, openProjects,
        ] = await Promise.all([
          countOf('profiles', null),
          countOf('projects', null),
          countOf('organizations', null),
          countOf('projects', { column: 'payment_status', value: 'PAYMENT_CONFIRMED' }),
          countOf('projects', { column: 'payment_status', value: 'PAYMENT_PENDING' }),
          countOf('referrals', { column: 'status', value: 'active' }),
          countOf('referral_commissions', { column: 'status', value: 'pending' }),
          countOf('referral_commissions', { column: 'status', value: 'paid' }),
          countOf('services', { column: 'active', value: 'true' }),
          countOf('projects', { column: 'payment_status', value: 'PAYMENT_PENDING' }),
        ])
        const { data: revRows } = await admin
          .from('referral_commissions')
          .select('base_amount')
          .in('status', ['approved', 'available', 'paid'])
        const dvRevenue = (revRows ?? []).reduce((s, r) => s + Number(r.base_amount || 0), 0)
        const { data: payoutRows } = await admin.from('payout_requests').select('amount').eq('status', 'paid')
        const payouts = (payoutRows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
        const { data: recentAudit } = await admin
          .from('audit_logs')
          .select('id, actor_id, actor_email, action, entity, entity_id, created_at')
          .order('created_at', { ascending: false })
          .limit(10)
        const { data: recentProjects } = await admin
          .from('projects')
          .select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_status, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
        return {
          section: 'overview',
          totals: {
            users,
            projects,
            agencies,
            paymentsConfirmed,
            paymentsPending,
            activeReferrals: affiliatesActive,
            commissionsPending,
            commissionsPaid,
            publishedServices,
            openProjects,
            dvRevenue: Math.round(dvRevenue * 100) / 100,
            totalPayouts: Math.round(payouts * 100) / 100,
          },
          recentAudit: recentAudit ?? [],
          recentProjects: recentProjects ?? [],
          me: { userId, email },
        }
      }

      case 'users': {
        let query = select('profiles', 'id, full_name, username, phone, telegram_username, avatar_url, role, user_type, user_types, username_cooldown_at, created_at').order('created_at', { ascending: false })
        if (q) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        const rows = (data ?? []) as unknown as { id: string; [k: string]: unknown }[]
        // Fetch email directly from Supabase Auth by matching profile UUID.
        const [rowsWithEmails, freelancerProfiles] = await Promise.all([
          Promise.all(rows.map(async (row) => {
            const { data: authResult, error: authError } = await admin.auth.admin.getUserById(row.id)
            if (authError) console.error('[admin/users] Auth email lookup failed', row.id, authError.message)
            return { ...row, email: authResult?.user?.email ?? null }
          })),
          rows.length
            ? admin.from('freelancer_profiles').select('user_id, category').in('user_id', rows.map((row) => row.id))
            : Promise.resolve({ data: [], error: null }),
        ])
        if (freelancerProfiles.error) console.error('[admin/users] Freelancer profile lookup failed', freelancerProfiles.error.message)
        const nicheByUserId = new Map((freelancerProfiles.data ?? []).map((profile: { user_id: string; category: string | null }) => [profile.user_id, profile.category]))
        const roleLabels: Record<string, string> = {
          freelancer: 'Freelancer',
          drop_servicer: 'Drop Servicer',
          dropservicer: 'Drop Servicer',
          lead_generator: 'Lead Generator',
          lead_gen: 'Lead Generator',
        }
        const enrichedRows = (rowsWithEmails as { id: string; user_types?: unknown; user_type?: unknown; [key: string]: unknown }[]).map((row) => {
          const selectedTypes = Array.isArray(row.user_types) ? row.user_types as string[] : []
          const rawTypes = selectedTypes.length ? selectedTypes : (typeof row.user_type === 'string' && row.user_type ? [row.user_type] : [])
          const registeredAs = rawTypes.map((type) => roleLabels[type.toLowerCase()] ?? type.replace(/[_-]+/g, ' ').replace(/\\b\\w/g, (char) => char.toUpperCase()))
          const freelancerNiche = nicheByUserId.get(row.id) ?? null
          if (!registeredAs.length && freelancerNiche) registeredAs.push('Freelancer')
          return { ...row, registered_as: registeredAs, freelancer_niche: freelancerNiche }
        })
        return { section: 'users', rows: enrichedRows, count: count ?? 0, offset, limit }
      }

      case 'user_detail': {
        const detailId = (searchParams.get('id') ?? '').trim()
        if (!detailId) return { error: 'MISSING_ID', section: 'user_detail' }
        const { data: prof, error: profError } = await admin
          .from('profiles')
          .select('id, full_name, username, phone, telegram_username, avatar_url, role, user_type, user_types, username_cooldown_at, created_at')
          .eq('id', detailId)
          .maybeSingle()
        if (profError) throw profError
        if (!prof) return { error: 'USER_NOT_FOUND', section: 'user_detail' }
        const { data: authResult, error: authError } = await admin.auth.admin.getUserById(detailId)
        if (authError) console.error('[admin/user_detail] Auth user lookup failed', detailId, authError.message)
        const emailRow = authResult?.user
          ? { email: authResult.user.email ?? null, email_confirmed_at: authResult.user.email_confirmed_at ?? null }
          : null
        const [projects, orgs, freelancerProfile, freelancerLinks] = await Promise.all([
          admin.from('projects').select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_status, status, created_at')
            .eq('user_id', detailId).order('created_at', { ascending: false }).limit(50),
          admin.from('organizations').select('id, name, status').eq('owner_id', detailId).limit(20),
          admin.from('freelancer_profiles').select('user_id, display_name, category, bio, created_at, updated_at').eq('user_id', detailId).maybeSingle(),
          admin.from('freelancer_links').select('id, platform, url, created_at').eq('user_id', detailId).order('created_at', { ascending: true }),
        ])
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
        const { data: referredBy } = await admin.from('referrals').select('id, referrer_id, attributed_at').eq('referred_user_id', detailId)
        return {
          section: 'user_detail',
          profile: { ...prof, email: emailRow?.email ?? null, email_confirmed_at: emailRow?.email_confirmed_at ?? null },
          projects: projects.data ?? [],
          organizations: orgs.data ?? [],
          freelancerProfile: freelancerProfile.data ?? null,
          freelancerLinks: freelancerLinks.data ?? [],
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
        let query = select('projects', 'id, title, project_type, billing_interval, currency, client_price, fulfillment_cost, seller_profit, payment_method, payment_status, status, operations_status, assignment_status, assigned_freelancer_id, freelancer_payout_status, freelancer_payout_amount, delivery_due_at, created_at, user_id, organization_id')
          .order('created_at', { ascending: false })
        if (q) query = query.or(`title.ilike.%${q}%,project_type.ilike.%${q}%,payment_status.ilike.%${q}%`)
        const ps = searchParams.get('payment_status')
        if (ps) query = query.eq('payment_status', ps)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
        const ids = (data ?? []).map((row: any) => row.id)
        const { data: disputes } = ids.length ? await admin.from('project_disputes').select('*').in('project_id', ids).in('status', ['open','under_review']) : { data: [] }
        const disputeByProject = new Map((disputes ?? []).map((row: any) => [row.project_id, row]))
        return { section: 'projects', rows: (data ?? []).map((row: any) => ({ ...row, open_dispute: disputeByProject.get(row.id) ?? null })), count: count ?? 0, offset, limit }
      }

      case 'payments': {
        const [pending, confirmed, failed, disputed, paddleRes, invoicesRes] = await Promise.all([
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_provider, payment_confirmed_at, payment_transaction_id, created_at')
            .eq('payment_status', 'PAYMENT_PENDING').order('created_at', { ascending: false }).limit(100),
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_provider, payment_confirmed_at, payment_transaction_id, created_at')
            .eq('payment_status', 'PAYMENT_CONFIRMED').order('payment_confirmed_at', { ascending: false }).limit(100),
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_provider, created_at')
            .eq('payment_status', 'PAYMENT_FAILED').limit(50),
          select('projects', 'id, title, client_price, payment_method, payment_status, payment_provider, created_at')
            .eq('payment_status', 'PAYMENT_DISPUTED').limit(50),
          admin
            .from('paddle_orders')
            .select('id, transaction_id, user_id, status, amount, currency_code, customer_email, plan_id, sample_id, organization_id, metadata, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(150),
          admin
            .from('invoices')
            .select('id, invoice_number, amount, currency, status, client_name, client_email, project_id, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(100),
        ])

        const pendingRows = pending.data ?? []
        const confirmedRows = confirmed.data ?? []
        const paddleOrders = paddleRes.data ?? []
        const invoices = invoicesRes.data ?? []

        const confirmedVolume = confirmedRows.reduce((s: number, r: any) => s + Number(r.client_price || 0), 0)
        const pendingVolume = pendingRows.reduce((s: number, r: any) => s + Number(r.client_price || 0), 0)
        const paddleCompleted = paddleOrders.filter((o: any) => {
          const st = String(o.status || '').toLowerCase()
          return st === 'completed' || st === 'paid' || st === 'billed'
        })
        const paddleCompletedVolume = paddleCompleted.reduce((s: number, o: any) => s + Number(o.amount || 0), 0)
        const invoicesPaid = invoices.filter((i: any) => String(i.status).toUpperCase() === 'PAID')
        const invoicesPaidVolume = invoicesPaid.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)

        return {
          section: 'payments',
          pending: pendingRows,
          confirmed: confirmedRows,
          failed: failed.data ?? [],
          disputed: disputed.data ?? [],
          paddleOrders,
          invoices,
          confirmedVolume: Math.round(confirmedVolume * 100) / 100,
          pendingVolume: Math.round(pendingVolume * 100) / 100,
          paddleCompletedCount: paddleCompleted.length,
          paddleCompletedVolume: Math.round(paddleCompletedVolume * 100) / 100,
          invoicesPaidCount: invoicesPaid.length,
          invoicesOpenCount: invoices.length - invoicesPaid.length,
          invoicesPaidVolume: Math.round(invoicesPaidVolume * 100) / 100,
          paddleError: paddleRes.error?.message ?? null,
          invoicesError: invoicesRes.error?.message ?? null,
        }
      }

      case 'affiliates': {
        let query = admin
          .from('referral_codes')
          .select('id, user_id, code, kind, active, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
        if (q) query = query.ilike('code', `%${q}%`)
        const { data, count, error } = await query.range(offset, offset + limit - 1)
        if (error) throw error
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

      case 'samples': {
        const { data, error } = await admin
          .from('work_samples')
          .select('id, title, description, media_url, thumbnail_url, featured, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) return { section: 'samples', rows: [], error: error.message }
        return { section: 'samples', rows: data ?? [] }
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
