'use client'
import { useState } from 'react'
import { Card, LoadingOrError, TableControls, fmtDate, emptyNote, useAdminData } from '@/components/admin/shared'

export default function AuditSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 50
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
            placeholder="Filter by action or entity..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No audit entries yet. Admin actions are logged automatically.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">When</th>
                      <th className="py-2 pr-3 font-semibold">Action</th>
                      <th className="py-2 pr-3 font-semibold">Entity</th>
                      <th className="py-2 pr-3 font-semibold">Actor</th>
                      <th className="py-2 pr-3 font-semibold">Details</th>
                      <th className="py-2 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((a: any) => (
                      <tr key={a.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3 whitespace-nowrap text-xs text-[#7f918c]">{fmtDate(a.created_at)}</td>
                        <td className="py-3 pr-3"><span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[#9db8ff]">{a.action}</span></td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{a.entity} · <span className="text-xs text-[#7f918c]">{a.entity_id?.slice(0, 10) ?? '—'}</span></td>
                        <td className="py-3 pr-3 text-xs text-[#8fa29c]">{a.actor_email?.split('@')[0] ?? a.actor_ip ?? 'system'}</td>
                        <td className="max-w-[20rem] py-3 pr-3 text-xs text-[#8fa29c]">{a.details || '—'}</td>
                        <td className="py-3 text-xs text-[#7f918c]">{a.actor_ip ?? '—'}</td>
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
