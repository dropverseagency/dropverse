'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, fmtUsd, adminMutate, useAdminData } from '@/components/admin/shared'

export default function ProjectsSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('projects', [String(page), String(limit), q, status])

  async function confirmPayment(projectId: string) {
    if (!confirm('Confirm payment and release commissions for this project? This is irreversible for this payment.')) return
    const res = await adminMutate('confirm_payment', { projectId })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <TableControls
              q={q} onQ={(v) => { setQ(v); setPage(1) }}
              page={page} count={data.count ?? 0} limit={limit}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              placeholder="Search project title..."
            />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="rounded-lg border border-white/10 bg-[#071210] px-3 py-2 text-sm text-[#d9e0dc] outline-none"
            >
              <option value="">All payment statuses</option>
              <option value="PAYMENT_PENDING">Pending</option>
              <option value="PAYMENT_CONFIRMED">Confirmed</option>
              <option value="PAYMENT_FAILED">Failed</option>
              <option value="PAYMENT_REFUNDED">Refunded</option>
            </select>
          </div>
          <Card>
            {!data.rows?.length ? emptyNote('No projects found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Project</th>
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-3 font-semibold">Client price</th>
                      <th className="py-2 pr-3 font-semibold">DV cost</th>
                      <th className="py-2 pr-3 font-semibold">Seller profit</th>
                      <th className="py-2 pr-3 font-semibold">Payment</th>
                      <th className="py-2 pr-3 font-semibold">Method</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((p: any) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="max-w-[16rem] truncate font-semibold text-[#f0f4f2]" title={p.title}>{p.title}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(p.id)} · {fmtDate(p.created_at)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{p.project_type}<span className="text-xs text-[#7f918c]"> · {p.billing_interval}</span></td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{fmtUsd(p.client_price)}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{fmtUsd(p.fulfillment_cost)}</td>
                        <td className="py-3 pr-3 font-semibold text-[#6fbf73]">{fmtUsd(p.seller_profit)}</td>
                        <td className="py-3 pr-3"><Badge status={p.payment_status} /></td>
                        <td className="py-3 pr-3 text-xs text-[#7f918c]">{p.payment_method}</td>
                        <td className="py-3">
                          {p.payment_status !== 'PAYMENT_CONFIRMED' ? (
                            <button
                              onClick={() => confirmPayment(p.id)}
                              className="rounded-lg bg-[#d8b45a] px-3 py-1.5 text-xs font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
                            >
                              Confirm & pay out
                            </button>
                          ) : (
                            <span className="text-xs text-[#6fbf73]">Confirmed</span>
                          )}
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
