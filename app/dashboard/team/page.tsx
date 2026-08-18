'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Crown,
  Mail,
  ShieldCheck,
  Send,
  UserPlus,
  Users,
} from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { canManageTeam, isManager, type OrgRow } from '../../../lib/orgs'
import { MANAGEABLE_ROLES, ROLE_LABELS, type OrgRole } from '../../../lib/planConfig'

interface MemberRow {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  status: 'invited' | 'active' | 'suspended'
  joined_at: string | null
  profile: { full_name: string | null; username: string | null } | null
}

interface InvitationRow {
  id: string
  organization_id: string
  email: string
  role: OrgRole
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  invited_at: string
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<OrgRow | null>(null)
  const [role, setRole] = useState<OrgRole | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InvitationRow[]>([])
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[]>([])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      let session = null
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) { session = data.session; break }
        if (i < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session || cancelled) { window.location.assign('/login?redirect=%2Fdashboard%2Fteam'); return }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at')
        .eq('status', 'active')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false })
      if (cancelled) return
      const orgList = (orgRows as OrgRow[] | null) ?? []
      setOrgs(orgList)
      if (orgList.length === 0) {
        // Personal account, no team — redirect to create flow landing
        setLoading(false)
        return
      }
      const first = orgList[0]
      setOrg(first)
      setActiveOrgId(first.id)
      const { data: mems } = await supabase
        .from('organization_members')
        .select('organization_id, role, status')
        .eq('user_id', session.user.id)
      const r = mems?.find((m) => m.organization_id === first.id)
      setRole((r?.role as OrgRole) ?? null)
      await loadMembersAndInvites(supabase, first.id)
      if (cancelled) return
      setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMembersAndInvites(supabase: ReturnType<typeof createClient>, orgId: string) {
    const { data: mems } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, status, joined_at, profile:profiles!inner(full_name, username)')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true })
    setMembers((mems as MemberRow[] | null) ?? [])
    const { data: invs } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, email, role, status, invited_at')
      .eq('organization_id', orgId)
      .order('invited_at', { ascending: false })
    setInvites((invs as InvitationRow[] | null) ?? [])
  }

  async function switchOrg(id: string) {
    const supabase = createClient()
    setActiveOrgId(id)
    const orgRow = orgs.find((o) => o.id === id) ?? null
    setOrg(orgRow)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: mems } = await supabase
        .from('organization_members')
        .select('organization_id, role, status')
        .eq('user_id', session.user.id)
      setRole((mems?.find((m) => m.organization_id === id)?.role as OrgRole) ?? null)
      await loadMembersAndInvites(supabase, id)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    const addr = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setMsg({ kind: 'err', text: 'Please enter a valid email address.' })
      return
    }
    setSending(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('organization_invitations').insert({
      organization_id: org?.id,
      email: addr.toLowerCase(),
      role: inviteRole,
      status: 'pending',
    })
    setSending(false)
    if (error) {
      if (error.code === '45002') {
        setMsg({ kind: 'err', text: 'Your plan has reached its member limit. Upgrade to invite more members.' })
      } else {
        setMsg({ kind: 'err', text: error.message })
      }
      return
    }
    setEmail('')
    setMsg({ kind: 'ok', text: `Invitation sent to ${addr}. It will appear once the invite is accepted.` })
    await loadMembersAndInvites(supabase, org!.id)
  }

  const managedRoleOptions = useMemo(
    () => MANAGEABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
    [],
  )

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]" aria-label="Back to dashboard">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Team</h1>
              <p className="text-sm text-[#849792]">{org?.name ?? 'Your workspace'}</p>
            </div>
          </div>
          {org && (
            <select
              value={activeOrgId ?? ''}
              onChange={(e) => switchOrg(e.target.value)}
              className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm text-[#c1cbc7] outline-none focus:border-[rgba(216,180,90,0.55)]"
              aria-label="Switch workspace"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0a2926]">{o.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading team…</div>
        ) : !org ? (
          <div className="card mt-10 rounded-3xl p-8 text-center">
            <Users size={30} className="mx-auto text-[#6e817c]" />
            <p className="mt-4 font-semibold text-[#c1cbc7]">No team workspace yet</p>
            <p className="mt-2 text-sm text-[#849792]">Create an agency workspace to invite your team and manage roles together.</p>
            <Link href="/dashboard/create-org" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">
              Create an Agency <Send size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div className="card mt-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold">Invite a member</h2>
              <p className="mt-1.5 text-sm text-[#849792]">
                Invited members are limited by your {org.type === 'personal' ? 'Personal (Solo)' : 'plan'} member limit. The actual limit is enforced server-side.
              </p>
              <form onSubmit={handleInvite} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6e817c]" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="colleague@example.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[.04] py-3 pl-11 pr-4 text-[#f7f4ec] outline-none transition focus:border-[rgba(216,180,90,0.55)]"
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="rounded-xl border border-white/10 bg-[#0a2926] px-4 py-3 text-sm text-[#c1cbc7] outline-none focus:border-[rgba(216,180,90,0.55)]"
                >
                  {managedRoleOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60"
                >
                  <UserPlus size={16} /> {sending ? 'Sending…' : 'Invite'}
                </button>
              </form>
              {msg && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'border border-green-400/30 bg-green-400/10 text-green-200' : 'border border-red-400/30 bg-red-400/10 text-red-200'}`}>
                  {msg.text}
                </p>
              )}
            </div>

            {/* Members */}
            <div className="card mt-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold">Members</h2>
              {members.length === 0 ? (
                <p className="mt-4 text-sm text-[#849792]">No members yet — invite your first teammate above.</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(216,180,90,0.15)] text-xs font-bold text-[#d8b45a]">
                          {(m.profile?.full_name || m.profile?.username || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#d9e0dc]">
                            {m.profile?.full_name || m.profile?.username || 'Invited'}
                            {m.role === 'OWNER' && <Crown size={13} className="text-[#d8b45a]" />}
                          </div>
                          <div className="mt-0.5 text-xs text-[#6e817c]">
                            {m.profile?.username || '—'} · {m.status}
                          </div>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        m.role === 'OWNER'
                          ? 'border-[rgba(216,180,90,0.50)] bg-[rgba(216,180,90,0.10)] text-[#e4c979]'
                          : isManager(m.role)
                            ? 'border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.06)] text-[#d8b45a]'
                            : 'border-white/10 bg-white/[.03] text-[#9aaca6]'
                      }`}>
                        {ROLE_LABELS[m.role]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending invitations */}
            <div className="card mt-8 mb-8 rounded-3xl p-7">
              <h2 className="font-display text-lg font-bold">Pending invitations</h2>
              {invites.filter((i) => i.status === 'pending').length === 0 ? (
                <p className="mt-4 text-sm text-[#849792]">No pending invitations.</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {invites.filter((i) => i.status === 'pending').map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.03] text-[#9aaca6]">
                          <Mail size={15} />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-[#d9e0dc]">{i.email}</div>
                          <div className="mt-0.5 text-xs text-[#6e817c]">Invited {formatDate(i.invited_at)}</div>
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.06)] px-2.5 py-1 text-xs font-semibold text-[#d8b45a]">
                        <ShieldCheck size={12} /> {ROLE_LABELS[i.role]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}
