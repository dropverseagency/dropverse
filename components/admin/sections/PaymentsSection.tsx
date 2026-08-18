'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, fmtUsd, useAdminData } from '@/components/admin/shared'

export default function PaymentsSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('payments', [String(page), String(limit), q])

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
            placeholder="Search projects by title..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No projects with payment data found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Project</th>
                      <th className="py-2 pr-3 font-semibold">Amount</th>
                      <th className="py-2 pr-3 font-semibold">DV revenue</th>
                      <th className="py-2 pr-3 font-semibold">Method</th>
                      <th className="py-2 pr-3 font-semibold">Payment status</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((p: any) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="max-w-[16rem] truncate font-semibold text-[#f0f4f2]" title={p.title}>{p.title}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(p.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{fmtUsd(p.client_price)}</td>
                        <td className="py-3 pr-3 font-semibold text-[#e4c979]">{fmtUsd(p.fulfillment_cost)}</td>
                        <td className="py-3 pr-3 text-xs text-[#7f918c]">{p.payment_method}</td>
                        <td className="py-3 pr-3"><Badge status={p.payment_status} /></td>
                        <td className="py-3"><Badge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="mt-3 text-xs text-[#7f918c]">No real payments are processed on this platform yet. "Confirm & pay out" on the Projects tab is the manual payout action.</p>
        </>
      ) : null}
    </div>
  )
}
