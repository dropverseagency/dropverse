'use client'
import { useState } from 'react'
import {
  Badge,
  Card,
  LoadingOrError,
  TableControls,
  truncateId,
  fmtDate,
  emptyNote,
  fmtUsd,
  adminMutate,
  useAdminData,
} from '@/components/admin/shared'
import { ShieldCheck, ShieldX, Coins, Users2 } from 'lucide-react'

function ProfilePhoto({ name }: { name: string | null }) {
  const initials =
    (name ?? '?')
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-extrabold tracking-wide text-primary">
      {initials}
    </div>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'border-danger/35 bg-danger/10 text-danger',
    approved: 'border-success/35 bg-success/10 text-success',
    available: 'border-primary/40 bg-primary/10 text-primary',
    paid: 'border-primary/35 bg-primary/10 text-primary',
    reversed: 'border-border bg-muted text-muted-foreground',
  }
  const cls = map[status] ?? map.pending
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{status}</span>
}

export default function AffiliatesSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('affiliates', [String(page), String(limit), q])
  const [detailRow, setDetailRow] = useState<any | null>(null)

  async function setReferralActive(profileId: string, active: boolean) {
    if (!confirm(`${active ? 'Enable' : 'Disable'} this user's affiliate participation?`)) return
    const res = await adminMutate('set_referral_active', { profileId, active })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Affiliates with referral codes. Tap a row to expand their referrals and commissions.
          </p>
          <TableControls
            q={q}
            onQ={(v) => {
              setQ(v)
              setPage(1)
            }}
            page={page}
            count={data.count ?? 0}
            limit={limit}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            placeholder="Search by code..."
          />
          <Card>
            {!data.rows?.length ? (
              emptyNote('No affiliate data found.')
            ) : (
              <div className="divide-y divide-border">
                {data.rows.map((a: any) => {
                  const profile = a.profile ?? {}
                  const expanded = detailRow?.id === a.id
                  const total = (a.referrals ?? []).reduce(
                    (s: number, r: any) =>
                      s +
                      (r.commissions ?? []).reduce(
                        (t: number, c: any) => t + Number(c.commission_amount || 0),
                        0,
                      ),
                    0,
                  )
                  return (
                    <div key={a.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted"
                        onClick={() => setDetailRow(expanded ? null : a)}
                      >
                        <ProfilePhoto name={profile.full_name ?? null} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground">
                            {profile.full_name || profile.username || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @{profile.username || '—'} · Code{' '}
                            <span className="font-mono text-primary">{a.code}</span>
                          </div>
                        </div>
                        <div className="hidden text-right text-xs text-muted-foreground sm:block">
                          <div className="font-semibold text-foreground">{a.referralCount ?? 0} referrals</div>
                          <div>{a.commissionCount ?? 0} commissions</div>
                        </div>
                        <div className="hidden font-semibold text-success sm:block">{fmtUsd(total)}</div>
                        <Badge status={a.active ? 'approved' : 'cancelled'} label={a.active ? 'active' : 'disabled'} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setReferralActive(a.user_id, !a.active)
                          }}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                            a.active
                              ? 'border-danger/30 text-danger hover:bg-danger/10'
                              : 'border-primary/35 text-primary hover:bg-primary/10'
                          }`}
                        >
                          {a.active ? (
                            <>
                              <ShieldX size={12} /> Disable
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={12} /> Enable
                            </>
                          )}
                        </button>
                      </button>
                      {expanded && (
                        <div className="space-y-3 border-t border-border bg-muted px-3 py-4">
                          {!a.referrals?.length ? (
                            <p className="text-xs text-muted-foreground">No referrals recorded for this code yet.</p>
                          ) : (
                            a.referrals.map((r: any) => (
                              <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <Users2 size={13} className="text-primary" />
                                  <span className="font-semibold text-foreground">Referred user</span>
                                  <span className="font-mono text-muted-foreground">
                                    {truncateId(r.referred_user_id)}
                                  </span>
                                  <span className="ml-auto text-muted-foreground">
                                    {r.source_channel ?? 'direct'} · {fmtDate(r.attributed_at)}
                                  </span>
                                </div>
                                {(r.commissions ?? []).length ? (
                                  <div className="mt-2 space-y-1">
                                    {r.commissions.map((c: any) => (
                                      <div
                                        key={c.id}
                                        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs"
                                      >
                                        <Coins size={12} className="text-primary" />
                                        <span className="text-muted-foreground">
                                          Base {fmtUsd(c.base_amount)} ·{' '}
                                          {Math.round(Number(c.commission_rate || 0) * 100)}%
                                        </span>
                                        <span className="font-semibold text-primary">
                                          Earned {fmtUsd(c.commission_amount)}
                                        </span>
                                        <span className="ml-auto">
                                          <CommissionStatusBadge status={c.status} />
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-xs text-muted-foreground">No commissions yet.</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
