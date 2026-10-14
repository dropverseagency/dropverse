'use client'
import { useState } from 'react'
import {
  Badge,
  Card,
  LoadingOrError,
  TableControls,
  fmtDate,
  emptyNote,
  fmtUsd,
  adminMutate,
  useAdminData,
} from '@/components/admin/shared'
import { CheckCircle2, RotateCcw } from 'lucide-react'

const NEXT_STATUS: Record<string, { value: string; label: string; color: string } | null> = {
  pending: { value: 'approved', label: 'Approve', color: 'border-success/40 bg-success/10 text-success' },
  approved: { value: 'available', label: 'Make available', color: 'border-primary/40 bg-primary/10 text-primary' },
  available: { value: 'paid', label: 'Mark paid', color: 'border-primary/40 bg-primary/10 text-primary' },
  paid: null,
  reversed: null,
}

export default function CommissionsSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('commissions', [String(page), String(limit), q])

  async function setStatus(commissionId: string, status: string) {
    if (!confirm(`Change commission status to "${status}"?`)) return
    const res = await adminMutate('set_commission', { commissionId, status })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <div className="mb-4 rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Payout cycle</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-muted px-3 py-1">Pending</span>
              <span>→</span>
              <span className="rounded-full bg-muted px-3 py-1">Approved</span>
              <span>→</span>
              <span className="rounded-full bg-muted px-3 py-1">Available</span>
              <span>→</span>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">Paid</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A row appears only after a referred project payment is confirmed. Use the action on each row to move it one
              step. Reverse stays available until it is reversed.
            </p>
          </div>
          <TableControls
            q={q}
            onQ={(v) => {
              setQ(v)
              setPage(1)
            }}
            page={page}
            count={0}
            limit={limit}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            placeholder="Search by commission id..."
          />
          <Card>
            {!data.rows?.length ? (
              emptyNote("No commissions yet. They appear after an admin confirms a referred project's payment.")
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Affiliate</th>
                      <th className="py-2 pr-3 font-semibold">Project</th>
                      <th className="py-2 pr-3 font-semibold">Base (DV revenue)</th>
                      <th className="py-2 pr-3 font-semibold">Rate</th>
                      <th className="py-2 pr-3 font-semibold">Commission</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Created</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((c: any) => {
                      const next = NEXT_STATUS[c.status]
                      return (
                        <tr key={c.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-foreground">
                              {c.referrerProfile?.full_name || c.referrerProfile?.username || '—'}
                            </div>
                            <div className="font-mono text-xs text-primary">{c.referralCode ?? '—'}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="max-w-[12rem] truncate text-muted-foreground" title={c.project?.title}>
                              {c.project?.title || '—'}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-muted-foreground">{fmtUsd(c.base_amount)}</td>
                          <td className="py-3 pr-3 text-muted-foreground">
                            {Math.round(Number(c.commission_rate ?? 0) * 100)}%
                          </td>
                          <td className="py-3 pr-3 font-semibold text-success">{fmtUsd(c.commission_amount)}</td>
                          <td className="py-3 pr-3">
                            <Badge status={c.status} label={c.status} />
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted-foreground">{fmtDate(c.created_at)}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {next ? (
                                <button
                                  onClick={() => setStatus(c.id, next.value)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:opacity-90 ${next.color}`}
                                >
                                  <CheckCircle2 size={12} /> {next.label}
                                </button>
                              ) : null}
                              {c.status !== 'reversed' ? (
                                <button
                                  onClick={() => setStatus(c.id, 'reversed')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger transition hover:bg-danger/10"
                                >
                                  <RotateCcw size={12} /> Reverse
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Final</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
