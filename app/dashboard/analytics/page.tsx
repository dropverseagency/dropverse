'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, TrendingUp, Users } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { type OrgRow } from '../../../lib/orgs'
import { planById } from '../../../lib/planConfig'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [stats, setStats] = useState({ commissions: 0, referralUsers: 0, payouts: 0 })

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
      if (!session || cancelled) { window.location.assign('/login?redirect=%2Fdashboard%2Fanalytics'); return }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at')
        .eq('status', 'active')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false })
      if (cancelled) return
      const orgList = (orgRows as OrgRow[] | null) ?? []
      setOrgs(orgList)
      if (orgList.length > 0) setActiveOrgId(orgList[0].id)

      // Basic overview for the user's personal stats
      const [comRes, refRes, payRes] = await Promise.all([
        supabase.from('referral_commissions').select('commission_amount').eq('referral_id', session.user.id).eq('status', 'approved'),
        supabase.from('referrals').select('referred_user_id', { count: 'exact', head: true }).eq('referrer_id', session.user.id),
        supabase.from('payout_requests').select('amount').eq('user_id', session.user.id).eq('status', 'paid'),
      ])
      if (cancelled) return
      const coms = (comRes.data || []).reduce((s, c) => s + Number(c.commission_amount || 0), 0)
      const pays = (payRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      setStats({ commissions: coms, referralUsers: refRes.count ?? 0, payouts: pays })
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const org = orgs.find((o) => o.id === activeOrgId) ?? null
  const plan = org ? planById(org.plan as never) : null
  const advanced = plan?.limits.analytics === 'advanced'

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]" aria-label="Back to dashboard">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Analytics</h1>
              <p className="text-sm text-[#849792]">{advanced ? 'Advanced insights' : 'Overview'} · {org?.name ?? 'Your workspace'}</p>
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
          <div className="mt-24 text-center text-sm text-[#718781]">Loading analytics…</div>
        ) : (
          <>
            {advanced && (
              <div className="card mt-8 rounded-3xl border-[rgba(216,180,90,0.45)] p-5">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-[#d8b45a]" />
                  <div>
                    <p className="text-sm font-bold text-[#e4c979]">Advanced analytics unlocked</p>
                    <p className="mt-0.5 text-xs text-[#849792]">
                      Team performance, sales tracking and revenue analytics arrive with the next update — your workspace is ready.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <MetricCard icon={<TrendingUp />} label="Total earned" value={`$${stats.commissions.toFixed(2)}`} />
              <MetricCard icon={<Users />} label="Referrals" value={String(stats.referralUsers)} />
              <MetricCard icon={<BarChart3 />} label="Paid out" value={`$${stats.payouts.toFixed(2)}`} />
            </div>

            <div className="card mt-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold">Performance summary</h2>
              <p className="mt-2 text-sm leading-6 text-[#849792]">
                {advanced
                  ? 'Sales performance tracking, project assignment and team revenue analytics are being rolled out for Pro workspaces. This panel will update automatically.'
                  : 'You are on the basic analytics tier. Upgrade to Agency Pro to unlock sales performance tracking, team revenue analytics and project assignment insights.'}
              </p>
              {!advanced && (
                <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-5 py-2.5 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)]">
                  Compare plans <ArrowLeft size={15} />
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <div className="text-[#687d76]">{icon}</div>
      <div className="mt-5 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-[#758983]">{label}</div>
    </div>
  )
}
