'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, fmtUsd, emptyNote, adminMutate, useAdminData } from '@/components/admin/shared'
import { ShieldPlus, MailPlus, X, User as UserIcon, FolderKanban, Users2, Coins, Building2, CheckCircle2, Clock, Link2 } from 'lucide-react'

function ProfilePhoto({ name }: { name: string | null }) {
  const initials = (name ?? '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?'
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(216,180,90,0.18)] font-display text-xs font-extrabold tracking-wide text-[#f0d98b]">
      {initials}
    </div>
  )
}

export default function UsersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('users', [String(page), String(limit), q])

  const [modal, setModal] = useState<null | 'role' | 'invite' | 'detail'>(null)
  const [roleUserId, setRoleUserId] = useState('')
  const [roleValue, setRoleValue] = useState('admin')
  const [roleBusy, setRoleBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [detailId, setDetailId] = useState('')
  const { data: detail, loading: detailLoading, error: detailError } = useAdminData('user_detail', [detailId])

  function openDetail(userId: string) {
    setDetailId(userId)
    setModal('detail')
  }

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
      const err = String(res.error)
      if (err === 'INVITE_FAILED') {
        setInviteResult(`Could not send the invite email right now. Ask the person to sign up with this email, then promote them to admin from the Users list.`)
      } else {
        setInviteResult(`Error: ${err}. Try again or check the email.`)
      }
    } else {
      setInviteResult(`Success! ${inviteEmail} is now an admin.`)
      setInviteEmail('')
      setTimeout(() => { setModal(null); setInviteResult(null) }, 2500)
      window.location.reload()
    }
  }

  const p = detail?.profile ?? {}
  const projects = detail?.projects ?? []
  const refsMade = detail?.referralsMade ?? []
  const referredBy = detail?.referredBy ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setInviteEmail(''); setInviteResult(null); setModal('invite') }}
          className="inline-flex items-center gap-2 rounded-lg border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-3.5 py-2 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.20)]"
        >
          <MailPlus size={16} /> Add Admin by Email Invite
        </button>
        <p className="text-xs text-[#7f918c]">Tap any user row to open their full profile: personal data, projects, and affiliate activity.</p>
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
      {modal === 'detail' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0a2926] sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h3 className="font-display text-lg font-extrabold text-[#f0f4f2]">User Profile</h3>
              <button onClick={() => { setModal(null); setDetailId('') }} className="rounded-lg border border-white/10 p-1.5 text-[#7f918c] hover:bg-white/5 hover:text-[#f0f4f2]">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              {detailLoading ? (
                <p className="py-10 text-center text-sm text-[#7f918c]">Loading user profile...</p>
              ) : detailError ? (
                <p className="py-10 text-center text-sm text-[#f5a0a0]">Could not load this profile.</p>
              ) : !detail ? null : (
                <div className="space-y-5">
                  {/* Identity */}
                  <div className="flex items-center gap-3">
                    <ProfilePhoto name={p.full_name} />
                    <div className="min-w-0">
                      <div className="truncate font-display text-lg font-extrabold text-[#f0f4f2]">{p.full_name || '—'}</div>
                      <div className="text-xs text-[#7f918c]">
                        @{p.username || '—'} · Joined {fmtDate(p.created_at)}
                      </div>
                    </div>
                    <span className="ml-auto"><Badge status={p.role ?? 'user'} label={p.role ?? 'user'} /></span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { icon: UserIcon, label: 'Email', value: p.email ?? '—' },
                      { icon: CheckCircle2, label: 'Email verified', value: p.email_confirmed_at ? fmtDate(p.email_confirmed_at) : 'No' },
                      { icon: Link2, label: 'Phone', value: p.phone || '—' },
                      { icon: Link2, label: 'Telegram', value: p.telegram_username ? `@${p.telegram_username}` : '—' },
                      { icon: Building2, label: 'Organizations owned', value: String(detail.organizations?.length ?? 0) },
                      { icon: Coins, label: 'Referral earnings', value: fmtUsd(detail.referralCommissionEarned) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm">
                        <item.icon size={14} className="shrink-0 text-[#d8b45a]" />
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-[#7f918c]">{item.label}</div>
                          <div className="truncate font-medium text-[#d9e0dc]">{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Projects */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#f0d98b]">
                      <FolderKanban size={15} /> Projects ({projects.length})
                    </h4>
                    {!projects.length ? (
                      <div className="rounded-lg border border-white/5 bg-white/[0.02] py-5 text-center text-sm text-[#7f918c]">No projects yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {projects.map((pr: any) => (
                          <div key={pr.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate font-semibold text-[#f0f4f2]">{pr.title}</span>
                            <span className="text-xs text-[#7f918c]">{pr.project_type} · {fmtUsd(pr.client_price)}</span>
                            <Badge status={pr.payment_status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Referral activity */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#f0d98b]">
                        <Users2 size={15} /> Referrals made ({refsMade.length})
                      </h4>
                      {!refsMade.length ? (
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-4 text-center text-xs text-[#7f918c]">No referrals yet.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {refsMade.map((r: any) => (
                            <div key={r.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[#d9e0dc]">Code <span className="font-mono text-[#f0d98b]">{r.referral_code}</span></span>
                                <span className="shrink-0 text-[#7f918c]">{fmtDate(r.attributed_at)}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-[#7f918c]">
                                Referred user: {truncateId(r.referred_user_id)} · Commissions: {r.commissions?.length ?? 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#f0d98b]">
                        <Clock size={15} /> Referred by
                      </h4>
                      {!referredBy.length ? (
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-4 text-center text-xs text-[#7f918c]">Not referred by anyone.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {referredBy.map((r: any) => (
                            <div key={r.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-[#d9e0dc]">
                              Referrer {truncateId(r.referrer_id)} · {fmtDate(r.attributed_at)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                      <tr key={u.id} className="cursor-pointer border-b border-white/5 last:border-0 transition hover:bg-white/[0.04]" onClick={() => openDetail(u.id)}>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <ProfilePhoto name={u.full_name} />
                            <div>
                              <div className="font-semibold text-[#f0f4f2]">{u.full_name || '—'}</div>
                              <div className="text-xs text-[#7f918c]">{truncateId(u.id)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.email || '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.phone || '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{u.username || '—'}</td>
                        <td className="py-3 pr-3"><Badge status={u.role ?? 'user'} label={u.role ?? 'user'} /></td>
                        <td className="py-3 pr-3 text-xs text-[#7f918c]">{fmtDate(u.created_at)}</td>
                        <td className="py-3">
                          <select
                            value={u.role ?? 'user'}
                            onChange={(e) => { e.stopPropagation(); changeRole(u.id, e.target.value) }}
                            onClick={(e) => e.stopPropagation()}
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
          <p className="mt-3 text-xs text-[#7f918c]">Tip: rows are clickable — tap a user to see their full data, work, and affiliate activity.</p>
        </>
      ) : null}
    </div>
  )
}
