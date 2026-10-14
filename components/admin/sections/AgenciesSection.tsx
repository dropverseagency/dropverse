'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData } from '@/components/admin/shared'

export default function AgenciesSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('agencies', [String(page), String(limit), q])

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
            placeholder="Search agency name or industry..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No agencies found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Agency</th>
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-3 font-semibold">Plan</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Team size</th>
                      <th className="py-2 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((o: any) => (
                      <tr key={o.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-foreground">{o.name}</div>
                          <div className="text-xs text-muted-foreground">{o.slug} · {truncateId(o.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">{o.type}</td>
                        <td className="py-3 pr-3"><Badge status={o.plan ?? ''} /></td>
                        <td className="py-3 pr-3"><Badge status={o.status ?? 'active'} /></td>
                        <td className="py-3 pr-3 text-muted-foreground">{o.team_size ?? '—'}</td>
                        <td className="py-3 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
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
