'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData } from '@/components/admin/shared'

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
            placeholder="Search freelancers..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No freelancers found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Name</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Skills</th>
                      <th className="py-2 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-foreground">{row.full_name || row.username || '—'}</div>
                          <div className="text-xs text-muted-foreground">{truncateId(row.id)}</div>
                        </td>
                        <td className="py-3 pr-3"><Badge status={row.status ?? 'active'} /></td>
                        <td className="py-3 pr-3 text-muted-foreground">{Array.isArray(row.skills) ? row.skills.join(', ') : '—'}</td>
                        <td className="py-3 text-xs text-muted-foreground">{fmtDate(row.created_at)}</td>
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
