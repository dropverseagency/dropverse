'use client'
import Link from 'next/link'
import { fmtUsd, fmtDate, Card, useAdminData, LoadingOrError, Badge } from '@/components/admin/shared'
import { Users, Building2, FolderKanban, CreditCard, Users2, Coins, Wallet, TrendingUp } from 'lucide-react'

function GroupCard({ icon: Icon, label, value, sub, href }: { icon: any; label: string; value: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-[rgba(216,180,90,0.35)] hover:bg-[rgba(216,180,90,0.06)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(216,180,90,0.14)] text-[#d8b45a]">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xl font-extrabold text-[#f0f4f2]">{value}</div>
        <div className="text-xs text-[#7f918c]">{label}</div>
        {sub ? <div className="truncate text-[11px] text-[#5f746e]">{sub}</div> : null}
      </div>
      <span className="ml-auto shrink-0 text-xs text-[#5f746e] transition group-hover:text-[#e4c979]">Open →</span>
    </Link>
  )
}

export default function OverviewSection() {
  const { data, loading, error } = useAdminData('overview')

  const t = data?.totals ?? {}
  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          {/* People */}
          <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#7f918c]">People</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
            <GroupCard icon={Users} label="Users" value={String(t.users ?? 0)} href="/admin/users" />
            <GroupCard icon={Building2} label="Agencies" value={String(t.agencies ?? 0)} href="/admin/agencies" />
          </div>

          {/* Work & Money */}
          <h2 className="mb-2 mt-6 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#7f918c]">Work & Payments</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GroupCard icon={FolderKanban} label="Projects" value={String(t.projects ?? 0)} href="/admin/projects" />
            <GroupCard icon={CreditCard} label="Payments confirmed" value={String(t.paymentsConfirmed ?? 0)} sub={`Pending: ${t.paymentsPending ?? 0}`} href="/admin/payments" />
            <GroupCard icon={Wallet} label="DV Revenue" value={fmtUsd(t.dvRevenue)} sub="Commission base" href="/admin/commissions" />
            <GroupCard icon={Coins} label="Total payouts" value={fmtUsd(t.totalPayouts)} sub={`${t.commissionsPending ?? 0} commissions pending`} href="/admin/commissions" />
          </div>

          {/* Growth */}
          <h2 className="mb-2 mt-6 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#7f918c]">Affiliate Program</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
            <GroupCard icon={Users2} label="Active referrals" value={String(t.activeReferrals ?? 0)} sub={`${t.commissionsPaid ?? 0} commissions paid`} href="/admin/affiliates" />
            <GroupCard icon={TrendingUp} label="Paid commissions" value={String(t.commissionsPaid ?? 0)} sub={`${t.commissionsPending ?? 0} pending`} href="/admin/commissions" />
          </div>

          {/* Recent activity */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card title="Recent projects">
              {!(data.recentProjects?.length) ? (
                <p className="py-6 text-center text-sm text-[#7f918c]">No projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentProjects.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#f0f4f2]">{p.title}</div>
                        <div className="text-xs text-[#7f918c]">{p.project_type} · {p.billing_interval} · {fmtDate(p.created_at)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm">
                        <span className="text-[#c8d4d0]">{fmtUsd(p.client_price)}</span>
                        <Badge status={p.payment_status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Recent audit activity">
              {!(data.recentAudit?.length) ? (
                <p className="py-6 text-center text-sm text-[#7f918c]">No audit entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentAudit.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[#9db8ff]">{a.action}</span>
                        <span className="ml-2 text-[#8fa29c]">{a.entity} · {a.entity_id?.slice(0, 8) ?? '—'}</span>
                      </div>
                      <div className="shrink-0 text-xs text-[#7f918c]">
                        {a.actor_email?.split('@')[0] ?? 'system'} · {fmtDate(a.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
