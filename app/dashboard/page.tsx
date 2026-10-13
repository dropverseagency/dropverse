'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import {
  Layers,
  TrendingUp,
  Wallet,
  ArrowRight,
  Settings as SettingsIcon,
  Search,
  Clock,
  CheckCircle2,
  Users,
  Receipt,
  BarChart3,
  Building2,
  ChevronDown,
  Plus,
  LogOut,
  Eye,
  Trash2,
  X,
} from 'lucide-react'
import Brand from '../../components/Brand'
import PlanUpgradeBanner from '../../components/PlanUpgradeBanner'
import MyCharts from '../../components/dashboard/MyCharts'
import { createClient } from '../../lib/supabase'
import { canViewFinancials, isManager, type OrgRow } from '../../lib/orgs'
import { PLAN_CONFIG, planById, type OrgRole } from '../../lib/planConfig'
import {
  PROJECT_TYPES,
  PAYMENT_METHODS,
  STATUS_LABELS,
  formatUsd,
} from '../../lib/projectConfig'

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  phone: string | null
  telegram_username: string | null
  role: string
  created_at: string
}

interface Transaction {
  type: 'commission' | 'payout' | 'project'
  label: string
  amount: number
  status: string
  date: string
  detail?: string
  projectId?: string
}

interface InvoiceRow {
  id: string
  invoiceNumber: string
  clientName: string | null
  currency: string
  amount: number
  status: string
  createdAt: string
  projectId: string
  projectTitle: string
  clientContactEmail: string | null
}

interface ProjectRow {
  id: string
  title: string
  project_type: string
  billing_interval: string
  client_price: number | string
  fulfillment_cost: number | string
  seller_profit: number | string
  payment_method: string
  payment_status: string
  status: string
  created_at: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const reduceMotion = useReducedMotion()
  const luxuryEase = [0.23, 1, 0.32, 1] as const
  const [profile, setProfile] = useState<Profile | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingPayout, setPendingPayout] = useState(0)
  const [paidPayout, setPaidPayout] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [chosenPlan, setChosenPlan] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [dashLink, setDashLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [copyingInvoice, setCopyingInvoice] = useState<string | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const baseHost = typeof window !== 'undefined' ? window.location.origin : 'https://dropverse-nu.vercel.app'
  const host = typeof window !== 'undefined' ? window.location.host : 'dropverse-nu.vercel.app'
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    if (p) setChosenPlan(p.toUpperCase())
  }, [])

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? null,
    [orgs, activeOrgId],
  )
  const orgPlan = activeOrg ? planById(activeOrg.plan as never) : PLAN_CONFIG[0]

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      let session = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          session = data.session
          break
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session || cancelled) {
        window.location.assign('/login?redirect=%2Fdashboard')
        return
      }
      setSessionToken(session.access_token)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, telegram_username, role, created_at')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (profileData) setProfile(profileData as Profile)
      if (profileData?.role === 'admin') setIsAdmin(true)

      const meRes = await fetch('/api/affiliate/me', { credentials: 'include' })
      if (meRes.ok) {
        const meJson = await meRes.json()
        if (!cancelled && typeof meJson?.code === 'string') setDashLink(meJson.code)
      }

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
        const { data: mems } = await supabase
          .from('organization_members')
          .select('organization_id, role, status')
          .eq('user_id', session.user.id)
        if (mems) {
          const byOrg = new Map(mems.map((m) => [m.organization_id, { role: m.role as OrgRole, status: m.status }]))
          setOrgRole(byOrg.get(orgList[0].id)?.role ?? null)
        }
        setActiveOrgId(orgList[0].id)
      }

      const { data: commissions } = await supabase
        .from('referral_commissions')
        .select('id, commission_amount, status, created_at, referral_id')
        .eq('status', 'approved')
        .eq('referral_id', session.user.id)
      const { data: ledger } = await supabase
        .from('commission_ledger')
        .select('event, amount, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('id, amount, status, requested_at, paid_at')
        .eq('user_id', session.user.id)
        .order('requested_at', { ascending: false })
        .limit(50)
      if (cancelled) return

      const approvedTotal = (commissions || []).reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)
      const paidFromPayouts = (payouts || []).reduce((sum, p) => (p.status === 'paid' ? sum + Number(p.amount) : sum), 0)
      const pendingFromPayouts = (payouts || []).reduce(
        (sum, p) => (p.status === 'pending' || p.status === 'approved' ? sum + Number(p.amount) : sum),
        0,
      )
      setTotalEarnings(approvedTotal + paidFromPayouts)
      setPaidPayout(paidFromPayouts)
      setPendingPayout(pendingFromPayouts)

      const rows: Transaction[] = []
      for (const l of ledger || []) {
        const isIncome = !l.event.startsWith('payout')
        rows.push({
          type: isIncome ? 'commission' : 'payout',
          label: formatEvent(l.event),
          amount: Number(l.amount || 0),
          status: l.event.replace('_', ' '),
          date: l.created_at,
        })
      }
      for (const p of payouts || []) {
        rows.push({
          type: 'payout',
          label: `Payout request`,
          amount: -Number(p.amount),
          status: p.status,
          date: p.requested_at,
        })
      }
      rows.sort((a, b) => (a.date < b.date ? 1 : -1))
      setTransactions(rows.slice(0, 10))

      const { data: projRows } = await supabase
        .from('projects')
        .select('id, title, project_type, billing_interval, client_price, fulfillment_cost, seller_profit, payment_method, payment_status, status, created_at')
        .order('created_at', { ascending: false })
        .limit(25)
      if (!cancelled) setProjects((projRows as ProjectRow[] | null) ?? [])

      try {
        const invRes = await fetch('/api/invoices/me', { credentials: 'include' })
        if (invRes.ok) {
          const invJson = await invRes.json()
          if (!cancelled && Array.isArray(invJson.invoices)) setInvoices(invJson.invoices)
        }
      } catch {
        // Invoices are an enhancement; failure must not break the dashboard.
      }

      if (!cancelled && projRows) {
        const projectRows: Transaction[] = (projRows as ProjectRow[]).map((p) => ({
          type: 'project' as const,
          label: `Created project`,
          amount: Number(p.seller_profit || 0),
          status: p.payment_status.toLowerCase().replace(/_/g, ' '),
          date: p.created_at,
          detail: p.title,
          projectId: p.id,
        }))
        setTransactions((prev) => [...projectRows, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10))
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  function selectOrg(id: string) {
    setActiveOrgId(id)
    const mem = orgs.find((o) => o.id === id)
    void mem
    setSwitcherOpen(false)
  }

  async function createInvoice(projectId: string) {
    setCreatingInvoice(projectId)
    setInvoiceError(null)
    const res = await fetch('/api/invoices/me', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    const json = await res.json().catch(() => ({}))
    setCreatingInvoice(null)
    if (!res.ok) {
      if (json.error === 'NOT_AUTHENTICATED') {
        window.location.assign('/login?redirect=%2Fdashboard')
        return
      }
      setInvoiceError(`Could not create invoice: ${String(json.error || 'unknown')}`)
      return
    }
    const invRes = await fetch('/api/invoices/me', { credentials: 'include' })
    if (invRes.ok) {
      const invJson = await invRes.json()
      if (Array.isArray(invJson.invoices)) setInvoices(invJson.invoices)
    }
  }

  async function copyInvoiceLink(invoiceId: string) {
    const url = `${baseHost}/invoice/${invoiceId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      return
    }
    setCopyingInvoice(invoiceId)
    setTimeout(() => setCopyingInvoice(null), 2000)
  }

  function openProjectDetail(project: ProjectRow) {
    setSelectedProject(project)
    setDeleteError(null)
  }

  function openProjectById(id: string) {
    const p = projects.find((x) => x.id === id)
    if (p) openProjectDetail(p)
  }

  async function deleteProject(projectId: string) {
    if (!confirm('Delete this project permanently? This cannot be undone.')) return
    setDeletingId(projectId)
    setDeleteError(null)
    const supabase = createClient()
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    setDeletingId(null)
    if (error) {
      setDeleteError(error.message || 'Could not delete project')
      return
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    setTransactions((prev) => prev.filter((t) => t.projectId !== projectId))
    setInvoices((prev) => prev.filter((inv) => inv.projectId !== projectId))
    if (selectedProject?.id === projectId) setSelectedProject(null)
  }

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <PlanUpgradeBanner orgs={orgs} activeOrgId={activeOrgId} sessionToken={sessionToken} />

        <div className="flex items-center justify-between gap-3">
          <Brand compact />
          <div className="flex items-center gap-3">
            {activeOrg && (
              <div className="relative">
                <button
                  onClick={() => setSwitcherOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-sm font-semibold text-[#d9e0dc] transition hover:border-[rgba(216,180,90,0.40)]"
                  aria-haspopup="true"
                  aria-expanded={switcherOpen}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d8b45a] text-xs font-bold text-[#10221f]">
                    {activeOrg.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline max-w-[10rem] truncate">{activeOrg.name}</span>
                  <ChevronDown size={14} className="text-[#6e817c]" />
                </button>
                {switcherOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0a2926] shadow-xl">
                    <div className="border-b border-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#6e817c]">
                      Your workspaces
                    </div>
                    {orgs.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => selectOrg(o.id)}
                        className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm transition hover:bg-white/5 ${
                          o.id === activeOrgId ? 'text-[#e4c979]' : 'text-[#d9e0dc]'
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(216,180,90,0.15)] text-[10px] font-bold text-[#d8b45a]">
                          {o.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{o.name}</span>
                        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#849792]">
                          {o.type === 'personal' ? 'Personal' : planById(o.plan as never).displayName}
                        </span>
                      </button>
                    ))}
                    <Link
                      href="/dashboard/create-org"
                      onClick={() => setSwitcherOpen(false)}
                      className="flex w-full items-center gap-2.5 border-t border-white/5 px-4 py-3 text-sm font-semibold text-[#d8b45a] transition hover:bg-white/5"
                    >
                      <Plus size={14} /> Create an Agency
                    </Link>
                  </div>
                )}
              </div>
            )}
            {isAdmin ? (
              <Link
                href="/admin"
                className="flex h-10 items-center gap-2 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-4 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]"
                aria-label="Admin Panel"
                title="Admin Panel"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/dashboard/settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={17} />
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979] disabled:opacity-60 sm:flex sm:h-auto sm:w-auto sm:items-center sm:gap-2 sm:px-4 sm:py-2 sm:text-sm sm:font-semibold"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} className="sm:hidden" />
              <span className="hidden sm:inline">{signingOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading your workspace...</div>
        ) : (
          <>
            <div className="card mt-10 rounded-3xl p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                    <Building2 size={19} />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[.18em] text-[#849792]">Workspace</p>
                    <h1 className="font-display mt-1 text-2xl font-extrabold sm:text-3xl">
                      {activeOrg?.name ?? 'Your workspace'}
                    </h1>
                  </div>
                </div>
                <span className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3.5 py-1.5 text-xs font-bold text-[#e4c979]">
                  {activeOrg
                    ? `${activeOrg.type === 'personal' ? 'Personal' : orgPlan.displayName} Plan`
                    : '—'}
                </span>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#8fa29c]">
                Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}. Here is your DropVerse
                workspace activity and earnings overview. Manage projects, grow your referral network and track
                your payouts.
              </p>
              <MyCharts />
              {chosenPlan && chosenPlan !== orgPlan?.id ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.08)] px-4 py-3 text-sm text-[#e4c979]">
                  <span>
                    You chose the <b>{planById(chosenPlan as never)?.displayName ?? chosenPlan} Plan</b>.
                    {orgPlan?.id === 'SOLO' ? ' Upgrade your workspace whenever you are ready.' : ''}
                  </span>
                  <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-2 hover:text-[#f0d98b]">
                    Manage plan <ArrowRight size={14} />
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard
                href="/dashboard/create-project"
                icon={<Layers size={18} />}
                title="New project"
                text="Create a client project and track fulfillment."
              />
              <ActionCard
                href="/dashboard/team"
                icon={<Users size={18} />}
                title="Team"
                text="Invite members and manage roles on paid plans."
              />
              <ActionCard
                href="/dashboard/billing"
                icon={<Receipt size={18} />}
                title="Billing"
                text="Plan details and dual payment (Paddle + SpaceRemit) — upgrade anytime."
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Wallet size={18} />} label="Total earnings" value={formatUsd(totalEarnings)} />
              <StatCard icon={<Clock size={18} />} label="Pending payout" value={formatUsd(pendingPayout)} />
              <StatCard icon={<CheckCircle2 size={18} />} label="Paid out" value={formatUsd(paidPayout)} />
            </div>

            {dashLink && (
              <div className="card mt-6 rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[.18em] text-[#849792]">Your referral link</p>
                    <p className="mt-1 font-mono text-sm text-[#d9e0dc]">
                      {host}/r/{dashLink}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${baseHost}/r/${dashLink}`)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      } catch {}
                    }}
                    className="rounded-full border border-[rgba(216,180,90,0.40)] px-4 py-2 text-xs font-bold text-[#e4c979] hover:bg-[rgba(216,180,90,0.12)]"
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            )}

            <div className="card mt-6 rounded-3xl p-5 sm:p-7">
              <h2 className="font-display text-lg font-bold">Recent activity</h2>
              {transactions.length === 0 ? (
                <p className="mt-4 text-sm text-[#718781]">No activity yet. Create a project or share your referral link.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {transactions.map((t, i) => (
                    <div
                      key={`${t.date}-${i}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3 ${
                        t.type === 'project' && t.projectId ? 'cursor-pointer transition hover:border-[rgba(216,180,90,0.25)]' : ''
                      }`}
                      onClick={() => {
                        if (t.type === 'project' && t.projectId) openProjectById(t.projectId)
                      }}
                      role={t.type === 'project' && t.projectId ? 'button' : undefined}
                      tabIndex={t.type === 'project' && t.projectId ? 0 : undefined}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && t.type === 'project' && t.projectId) {
                          e.preventDefault()
                          openProjectById(t.projectId)
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#d9e0dc]">
                          {t.label}{t.detail ? `: ${t.detail}` : ''}
                        </div>
                        <div className="mt-1 text-[11px] text-[#718781]">
                          {new Date(t.date).toLocaleString()} · {t.status}
                          {t.type === 'project' ? ' · Tap for details' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-sm font-bold ${t.amount >= 0 ? 'text-[#e4c979]' : 'text-[#e89a8d]'}`}>
                          {t.amount >= 0 ? '+' : ''}{formatUsd(t.amount)}
                        </div>
                        {t.type === 'project' && t.projectId && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openProjectById(t.projectId!)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]"
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProject(t.projectId!)}
                              disabled={deletingId === t.projectId}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
                              title="Delete project"
                              aria-label="Delete project"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {deleteError && (
                <p className="mt-3 text-sm text-red-300">{deleteError}</p>
              )}
            </div>

            <div className="card mt-6 mb-10 rounded-3xl p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">Your projects</h2>
                <Link
                  href="/dashboard/create-project"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3.5 py-1.5 text-xs font-bold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.18)]"
                >
                  <Plus size={13} /> New project
                </Link>
              </div>
              {projects.length === 0 ? (
                <p className="mt-4 text-sm text-[#718781]">
                  No projects yet.{' '}
                  <Link href="/dashboard/create-project" className="font-semibold text-[#d8b45a] hover:text-[#f0d98b]">
                    Create your first project
                  </Link>
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3 transition hover:border-[rgba(216,180,90,0.25)]"
                    >
                      <button
                        type="button"
                        onClick={() => openProjectDetail(p)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-sm font-semibold text-[#d9e0dc]">{p.title}</div>
                        <div className="mt-1 text-[11px] text-[#718781]">
                          {p.project_type} · {p.status} · {p.payment_status.replace(/_/g, ' ')}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-[#e4c979]">
                          {formatUsd(Number(p.seller_profit || 0))}
                        </div>
                        <button
                          type="button"
                          onClick={() => openProjectDetail(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]"
                          title="View details"
                          aria-label="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(p.id)}
                          disabled={deletingId === p.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
                          title="Delete project"
                          aria-label="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedProject && (
              <div
                className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
                onClick={() => setSelectedProject(null)}
                role="dialog"
                aria-modal="true"
                aria-label="Project details"
              >
                <div
                  className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0a2926] p-6 shadow-2xl sm:p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#849792]">Project details</p>
                      <h3 className="font-display mt-1 text-xl font-extrabold text-[#e8efe9]">
                        {selectedProject.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-white/25 hover:text-white"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <DetailField label="Type" value={selectedProject.project_type} />
                    <DetailField label="Status" value={selectedProject.status} />
                    <DetailField label="Payment" value={selectedProject.payment_status.replace(/_/g, ' ')} />
                    <DetailField label="Method" value={selectedProject.payment_method.replace(/_/g, ' ')} />
                    <DetailField label="Billing" value={selectedProject.billing_interval.replace(/_/g, ' ')} />
                    <DetailField
                      label="Created"
                      value={new Date(selectedProject.created_at).toLocaleString()}
                    />
                    <DetailField label="Client price" value={formatUsd(Number(selectedProject.client_price || 0))} />
                    <DetailField label="Fulfillment cost" value={formatUsd(Number(selectedProject.fulfillment_cost || 0))} />
                    <DetailField
                      label="Your profit"
                      value={formatUsd(Number(selectedProject.seller_profit || 0))}
                      highlight
                    />
                    <DetailField label="Project ID" value={selectedProject.id.slice(0, 8) + '…'} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => createInvoice(selectedProject.id)}
                      disabled={creatingInvoice === selectedProject.id}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-4 py-2.5 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)] disabled:opacity-60"
                    >
                      <Receipt size={15} />
                      {creatingInvoice === selectedProject.id ? 'Creating…' : 'Create invoice'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(selectedProject.id)}
                      disabled={deletingId === selectedProject.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-400/30 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                      {deletingId === selectedProject.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                  {deleteError && <p className="mt-3 text-sm text-red-300">{deleteError}</p>}
                  {invoiceError && <p className="mt-3 text-sm text-red-300">{invoiceError}</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function DetailField({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[.03] px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6e817c]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? 'text-[#e4c979]' : 'text-[#d9e0dc]'}`}>{value}</p>
    </div>
  )
}

function formatEvent(event: string) {
  return event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card rounded-3xl p-5">
      <div className="flex items-center gap-2 text-[#d8b45a]">{icon}<span className="text-xs uppercase tracking-[.14em] text-[#849792]">{label}</span></div>
      <div className="mt-3 font-display text-2xl font-extrabold text-[#e8efe9]">{value}</div>
    </div>
  )
}

function ActionCard({
  href,
  icon,
  title,
  text,
}: {
  href: string
  icon: React.ReactNode
  title: string
  text: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
          {icon}
        </span>
        <span className="font-display font-bold text-[#e8efe9]">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#849792]">{text}</p>
    </>
  )
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] p-4 transition hover:border-[rgba(216,180,90,0.30)]"
    >
      {body}
    </Link>
  )
}
