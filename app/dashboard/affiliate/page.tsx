'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { DEFAULT_DASHBOARD_NAV } from '../../../components/DashboardShell'
import { createClient } from '../../../lib/supabase'
import { useAuth } from '../../../lib/useAuth'
import { Badge, emptyNote, fmtDate, fmtUsd } from '../../../components/admin/shared'
import { Copy, Link2, TrendingUp, Users2, Wallet, CheckCircle2 } from 'lucide-react'

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
  totals: {
    activeReferrals: number
    totalCommissions: number
    pendingAmount: number
    availableAmount: number
    paidAmount: number
  }
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
    if (!signedIn) {
      setLoading(false)
      return
    }
    fetch('/api/affiliate/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.error) {
          setLoading(false)
          return
        }
        setData(j)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [signedIn])

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
    <DashboardShell nav={DEFAULT_DASHBOARD_NAV} title="Affiliate">
      <div className="mx-auto max-w-4xl pb-16">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-muted-foreground">Partner Program</p>
            <h1 className="font-display mt-1 text-3xl font-extrabold text-foreground">Affiliate Dashboard</h1>
          </div>
          <Link
            href="/earn"
            className="rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
          >
            How the program works →
          </Link>
        </div>

        {!signedIn ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Sign in to view your affiliate stats.
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading your affiliate data...
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[.16em] text-muted-foreground">Your invite link</p>
                  <p className="mt-1 break-all font-mono text-sm text-foreground">{data?.referralLink}</p>
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Code: {data?.code}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Active referrals" value={String(totals?.activeReferrals ?? 0)} icon={Users2} />
              <Stat label="Commissions" value={String(totals?.totalCommissions ?? 0)} icon={TrendingUp} />
              <Stat label="Available" value={fmtUsd(totals?.availableAmount ?? 0)} icon={Wallet} />
              <Stat label="Paid" value={fmtUsd(totals?.paidAmount ?? 0)} icon={CheckCircle2} />
            </div>

            <div className="mt-8">
              <h2 className="font-display text-lg font-bold text-foreground">Referrals</h2>
              {!data?.referrals?.length ? (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  {emptyNote('No referrals yet. Share your link to get started.')}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.referrals.map((r) => {
                    const paid = r.commissions
                      .filter((c) => c.status === 'paid')
                      .reduce((s, c) => s + Number(c.commission_amount || 0), 0)
                    const pending = r.commissions
                      .filter((c) => c.status !== 'paid')
                      .reduce((s, c) => s + Number(c.commission_amount || 0), 0)
                    const name =
                      r.referredProfile?.full_name || r.referredProfile?.username || 'Referral'
                    return (
                      <div
                        key={r.id}
                        className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-4"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {fmtUsd(paid)} paid · {fmtUsd(pending)} pending
                          </div>
                        </div>
                        <div className="hidden items-center sm:flex">
                          <Badge status={r.status} />
                        </div>
                        <div className="hidden items-center text-muted-foreground sm:flex">
                          {r.commissions.length}
                        </div>
                        <div className="hidden items-center text-xs text-muted-foreground sm:flex">
                          {fmtDate(r.attributed_at || r.created_at)}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 sm:hidden">
                          <Badge status={r.status} />
                          <span className="text-[13px] text-muted-foreground">
                            {r.commissions.length} commission{r.commissions.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(r.attributed_at || r.created_at)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {data?.referredBy ? (
              <div className="mt-5 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                You signed up through a referral link (status: {data.referredBy.status}). Thank you for being part of the
                partner program!
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon size={13} className="text-primary" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-foreground">{value}</div>
    </div>
  )
}
