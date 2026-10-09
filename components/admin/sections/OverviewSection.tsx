'use client'
import Link from 'next/link'
import { fmtUsd, fmtDate, Card, useAdminData, LoadingOrError, Badge } from '@/components/admin/shared'
import { Users, Building2, FolderKanban, Package, CreditCard, Users2, Coins, Wallet, TrendingUp } from 'lucide-react'
import LiveVisits from '@/components/admin/LiveVisits'

function GroupCard({ icon: Icon, label, value, sub, href }: { icon: any; label: string; value: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[rgba(216,180,90,0.16)] bg-[#0c2420] p-4 transition hover:border-[rgba(216,180,90,0.40)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.16)] text-[#f0d98b]">
          <Icon size={18} />
        </div>
        <span className="text-xs font-semibold text-[#e4c979]">Open</span>
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-extrabold leading-none text-white">{value}</div>
        <div className="mt-2 text-sm text-[#d5e0db]">{label}</div>
        {sub ? <div className="mt-1 text-xs leading-5 text-[#8ea09a]">{sub}</div> : null}
      </div>
    </Link>
  )
}

export default function OverviewSection() {
  const { data, loading, error } = useAdminData('overview')
  const t = data?.totals ?? {}

  return (
    <div>
      <LiveVisits />
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <h2 className="mb-3 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#e4c979]">People</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GroupCard icon={Users} label="Users" value={String(t.users ?? 0)} sub={t.users ? undefined : 'No signups yet'} href="/admin/users" />
            <GroupCard icon={Building2} label="Agencies" value={String(t.agencies ?? 0)} sub={t.agencies ? undefined : 'No agency workspace yet'} href="/admin/agencies" />
            <GroupCard icon={TrendingUp} label="Page visits, 30 days" value={t.visitors30d == null ? '—' : String(t.visitors30d)} sub={t.visitors30d == null ? 'Tracking table is not ready' : 'Public pages only, one visit a day'} href="/admin" />
          </div>

          <h2 className="mb-3 mt-8 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#e4c979]">Work and payments</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <GroupCard icon={FolderKanban} label="Open projects" value={String(t.openProjects ?? 0)} sub={t.openProjects ? `${t.projects ?? 0} total` : 'No open projects yet'} href="/admin/projects" />
            <GroupCard icon={Package} label="Published services" value={String(t.publishedServices ?? 0)} sub={t.publishedServices ? 'Showing on the landing page' : 'Landing is using built-in services'} href="/admin/services" />
            <GroupCard icon={CreditCard} label="Payments confirmed" value={String(t.paymentsConfirmed ?? 0)} sub={`Pending: ${t.paymentsPending ?? 0} · invoices paid ${fmtUsd(t.paidInvoiceVolume)}`} href="/admin/payments" />
            <GroupCard icon={Wallet} label="Confirmed payments" value={fmtUsd(t.dvRevenue)} sub={t.pendingPaymentVolume ? `${fmtUsd(t.pendingPaymentVolume)} still pending` : 'Paid project volume'} href="/admin/payments" />
            <GroupCard icon={Coins} label="Total payouts" value={fmtUsd(t.totalPayouts)} sub={`${t.commissionsPending ?? 0} commissions pending`} href="/admin/commissions" />
          </div>

          <h2 className="mb-3 mt-8 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#7ee0cf]">Affiliate program</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GroupCard icon={Users2} label="Active referrals" value={String(t.activeReferrals ?? 0)} sub={`${t.commissionsPaid ?? 0} commissions paid`} href="/admin/affiliates" />
            <GroupCard icon={TrendingUp} label="Paid commissions" value={String(t.commissionsPaid ?? 0)} sub={`${t.commissionsPending ?? 0} pending`} href="/admin/commissions" />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card title="Recent projects">
              {!(data.recentProjects?.length) ? (
                <p className="py-6 text-center text-sm text-[#7f918c]">No projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentProjects.map((p: any) => (
                    <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#f0f4f2]">{p.title}</div>
                        <div className="text-xs text-[#7f918c]">{p.project_type} · {p.billing_interval} · {fmtDate(p.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
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
                    <div key={a.id} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm">
                      <span className="w-fit rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[#9db8ff]">{a.action}</span>
                      <span className="text-[#8fa29c]">{a.entity} · {a.entity_id?.slice(0, 8) ?? '—'}</span>
                      <span className="text-xs text-[#7f918c]">{a.actor_email?.split('@')[0] ?? 'system'} · {fmtDate(a.created_at)}</span>
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
