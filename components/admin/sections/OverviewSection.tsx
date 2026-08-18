'use client'
import { fmtUsd, fmtDate, StatCard, Card, useAdminData, LoadingOrError, Badge } from '@/components/admin/shared'

export default function OverviewSection() {
  const { data, loading, error } = useAdminData('overview')

  const t = data?.totals ?? {}
  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Users" value={String(t.users ?? 0)} />
            <StatCard label="Agencies" value={String(t.agencies ?? 0)} />
            <StatCard label="Projects" value={String(t.projects ?? 0)} />
            <StatCard label="Payments confirmed" value={String(t.paymentsConfirmed ?? 0)} sub={`Pending: ${t.paymentsPending ?? 0}`} />
            <StatCard label="Active referrals" value={String(t.activeReferrals ?? 0)} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <StatCard label="DV Revenue (commissions base)" value={fmtUsd(t.dvRevenue)} sub="Sum of approved/paid commission base amounts" />
            <StatCard label="Total Payouts" value={fmtUsd(t.totalPayouts)} sub="Approved payout requests" />
            <StatCard label="Commissions" value={`${t.commissionsPending ?? 0} pending`} sub={`${t.commissionsPaid ?? 0} paid`} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
