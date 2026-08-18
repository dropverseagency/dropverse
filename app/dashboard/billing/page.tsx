'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Crown, Receipt, Sparkles } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { type OrgRow } from '../../../lib/orgs'
import { PLAN_CONFIG, membersLabelFor, planById } from '../../../lib/planConfig'

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
        if (data.session) { session = data.session; break }
        if (i < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session || cancelled) { window.location.assign('/login?redirect=%2Fdashboard%2Fbilling'); return }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at')
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
    return () => { cancelled = true }
  }, [])

  const org = orgs.find((o) => o.id === activeOrgId) ?? null
  const plan = org ? planById(org.plan as never) : PLAN_CONFIG[0]

  const otherPlans = useMemo(
    () => (plan ? PLAN_CONFIG.filter((p) => p.id !== plan.id) : []),
    [plan],
  )

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]" aria-label="Back to dashboard">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Billing</h1>
              <p className="text-sm text-[#849792]">Plan &amp; usage overview</p>
            </div>
          </div>
          {orgs.length > 1 && (
            <select
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm text-[#c1cbc7] outline-none focus:border-[rgba(216,180,90,0.55)]"
              aria-label="Switch workspace"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0a2926]">{o.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading billing…</div>
        ) : !org ? (
          <div className="card mt-10 rounded-3xl p-8 text-center">
            <Receipt size={30} className="mx-auto text-[#6e817c]" />
            <p className="mt-4 font-semibold text-[#c1cbc7]">No workspace yet</p>
            <Link href="/dashboard/create-org" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">
              Create a workspace
            </Link>
          </div>
        ) : (
          <>
            {/* Current plan */}
            <div className={`card mt-8 rounded-3xl p-7 ${plan.highlight ? 'border-[rgba(216,180,90,0.50)]' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${plan.highlight ? 'bg-[#d8b45a] text-[#10221f]' : 'border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]'}`}>
                    {plan.enterprise ? <Sparkles size={20} /> : plan.price > 0 ? <Crown size={20} /> : <Receipt size={20} />}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[.18em] text-[#849792]">Current plan</p>
                    <h2 className="font-display mt-1 text-2xl font-extrabold">{plan.displayName}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-extrabold text-[#d8b45a]">
                    {plan.enterprise ? 'Custom' : `$${plan.price}`}
                    {!plan.enterprise && <span className="text-sm font-semibold text-[#849792]">/{plan.price === 0 ? 'month' : 'month'}</span>}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3.5">
                  <div className="text-xs text-[#718781]">Team members</div>
                  <div className="mt-1 text-sm font-bold text-[#d9e0dc]">
                    {memberCount} / {plan.maxMembers === null ? 'Unlimited' : plan.maxMembers}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3.5">
                  <div className="text-xs text-[#718781]">Billing status</div>
                  <div className="mt-1 text-sm font-bold text-[#6fbf73]">Active · payment coming soon</div>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-4 py-3 text-xs text-[#b9a76f]">
                Payment processing is not live yet — no charges are applied. You can upgrade and your
                workspace configuration is saved; billing will activate when payments launch.
              </div>
            </div>

            {/* What's included */}
            <div className="card mt-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold">What&rsquo;s included</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-[#c5d2cc]">
                    <Check size={15} className="mt-1 shrink-0 text-[#d8b45a]" /> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade options */}
            <div className="mt-8 mb-8 grid gap-4 sm:grid-cols-2">
              {otherPlans.map((p) => (
                <div key={p.id} className="card rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">{p.displayName}</h3>
                    <span className="text-sm font-bold text-[#d8b45a]">
                      {p.enterprise ? 'Custom' : `$${p.price}/mo`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#849792]">{membersLabelFor(p)}</p>
                  {p.id === 'ENTERPRISE' ? (
                    <a
                      href="mailto:dropverseagency@gmail.com?subject=Enterprise%20Upgrade"
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] py-3 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)]"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-semibold text-[#687d76]" title="Payments coming soon">
                      Upgrade — coming soon
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
