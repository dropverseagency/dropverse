'use client'
import { useState } from 'react'
import { Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData } from '@/components/admin/shared'

export default function AuditSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 30
  const { data, loading, error } = useAdminData('audit', [String(page), String(limit), q])

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
            placeholder="Search audit events..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No audit events.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Event</th>
                      <th className="py-2 pr-3 font-semibold">Actor</th>
                      <th className="py-2 pr-3 font-semibold">Target</th>
                      <th className="py-2 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-3 font-semibold text-foreground">{row.action || row.event || '—'}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{row.actor_email || truncateId(row.actor_id)}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{row.target_type ? `${row.target_type} ${truncateId(row.target_id)}` : '—'}</td>
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
