'use client'
import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'
import { canViewFinancials, isManager, type OrgRow } from '../../lib/orgs'
import { PLAN_CONFIG, planById, type OrgRole } from '../../lib/planConfig'

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
  type: 'commission' | 'payout'
  label: string
  amount: number
  status: string
  date: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, telegram_username, role, created_at')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (profileData) setProfile(profileData as Profile)

      // Organizations this user belongs to (RLS) + their role
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

      // Earnings: approved commissions tied to this user's referrals
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

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        {/* Top bar: brand — org switcher — settings — sign out */}
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
              className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979] disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading your workspace...</div>
        ) : (
          <>
            {/* Workspace header with plan badge + org nav */}
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
                sales and earnings overview. Sell services, grow your referral network and track
                your payouts.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <ProfileRow icon={<Layers size={15} />} label="Username" value={profile?.username || '—'} />
                <ProfileRow icon={<Layers size={15} />} label="Full name" value={profile?.full_name || '—'} />
                <ProfileRow icon={<Layers size={15} />} label="Mobile" value={profile?.phone || '—'} />
                <ProfileRow icon={<Layers size={15} />} label="Telegram" value={profile?.telegram_username || 'Not added'} />
              </div>
            </div>

            {/* Earnings stats */}
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Stat icon={<TrendingUp />} label="Total earnings" value={formatUSD(totalEarnings)} accent />
              <Stat icon={<Wallet />} label="Pending payout" value={formatUSD(pendingPayout)} />
              <Stat icon={<CheckCircle2 />} label="Paid out" value={formatUSD(paidPayout)} />
            </div>

            {/* Transactions */}
            <div className="card mt-8 rounded-3xl p-7">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Activity</h2>
                <span className="flex items-center gap-1.5 text-xs text-[#687d76]">
                  <Search size={13} /> Latest 10
                </span>
              </div>
              {transactions.length === 0 ? (
                <div className="mt-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.03] text-[#536963]">
                    <Clock size={22} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#8fa29c]">No activity yet</p>
                  <p className="mt-1.5 text-sm text-[#687d76]">
                    Your earnings, commissions and payouts will appear here as they happen.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-2.5">
                  {transactions.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#d9e0dc]">
                          <span
                            className={`h-2 w-2 rounded-full ${t.type === 'commission' ? 'bg-[#6fbf73]' : 'bg-[#e4c979]'}`}
                          />
                          {t.label}
                          <span className="hidden sm:inline text-xs text-[#687d76]">{t.status}</span>
                        </div>
                        <div className="mt-0.5 pl-4 text-xs text-[#687d76]">{formatDate(t.date)}</div>
                      </div>
                      <div className={`font-bold ${t.amount >= 0 ? 'text-[#6fbf73]' : 'text-[#9aaca6]'}`}>
                        {t.amount >= 0 ? '+' : ''}{formatUSD(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Workspace management + quick actions */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.7fr]">
              <div className="card rounded-3xl p-7">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">Manage workspace</h2>
                  <span className="text-xs text-[#687d76]">
                    {activeOrg?.type === 'personal' ? 'Personal' : `${orgPlan.displayName} plan`}
                  </span>
                </div>
                <div className="mt-6 space-y-3">
                  <Action
                    icon={<Users size={16} />}
                    title="Team"
                    text="Invite members and manage roles. Coming soon on paid plans."
                    href="/dashboard/team"
                    disabled={!isManager(orgRole ?? 'MEMBER')}
                  />
                  <Action
                    icon={<Receipt size={16} />}
                    title="Billing"
                    text="Plan details and payment method. Foundation ready, payments coming soon."
                    href="/dashboard/billing"
                  />
                  <Action
                    icon={<BarChart3 size={16} />}
                    title="Analytics"
                    text={orgPlan.limits.analytics === 'advanced' ? 'Advanced performance insights.' : 'Basic overview of your activity.'}
                    href="/dashboard/analytics"
                  />
                  <Action
                    icon={<SettingsIcon size={16} />}
                    title="Settings"
                    text="Update your profile details or email."
                    href="/dashboard/settings"
                  />
                </div>
              </div>

              <div className="card rounded-3xl p-7">
                <p className="text-sm text-[#d8b45a]">Quick actions</p>
                <h2 className="font-display mt-2 text-xl font-bold">Explore services.</h2>
                <p className="mt-3 text-sm leading-6 text-[#81948e]">
                  Explore the library, save strong samples and start building your offer.
                </p>
                <div className="mt-5 space-y-3">
                  <Action title="Explore services" text="Find services you can package and sell." href="/#services" />
                  <Action title="Browse work samples" text="Discover examples from professional talent." href="/#samples" />
                  <Action title="Earn With DropVerse" text="Turn your network and sales into another revenue stream." href="/earn" />
                </div>
              </div>
            </div>

            <p className="mt-10 text-center text-xs text-[#687d76]">
              Need help? Contact us at{' '}
              <a href="mailto:dropverseagency@gmail.com" className="text-[#9aaca6] hover:text-[#d8b45a]">
                dropverseagency@gmail.com
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatEvent(event: string): string {
  const map: Record<string, string> = {
    commission_approved: 'Referral commission approved',
    commission_paid: 'Commission paid out',
    payout_requested: 'Payout requested',
    payout_completed: 'Payout completed',
    payout_approved: 'Payout approved',
  }
  return map[event] || event.replace(/_/g, ' ')
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3.5">
      <span className="text-[#d8b45a]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-[#718781]">{label}</div>
        <div className="truncate text-sm font-semibold text-[#d9e0dc]">{value}</div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="card rounded-2xl p-5">
      <div className={accent ? 'text-[#d8b45a]' : 'text-[#687d76]'}>{icon}</div>
      <div className="mt-5 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-[#758983]">{label}</div>
    </div>
  )
}

function Action({
  title,
  text,
  href,
  icon,
  disabled,
}: {
  title: string
  text: string
  href: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="text-[#d8b45a]">{icon}</span>}
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm text-[#7f938d]">{text}</div>
        </div>
      </div>
      <ArrowRight size={17} className="shrink-0 text-[#d8b45a]" />
    </>
  )
  if (disabled) {
    return (
      <div
        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.015] p-4 opacity-55"
        title="Available to owners and admins"
      >
        {body}
      </div>
    )
  }
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] p-4 transition hover:border-[rgba(216,180,90,0.30)]"
    >
      {body}
    </Link>
  )
}
