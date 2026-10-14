'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Crown, Receipt, Sparkles } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { type OrgRow } from '../../../lib/orgs'
import { PLAN_CONFIG, membersLabelFor, planById } from '../../../lib/planConfig'
import DodoPlanCheckout from '../../../components/DodoPlanCheckout'

type DodoOrder = {
  id: string
  transaction_id: string
  status: string
  amount: number
  currency_code: string
  plan_id: string | null
  subscription_id: string | null
  created_at: string
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [orders, setOrders] = useState<DodoOrder[]>([])
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [focusPlan, setFocusPlan] = useState<string | null>(null)

  async function openPortal() {
    setPortalLoading(true)
    setPortalError(null)
    const response = await fetch('/api/dodo/portal', { method: 'POST', credentials: 'include' })
    const payload = await response.json().catch(() => ({}))
    if (response.ok && payload.url) window.location.assign(payload.url)
    else setPortalError(payload.error === 'NO_DODO_CUSTOMER' ? 'Your Dodo customer portal will be available after the first completed payment.' : 'Unable to open the Dodo Payments portal right now.')
    setPortalLoading(false)
  }

  useEffect(() => {
    const planQ = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null
    if (planQ) setFocusPlan(planQ)
  }, [])

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
      const ordersResponse = await fetch('/api/dodo/orders', { credentials: 'include' })
      const ordersPayload = await ordersResponse.json().catch(() => ({}))
      if (!cancelled) setOrders(ordersPayload.orders ?? [])
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
    () => (plan ? PLAN_CONFIG.filter((p) => p.id !== plan.id && p.id !== 'SOLO') : []),
    [plan],
  )

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]" aria-label="Back to dashboard">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Billing</h1>
              <p className="text-sm text-[#849792]">Plan and usage · desktop & mobile</p>
            </div>
          </div>
          {orgs.length > 1 && (
            <select
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="max-w-[40%] rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm text-[#c1cbc7] outline-none focus:border-[rgba(216,180,90,0.55)]"
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
            <div className={`card mt-8 rounded-3xl p-5 sm:p-7 ${plan.highlight ? 'border-[rgba(216,180,90,0.50)]' : ''}`}>
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
                    {!plan.enterprise && <span className="text-sm font-semibold text-[#849792]">/month</span>}
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
                  <div className="mt-1 text-sm font-bold text-[#d9e0dc]">{plan.price > 0 ? 'Active subscription' : 'Free plan · no charge'}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-4 py-3 text-xs text-[#b9a76f]">
                <span>Manage subscriptions, payment methods, invoices, and transaction history in Dodo Payments.</span>
                <button type="button" onClick={openPortal} disabled={portalLoading} className="rounded-full border border-[rgba(216,180,90,0.40)] px-3 py-1.5 font-bold text-[#e4c979] hover:bg-[rgba(216,180,90,0.12)] disabled:opacity-50">{portalLoading ? 'Opening…' : 'Manage billing'}</button>
              </div>
              {portalError && <p className="mt-2 text-xs text-[#e89a8d]">{portalError}</p>}
            </div>

            <div className="card mt-6 rounded-3xl p-5 sm:p-7">
              <h2 className="font-display text-lg font-bold">What&rsquo;s included</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-[#c5d2cc]">
                    <Check size={15} className="mt-1 shrink-0 text-[#d8b45a]" /> {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 mb-6 grid gap-4">
              <h2 className="font-display text-lg font-bold">Upgrade options</h2>
              <p className="text-xs text-[#849792]">Choose International payment (Paddle) or Local payment (SpaceRemit) on any paid plan.</p>
              {otherPlans.map((p) => (
                <div
                  key={p.id}
                  className={`card rounded-3xl p-5 sm:p-6 ${
                    focusPlan === p.id
                      ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.08)]'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-bold">{p.displayName}</h3>
                    <span className="shrink-0 text-sm font-bold text-[#d8b45a]">
                      {p.enterprise ? 'Custom' : `$${p.price}/mo`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#849792]">{membersLabelFor(p)}</p>
                  {p.id === 'ENTERPRISE' ? (
                    <a
                      href="mailto:dropverseagency@gmail.com?subject=Enterprise%20Upgrade"
                      className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] py-3.5 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)]"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <DodoPlanCheckout planId={p.id} organizationId={org.id} label={`Upgrade to ${p.displayName}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] py-3 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] disabled:cursor-not-allowed disabled:opacity-50" />
                  )}
                </div>
              ))}
            </div>

            <div className="card mb-10 rounded-3xl p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-display text-lg font-bold">Order history</h2><p className="mt-1 text-xs text-[#849792]">Your Dodo transactions and subscription status.</p></div>
                <Receipt size={19} className="text-[#d8b45a]" />
              </div>
              {orders.length === 0 ? <p className="mt-5 text-sm text-[#718781]">No Dodo orders have been recorded yet.</p> : <div className="mt-5 space-y-3">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3"><div><div className="text-sm font-semibold text-[#d9e0dc]">{order.plan_id ? `${order.plan_id} subscription` : 'Service order'}</div><div className="mt-1 text-[11px] text-[#718781]">{new Date(order.created_at).toLocaleDateString()} · {order.transaction_id}</div></div><div className="text-right"><div className="text-sm font-bold text-[#e4c979]">{order.currency_code} {Number(order.amount).toFixed(2)}</div><div className="mt-1 text-[11px] uppercase tracking-wider text-[#8fa29c]">{order.status}</div></div></div>)}</div>}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
