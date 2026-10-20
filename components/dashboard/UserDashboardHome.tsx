'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Layers, Wallet, ArrowRight, Clock, CheckCircle2, Receipt, ChevronDown, Plus,
  Eye, Trash2, X, Link2, Copy, FileText,
} from 'lucide-react'
import PlanUpgradeBanner from '../PlanUpgradeBanner'
import MyCharts from './MyCharts'
import { createClient } from '../../lib/supabase'
import { type OrgRow } from '../../lib/orgs'
import { PLAN_CONFIG, planById, type OrgRole } from '../../lib/planConfig'
import { formatUsd } from '../../lib/projectConfig'

type Profile = { id: string; full_name: string | null; role: string }
type ProjectRow = {
  id: string; title: string; project_type: string; billing_interval: string
  client_price: number | string; fulfillment_cost: number | string; seller_profit: number | string
  payment_method: string; payment_status: string; status: string; created_at: string
}
type Tx = { type: string; label: string; amount: number; status: string; date: string; detail?: string; projectId?: string }

export default function UserDashboardHome() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null)
  const [pendingPayout, setPendingPayout] = useState(0)
  const [paidPayout, setPaidPayout] = useState(0)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [dashLink, setDashLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const baseHost = typeof window !== 'undefined' ? window.location.origin : 'https://dropverse-nu.vercel.app'
  const host = typeof window !== 'undefined' ? window.location.host : 'dropverse-nu.vercel.app'

  const activeOrg = useMemo(() => orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null, [orgs, activeOrgId])
  const orgPlan = activeOrg ? planById(activeOrg.plan as never) : PLAN_CONFIG[0]
  const projectStats = useMemo(() => {
    const paid = projects.filter((p) => p.payment_status === 'PAYMENT_CONFIRMED').length
    return { paid, open: projects.length - paid, profit: projects.reduce((s, p) => s + Number(p.seller_profit || 0), 0) }
  }, [projects])

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
      if (!session || cancelled) { window.location.assign('/login?redirect=%2Fdashboard'); return }
      setSessionToken(session.access_token)
      const { data: profileData } = await supabase.from('profiles').select('id, full_name, role').eq('id', session.user.id).single()
      if (cancelled) return
      if (profileData) setProfile(profileData as Profile)
      if (profileData?.role === 'admin') setIsAdmin(true)

      const meRes = await fetch('/api/affiliate/me', { credentials: 'include' })
      if (meRes.ok) {
        const j = await meRes.json()
        if (!cancelled && j?.code) setDashLink(j.code)
      }
      try {
        const payRes = await fetch('/api/payouts/me', { credentials: 'include' })
        if (payRes.ok) {
          const pay = await payRes.json()
          if (!cancelled && pay?.balances) {
            setAvailableBalance(Number(pay.balances.available || 0))
            setPendingPayout(Number(pay.balances.pending || 0) + Number(pay.balances.processing || 0))
            setPaidPayout(Number(pay.balances.totalPaid || 0))
            setNextPayoutDate(pay.policy?.nextScheduledProcessingDate ?? null)
          }
        }
      } catch {}

      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at')
        .eq('status', 'active')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false })
      if (cancelled) return
      const orgList = (orgRows as OrgRow[] | null) ?? []
      setOrgs(orgList)
      if (orgList.length) {
        const { data: mems } = await supabase.from('organization_members').select('organization_id, role, status').eq('user_id', session.user.id)
        if (mems?.length) setOrgRole((mems[0].role as OrgRole) ?? null)
        setActiveOrgId(orgList[0].id)
      }

      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('id, amount, status, requested_at')
        .eq('user_id', session.user.id)
        .order('requested_at', { ascending: false })
        .limit(30)
      const { data: projRows } = await supabase
        .from('projects')
        .select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_method, payment_status, status, created_at')
        .order('created_at', { ascending: false })
        .limit(25)
      if (cancelled) return
      setProjects((projRows as ProjectRow[] | null) ?? [])

      const rows: Tx[] = []
      for (const p of payouts || []) {
        rows.push({ type: 'payout', label: 'Payout request', amount: -Number(p.amount), status: p.status, date: p.requested_at })
      }
      for (const p of (projRows as ProjectRow[] | null) || []) {
        rows.push({ type: 'project', label: 'Created project', amount: Number(p.seller_profit || 0), status: p.payment_status.toLowerCase().replace(/_/g, ' '), date: p.created_at, detail: p.title, projectId: p.id })
      }
      rows.sort((a, b) => (a.date < b.date ? 1 : -1))
      setTransactions(rows.slice(0, 10))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function deleteProject(id: string) {
    if (!confirm('Delete this project permanently?')) return
    setDeletingId(id)
    const { error } = await createClient().from('projects').delete().eq('id', id)
    setDeletingId(null)
    if (error) return
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (selectedProject?.id === id) setSelectedProject(null)
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Workspace</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-white">{activeOrg?.name ?? 'Overview'}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8fa29c]">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}. Projects, earnings, and payout requests in one place.
        </p>
      </div>

      <PlanUpgradeBanner orgs={orgs} activeOrgId={activeOrgId} sessionToken={sessionToken} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {activeOrg && (
            <div className="relative">
              <button onClick={() => setSwitcherOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-[#2c403a] bg-[#0b2420] px-3 py-1.5 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d8b45a] text-xs font-bold text-[#10221f]">{activeOrg.name.trim().charAt(0).toUpperCase()}</span>
                <span className="max-w-[10rem] truncate">{activeOrg.name}</span>
                <ChevronDown size={14} />
              </button>
              {switcherOpen && (
                <div className="absolute left-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#1e3d36] bg-[#0a2926] shadow-xl">
                  {orgs.map((o) => (
                    <button key={o.id} onClick={() => { setActiveOrgId(o.id); setSwitcherOpen(false) }} className={`flex w-full px-4 py-3 text-left text-sm hover:bg-white/5 ${o.id === activeOrgId ? 'text-[#e4c979]' : ''}`}>
                      {o.name}
                    </button>
                  ))}
                  <Link href="/dashboard/create-org" className="flex border-t border-white/5 px-4 py-3 text-sm font-semibold text-[#d8b45a]">Create an Agency</Link>
                </div>
              )}
            </div>
          )}
          <span className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3 py-1.5 text-xs font-bold text-[#e4c979]">
            {activeOrg ? `${activeOrg.type === 'personal' ? 'Personal' : orgPlan.displayName} plan` : '—'}
          </span>
          {orgRole && <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#9aaca6]">Role: {orgRole}</span>}
          {isAdmin && <Link href="/admin" className="rounded-full border border-[#5a4a28] bg-[#2a2414] px-3 py-1.5 text-xs font-bold text-[#f0d98b]">Admin</Link>}
        </div>
        <Link href="/dashboard/create-project" className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-4 py-2.5 text-sm font-bold text-[#10221f]">
          <Plus size={16} /> New project
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-12 text-center text-sm text-[#718781]">Loading your workspace…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Available to withdraw" value={formatUsd(availableBalance)} hint="Eligible balance" accent />
            <Kpi label="Pending / processing" value={formatUsd(pendingPayout)} hint="Open requests" />
            <Kpi label="Total paid out" value={formatUsd(paidPayout)} hint="Completed" />
            <Kpi label="Projects" value={String(projects.length)} hint={`${projectStats.paid} paid · ${projectStats.open} open`} />
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[rgba(216,180,90,0.28)] bg-[rgba(216,180,90,0.06)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#f0f4f2]">Request a payout</p>
              <p className="mt-1 text-xs text-[#81948e]">
                Available: <span className="font-semibold text-[#e4c979]">{formatUsd(availableBalance)}</span>
                {nextPayoutDate ? <> · Next processing {nextPayoutDate}</> : null}
                . $2 fee per successful request.
              </p>
            </div>
            <Link href="/dashboard/payouts" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">
              Open payouts <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Action href="/dashboard/create-project" title="New project" text="Create client work and track fulfillment." />
            <Action href="/dashboard/payouts" title="Payouts" text="Balances, withdrawal requests, history." />
            <Action href="/dashboard/affiliate" title="Affiliate" text="Referral link and commissions." />
            <Action href="/dashboard/billing" title="Billing" text="Plan and upgrades." />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-5 lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#849792]">Referral link</p>
              {dashLink ? (
                <>
                  <p className="mt-3 break-all font-mono text-sm">{host}/r/{dashLink}</p>
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${baseHost}/r/${dashLink}`); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }} className="mt-3 rounded-full border border-[rgba(216,180,90,0.4)] px-4 py-2 text-xs font-bold text-[#e4c979]">
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </>
              ) : <p className="mt-3 text-sm text-[#81948e]">Loading…</p>}
            </div>
            <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-5 lg:col-span-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#849792]">Performance</p>
              <MyCharts />
            </div>
          </div>

          <section className="mt-8">
            <div className="mb-3 flex justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-white">Recent projects</h2>
              <span className="text-xs text-[#81948e]">Pipeline {formatUsd(projectStats.profit)}</span>
            </div>
            {!projects.length ? (
              <div className="rounded-2xl border border-dashed border-[#2c403a] p-8 text-center text-sm text-[#81948e]">
                No projects yet. <Link href="/dashboard/create-project" className="font-semibold text-[#d8b45a]">Create one</Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#1e3d36]">
                {projects.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e3d36] px-4 py-3.5 last:border-b-0">
                    <div className="min-w-0">
                      <button type="button" onClick={() => setSelectedProject(p)} className="font-semibold text-[#f0f4f2] hover:text-[#e4c979]">{p.title}</button>
                      <p className="text-xs text-[#81948e]">{p.project_type.replace(/_/g, ' ')} · {formatUsd(Number(p.seller_profit || 0))} profit · {p.payment_status.replace(/_/g, ' ').toLowerCase()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedProject(p)} className="rounded-lg border border-white/10 p-2 text-[#9aaca6]"><Eye size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg font-bold text-white">Recent activity</h2>
            {!transactions.length ? (
              <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-6 text-sm text-[#81948e]">No activity yet.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#1e3d36]">
                {transactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border-b border-[#1e3d36] px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.detail || t.label}</p>
                      <p className="text-xs text-[#81948e]">{new Date(t.date).toLocaleDateString()} · {t.status}</p>
                    </div>
                    <span className={`text-sm font-bold ${t.amount < 0 ? 'text-[#e89a8d]' : 'text-[#8fd6a8]'}`}>
                      {t.amount < 0 ? '−' : '+'}{formatUsd(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-[#1e3d36] bg-[#0a2926] p-6">
            <div className="flex justify-between gap-3">
              <h3 className="font-display text-xl font-bold text-white">{selectedProject.title}</h3>
              <button type="button" onClick={() => setSelectedProject(null)} className="rounded-full border border-white/10 p-2"><X size={16} /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Field label="Client" value={formatUsd(Number(selectedProject.client_price || 0))} />
              <Field label="Profit" value={formatUsd(Number(selectedProject.seller_profit || 0))} />
              <Field label="Payment" value={selectedProject.payment_status.replace(/_/g, ' ')} />
              <Field label="Status" value={selectedProject.status.replace(/_/g, ' ')} />
            </div>
            <button type="button" disabled={deletingId === selectedProject.id} onClick={() => deleteProject(selectedProject.id)} className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-400/30 px-4 py-2.5 text-sm font-bold text-red-300">
              <Trash2 size={15} /> {deletingId === selectedProject.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.07)]' : 'border-[#1e3d36] bg-[#0b2420]'}`}>
      <div className="text-xs uppercase tracking-[.14em] text-[#849792]">{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold text-[#e8efe9]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[#81948e]">{hint}</div>
    </div>
  )
}

function Action({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-4 transition hover:border-[rgba(216,180,90,0.3)]">
      <div className="flex justify-between"><span className="font-display font-bold text-[#e8efe9]">{title}</span><ArrowRight size={14} className="text-[#6e817c] group-hover:text-[#d8b45a]" /></div>
      <p className="mt-1 text-xs text-[#849792]">{text}</p>
    </Link>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[.03] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e817c]">{label}</p>
      <p className="mt-1 font-semibold text-[#d9e0dc]">{value}</p>
    </div>
  )
}
