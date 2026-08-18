'use client'
import { useState } from 'react'
import { Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData } from '@/components/admin/shared'

export default function FreelancersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('freelancers', [String(page), String(limit), q])

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
            placeholder="Search freelancer name or service..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No freelancers registered yet. Freelancers can be added from the marketplace section later.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Freelancer</th>
                      <th className="py-2 pr-3 font-semibold">Service</th>
                      <th className="py-2 pr-3 font-semibold">Rating</th>
                      <th className="py-2 font-semibold">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((f: any) => (
                      <tr key={f.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{f.full_name || f.username || '—'}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(f.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.service_name ?? '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.rating ?? '—'}</td>
                        <td className="py-3 text-xs text-[#7f918c]">{fmtDate(f.created_at)}</td>
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
