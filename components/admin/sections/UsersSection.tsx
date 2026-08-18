'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, adminMutate, useAdminData } from '@/components/admin/shared'
import { ShieldPlus, MailPlus } from 'lucide-react'

export default function UsersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('users', [String(page), String(limit), q])

  const [modal, setModal] = useState<null | 'role' | 'invite'>(null)
  const [roleUserId, setRoleUserId] = useState('')
  const [roleValue, setRoleValue] = useState('admin')
  const [roleBusy, setRoleBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)

  async function changeRole(userId: string, role: string) {
    setRoleUserId(userId)
    setRoleValue(role === 'admin' ? 'manager' : 'admin')
    setModal('role')
  }

  async function submitRoleChange() {
    if (roleBusy) return
    setRoleBusy(true)
    const res = await adminMutate('set_user_role', { userId: roleUserId, role: roleValue })
    setRoleBusy(false)
    if (res.error) {
      alert(String(res.error))
    } else {
      setModal(null)
      window.location.reload()
    }
  }

  async function submitInvite() {
    if (inviteBusy) return
    setInviteBusy(true)
    const res = await adminMutate('confirm_user_invitation', { email: inviteEmail.trim() })
    setInviteBusy(false)
    if (res.error) {
      setInviteResult(`Error: ${String(res.error)}. Try again or check the email.`)
    } else {
      setInviteResult(`Success! ${inviteEmail} is now an admin.`)
      setInviteEmail('')
      setTimeout(() => { setModal(null); setInviteResult(null) }, 2500)
      window.location.reload()
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setInviteEmail(''); setInviteResult(null); setModal('invite') }}
          className="inline-flex items-center gap-2 rounded-lg border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-3.5 py-2 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.20)]"
        >
          <MailPlus size={16} /> Add Admin by Email Invite
        </button>
      </div>
      {modal === 'role' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a2926] p-5">
            <h3 className="text-base font-bold text-[#f0f4f2]">Change role</h3>
            <p className="mt-1 text-xs text-[#7f918c]">User {truncateId(roleUserId)}</p>
            <select
              value={roleValue}
              onChange={(e) => setRoleValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#071210] px-3 py-2 text-sm text-[#d9e0dc] outline-none"
            >
              <option value="user">user</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#d9e0dc] hover:bg-white/5">Cancel</button>
              <button onClick={submitRoleChange} disabled={roleBusy} className="rounded-lg bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b] disabled:opacity-60">
                {roleBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'invite' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a2926] p-5">
            <h3 className="text-base font-bold text-[#f0f4f2]">Add admin by email</h3>
            <p className="mt-1 text-xs leading-5 text-[#7f918c]">
              Sends an invite to this email. If the address is new, the person gets a link to set their password; if they already have an account, they become an admin immediately.
            </p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="newadmin@example.com"
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#071210] px-3 py-2.5 text-sm text-[#d9e0dc] outline-none focus:border-[rgba(216,180,90,0.5)]"
            />
            {inviteResult ? (
              <p className={`mt-2 text-xs ${inviteResult.startsWith('Success') ? 'text-[#7fd8a8]' : 'text-[#f5a0a0]'}`}>{inviteResult}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#d9e0dc] hover:bg-white/5">Cancel</button>
              <button onClick={submitInvite} disabled={inviteBusy || !inviteEmail.trim()} className="rounded-lg bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b] disabled:opacity-60">
                <span className="inline-flex items-center gap-2"><ShieldPlus size={15} /> {inviteBusy ? 'Sending...' : 'Invite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
