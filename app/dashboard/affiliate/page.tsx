'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteHeader from '../../../components/SiteHeader'
import { useAuth } from '../../../lib/useAuth'
import { Badge, emptyNote, fmtDate, fmtUsd } from '../../../components/admin/shared'
import { Copy, Link2, TrendingUp, Users2, Wallet, CheckCircle2, Timer, Crown } from 'lucide-react'

type ReferralRow = {
  id: string
  status: string
  created_at: string
  attributed_at?: string | null
  referredProfile?: { full_name?: string | null; username?: string | null } | null
  commissions: {
    id: string
    base_amount: number | null
    commission_rate: number | null
    commission_amount: number | null
    currency: string
    status: string
    created_at: string
    available_at?: string | null
    paid_at?: string | null
  }[]
}

type MeData = {
  code: string
  referralLink: string
  totals: { activeReferrals: number; totalCommissions: number; pendingAmount: number; availableAmount: number; paidAmount: number }
  referrals: ReferralRow[]
  referredBy?: { referralId: string; status: string } | null
}

export default function AffiliatePage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [data, setData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/affiliate/me').then((r) => r.json()).then((j) => {
      if (cancelled) return
      if (j.error) {
        setLoading(false)
        return
      }
      setData(j)
      setLoading(false)
    }).catch(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  async function copyLink() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.referralLink)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = data.referralLink
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totals = data?.totals

  return (
    <div className="min-h-screen bg-[#071210]">
      <SiteHeader highlightEarn={false} />
      <div className="pt-20">
        <div className="container max-w-4xl pb-16">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-[#7f918c]">Partner Program</p>
                <h1 className="font-display mt-1 text-3xl font-extrabold text-[#f0f4f2]">Affiliate Dashboard</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/payouts" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-semibold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.14)]">
                  Payouts →
                </Link>
                <Link href="/earn" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-[#c8d4d0] transition hover:border-[rgba(216,180,90,0.35)] hover:text-[#e4c979]">
                  How the program works →
                </Link>
              </div>
            </div>

            <LifetimeOfferBanner />

            {!signedIn ? (
              <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-8 text-center text-sm text-[#81948e]">
                Sign in to view your affiliate stats.
              </div>
            ) : loading ? (
              <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-8 text-center text-sm text-[#81948e]">Loading your affiliate data...</div>
            ) : (
              <>
                <div className="rounded-xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#9aa8a3]">Your invite code</div>
                      <div className="mt-1 font-mono text-xl font-bold tracking-[.2em] text-[#f0d98b]">{data?.code ?? '—'}</div>
                      <div className="mt-2 flex max-w-sm items-center gap-2 rounded-lg border border-white/10 bg-[#071210] px-3 py-2 text-xs text-[#9aacb6]">
                        <Link2 size={13} className="shrink-0 text-[#d8b45a]" />
                        <span className="truncate">{data?.referralLink ?? '…'}</span>
                      </div>
                    </div>
                    <button
                      onClick={copyLink}
                      className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-4 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
                    >
                      {copied ? <><CheckCircle2 size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#81948e]">
                    Share this link. When someone signs up through it and their paid projects generate revenue, you earn a commission from the platform revenue (not the project price). No self-referrals allowed.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="Active referrals" value={String(totals?.activeReferrals ?? 0)} icon={Users2} />
                  <Stat label="Total commissions" value={String(totals?.totalCommissions ?? 0)} icon={TrendingUp} />
                  <Stat label="Pending / approved" value={fmtUsd(totals?.pendingAmount)} icon={Wallet} />
                  <Stat label="Paid out" value={fmtUsd(totals?.paidAmount)} icon={CheckCircle2} />
                </div>

                <h2 className="font-display mt-8 mb-3 text-lg font-bold text-[#e8edea]">Your Referrals</h2>
                {!data?.referrals?.length ? (
                  emptyNote('No referrals yet. Share your invite link to start earning.')
                ) : (
                  <div className="overflow-hidden rounded-xl border border-white/5">
                    <div className="hidden grid-cols-[1fr_100px_100px_110px] gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px] uppercase tracking-wider text-[#7f918c] sm:grid">
                      <span>Referred user</span><span>Status</span><span>Commissions</span><span>Attributed</span>
                    </div>
                    {data.referrals.map((r) => {
                      const pending = r.commissions.filter((c) => c.status === 'pending' || c.status === 'approved').reduce((s, c) => s + Number(c.commission_amount || 0), 0)
                      const paid = r.commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount || 0), 0)
                      return (
                        <div key={r.id} className="grid grid-cols-[1fr_100px_100px_110px] gap-3 border-b border-white/5 px-4 py-3.5 text-sm last:border-b-0 sm:grid">
                          <div>
                            <div className="font-semibold text-[#f0f4f2]">{r.referredProfile?.full_name || r.referredProfile?.username || 'Anonymous'}</div>
                            <div className="mt-0.5 text-xs text-[#81948e]">{fmtUsd(paid)} paid · {fmtUsd(pending)} pending</div>
                          </div>
                          <div className="hidden items-center sm:flex"><Badge status={r.status} /></div>
                          <div className="hidden items-center text-[#c8d4d0] sm:flex">{r.commissions.length}</div>
                          <div className="hidden items-center text-xs text-[#81948e] sm:flex">{fmtDate(r.attributed_at || r.created_at)}</div>
                          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5 sm:hidden">
                            <Badge status={r.status} />
                            <span className="text-[13px] text-[#c8d4d0]">{r.commissions.length} commission{r.commissions.length === 1 ? '' : 's'}</span>
                            <span className="text-xs text-[#81948e]">{fmtDate(r.attributed_at || r.created_at)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data?.referredBy ? (
                  <div className="mt-5 rounded-xl border border-[rgba(120,170,255,0.25)] bg-[rgba(120,170,255,0.06)] px-4 py-3 text-sm text-[#9db8ff]">
                    You signed up through a referral link (status: {data.referredBy.status}). Thank you for being part of the partner program!
                  </div>
                ) : null}
              </>
            )}
        </div>
      </div>
    </div>
  )
}

const LIFETIME_DEADLINE = new Date('2027-01-01T00:00:00.000Z')

function LifetimeOfferBanner() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = LIFETIME_DEADLINE.getTime() - now.getTime()
  if (ms <= 0) return null
  const sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.06)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.1)] text-[#d8b45a]">
          <Timer size={18} />
        </div>
        <div>
          <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
            <Crown size={12} /> Lifetime Partner
          </div>
          <p className="mt-1 text-sm font-semibold text-[#f0f4f2]">Lock lifetime status before 1 Jan 2027</p>
          <p className="mt-0.5 text-xs text-[#81948e]">Stay active and keep partner benefits for life.</p>
        </div>
      </div>
      <div className="flex gap-2">
        {[
          ['D', days],
          ['H', hours],
          ['M', minutes],
          ['S', seconds],
        ].map(([l, v]) => (
          <div key={l as string} className="min-w-[3.25rem] rounded-xl border border-white/10 bg-[#071210] px-2 py-2 text-center">
            <div className="font-display text-lg font-bold tabular-nums text-[#f0d98b]">{l === 'D' ? v : pad(v as number)}</div>
            <div className="text-[9px] font-bold uppercase text-[#7f918c]">{l as string}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#7f918c]">
        <Icon size={13} className="text-[#d8b45a]" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-[#f0f4f2]">{value}</div>
    </div>
  )
}
