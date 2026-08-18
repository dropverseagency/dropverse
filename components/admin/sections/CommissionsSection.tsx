'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, fmtUsd, adminMutate, useAdminData } from '@/components/admin/shared'

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['approved'],
  approved: ['available'],
  available: ['paid', 'reversed'],
  paid: [],
  reversed: [],
  cancelled: [],
}

export default function CommissionsSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('commissions', [String(page), String(limit), q])

  async function setStatus(commissionId: string, status: string) {
    if (!confirm(`Set commission to "${status}"?`)) return
    const res = await adminMutate('set_commission', { commissionId, status })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <TableControls
            q={q} onQ={(v) => { setQ(v); setPage(1) }}
            page={page} count={data.count ?? 0} limit={limit}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            placeholder="Search by affiliate or project..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No commissions yet. They appear after an admin confirms a referred project\'s payment.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Affiliate</th>
                      <th className="py-2 pr-3 font-semibold">Project</th>
                      <th className="py-2 pr-3 font-semibold">Base (DV revenue)</th>
                      <th className="py-2 pr-3 font-semibold">Rate</th>
                      <th className="py-2 pr-3 font-semibold">Commission</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Available at</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((c: any) => (
                      <tr key={c.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{c.affiliate_name || '—'}</div>
                          <div className="font-mono text-xs text-[#9db8ff]">{c.affiliate_code ?? '—'}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="max-w-[12rem] truncate text-[#c8d4d0]" title={c.project_title}>{c.project_title || truncateId(c.project_id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{fmtUsd(c.base_amount)}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{Math.round(Number(c.commission_rate ?? 0) * 100)}%</td>
                        <td className="py-3 pr-3 font-semibold text-[#6fbf73]">{fmtUsd(c.commission_amount)}</td>
                        <td className="py-3 pr-3"><Badge status={c.status} /></td>
                        <td className="py-3 pr-3 text-xs text-[#7f918c]">{c.available_at ? fmtDate(c.available_at) : '—'}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(NEXT_STATUS[c.status] ?? []).map((s) => (
                              <button
                                key={s}
                                onClick={() => setStatus(c.id, s)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${s === 'paid' ? 'bg-[#6fbf73] text-[#062011] hover:bg-[#95d998]' : s === 'reversed' ? 'border border-red-400/30 text-red-300 hover:bg-red-400/10' : 'border border-[rgba(216,180,90,0.35)] text-[#e4c979] hover:bg-[rgba(216,180,90,0.12)]'}`}
                              >
                                {s === 'approved' ? 'Approve' : s === 'available' ? 'Make available' : s === 'paid' ? 'Mark paid' : 'Reverse'}
                              </button>
                            ))}
                            {NEXT_STATUS[c.status]?.length === 0 && <span className="text-xs text-[#7f918c]">Final</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
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
