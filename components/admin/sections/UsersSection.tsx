'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, adminMutate, useAdminData } from '@/components/admin/shared'

export default function UsersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('users', [String(page), String(limit), q])

  async function changeRole(userId: string, role: string) {
    if (!confirm(`Change this user's role to "${role}"?`)) return
    const res = await adminMutate('set_user_role', { userId, role })
    if (res.error) alert(String(res.error))
    window.location.reload()
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
            placeholder="Search by name or username..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No users found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">User</th>
                      <th className="py-2 pr-3 font-semibold">Email</th>
                      <th className="py-2 pr-3 font-semibold">Phone</th>
                      <th className="py-2 pr-3 font-semibold">Username</th>
                      <th className="py-2 pr-3 font-semibold">Role</th>
                      <th className="py-2 font-semibold">Joined</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((u: any) => (
                      <tr key={u.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{u.full_name || '—'}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(u.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.email || '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.phone || '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.username || '—'}</td>
                        <td className="py-3 pr-3"><Badge status={u.role ?? 'user'} label={u.role ?? 'user'} /></td>
                        <td className="py-3 pr-3 text-xs text-[#7f918c]">{fmtDate(u.created_at)}</td>
                        <td className="py-3">
                          <select
                            value={u.role ?? 'user'}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            className="rounded-lg border border-white/10 bg-[#071210] px-2 py-1.5 text-xs text-[#d9e0dc] outline-none"
                          >
                            <option value="user">user</option>
                            <option value="manager">manager</option>
                            <option value="admin">admin</option>
                          </select>
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
