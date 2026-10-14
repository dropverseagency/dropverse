'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Crown, Receipt, Sparkles } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { type OrgRow } from '../../../lib/orgs'
import { PLAN_CONFIG, membersLabelFor, planById } from '../../../lib/planConfig'
import DashboardShell, { DEFAULT_DASHBOARD_NAV } from '../../../components/DashboardShell'

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      let session = null
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          session = data.session
          break
        }
        if (i < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session || cancelled) {
        window.location.assign('/login?redirect=%2Fdashboard%2Fbilling')
        return
      }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select(
          'id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at',
        )
        .eq('status', 'active')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false })
      if (cancelled) return
      const orgList = (orgRows as OrgRow[] | null) ?? []
      setOrgs(orgList)
      if (orgList.length > 0) {
        setActiveOrgId(orgList[0].id)
        const { count } = await supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgList[0].id)
          .eq('status', 'active')
        setMemberCount(count ?? 0)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const org = orgs.find((o) => o.id === activeOrgId) ?? null
  const plan = org ? planById(org.plan as never) : PLAN_CONFIG[0]

  const otherPlans = useMemo(() => (plan ? PLAN_CONFIG.filter((p) => p.id !== plan.id) : []), [plan])

  return (
    <DashboardShell nav={DEFAULT_DASHBOARD_NAV} title="Billing">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">Billing</h1>
              <p className="text-sm text-muted-foreground">Plan and usage</p>
            </div>
          </div>
          {orgs.length > 1 && (
            <select
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              aria-label="Switch workspace"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="bg-card">
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-muted-foreground">Loading billing…</div>
        ) : !org ? (
          <div className="card mt-10 rounded-3xl p-8 text-center">
            <Receipt size={30} className="mx-auto text-muted-foreground" />
            <p className="mt-4 font-semibold text-foreground">No workspace yet</p>
            <Link
              href="/dashboard/create-org"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Create a workspace
            </Link>
          </div>
        ) : (
          <>
            <div className={`card mt-8 rounded-3xl p-7 ${plan.highlight ? 'border border-primary/50' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      plan.highlight
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-primary/30 bg-primary/10 text-primary'
                    }`}
                  >
                    {plan.enterprise ? (
                      <Sparkles size={20} />
                    ) : plan.price > 0 ? (
                      <Crown size={20} />
                    ) : (
                      <Receipt size={20} />
                    )}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[.18em] text-muted-foreground">Current plan</p>
                    <h2 className="font-display mt-1 text-2xl font-extrabold text-foreground">{plan.displayName}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-extrabold text-primary">
                    {plan.enterprise ? 'Custom' : `$${plan.price}`}
                    {!plan.enterprise && <span className="text-sm font-semibold text-muted-foreground">/month</span>}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-muted px-4 py-3.5">
                  <div className="text-xs text-muted-foreground">Team members</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {memberCount} / {plan.maxMembers === null ? 'Unlimited' : plan.maxMembers}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-muted px-4 py-3.5">
                  <div className="text-xs text-muted-foreground">Billing status</div>
                  <div className="mt-1 text-sm font-bold text-foreground">Free plan · no charge</div>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-xs text-muted-foreground">
                Paid upgrades are not open yet. Solo stays free and nothing is charged from this page. Email
                dropverseagency@gmail.com if you need an Agency workspace before checkout launches.
              </div>
            </div>

            <div className="card mt-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold text-foreground">What&rsquo;s included</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check size={15} className="mt-1 shrink-0 text-primary" /> {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8 mt-8 grid gap-4 sm:grid-cols-2">
              {otherPlans.map((p) => (
                <div key={p.id} className="card rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">{p.displayName}</h3>
                    <span className="text-sm font-bold text-primary">
                      {p.enterprise ? 'Custom' : `$${p.price}/mo`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{membersLabelFor(p)}</p>
                  {p.id === 'ENTERPRISE' ? (
                    <a
                      href="mailto:dropverseagency@gmail.com?subject=Enterprise%20Upgrade"
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 py-3 text-sm font-bold text-primary transition hover:border-primary/60"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
                      Paid upgrade not open
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
