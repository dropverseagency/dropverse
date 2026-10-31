'use client'
import { useState } from 'react'
import { Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData, adminMutate } from '@/components/admin/shared'

type FreelancerRow = {
  id: string
  full_name?: string | null
  username?: string | null
  service_name?: string | null
  rating?: number | null
  created_at?: string | null
  verification?: {
    verified_level?: string | null
    identity_status?: string | null
    specialty_status?: string | null
  } | null
  availability?: {
    available?: boolean
    capacity?: number | null
    typical_turnaround_days?: number | null
  } | null
}

type ModalMode = 'approve' | 'reject' | 'request_info'

export default function FreelancersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('freelancers', [String(page), String(limit), q])
  const [active, setActive] = useState<FreelancerRow | null>(null)
  const [mode, setMode] = useState<ModalMode | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function openModal(row: FreelancerRow, next: ModalMode) {
    setActive(row)
    setMode(next)
    setNote('')
    setMsg(null)
  }

  function closeModal() {
    if (saving) return
    setActive(null)
    setMode(null)
    setNote('')
    setMsg(null)
  }

  async function submit() {
    if (!active || !mode) return
    const cleaned = note.trim()
    if (mode !== 'approve' && cleaned.length < 3) {
      setMsg('Write a short note (at least 3 characters).')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      let payload: Record<string, unknown>
      if (mode === 'approve') {
        payload = {
          userId: active.id,
          identityStatus: 'verified',
          specialtyStatus: 'passed',
          verifiedLevel: 'specialist',
          identityProviderReference: `manual-${stamp}`,
          note: cleaned || `Manual admin approval on ${stamp}`,
        }
      } else if (mode === 'reject') {
        payload = {
          userId: active.id,
          identityStatus: 'rejected',
          specialtyStatus: 'failed',
          verifiedLevel: 'none',
          identityProviderReference: '',
          note: cleaned,
        }
      } else {
        payload = {
          userId: active.id,
          identityStatus: 'pending',
          specialtyStatus: 'pending',
          verifiedLevel: 'none',
          identityProviderReference: '',
          note: cleaned,
        }
      }
      const res = await adminMutate('set_freelancer_verification', payload)
      if (res.error) {
        setMsg(String(res.error))
        setSaving(false)
        return
      }
      window.location.reload()
    } catch {
      setMsg('Could not save. Try again.')
      setSaving(false)
    }
  }

  const title =
    mode === 'approve'
      ? 'Approve verification'
      : mode === 'reject'
        ? 'Reject verification'
        : 'Request more info'

  const helper =
    mode === 'approve'
      ? 'Confirms identity + specialty. Optional note is fine.'
      : mode === 'reject'
        ? 'Tell the freelancer why they were rejected.'
        : 'Ask the freelancer for missing documents or portfolio details.'

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <TableControls
            q={q}
            onQ={(v) => {
              setQ(v)
              setPage(1)
            }}
            page={page}
            count={data.count ?? 0}
            limit={limit}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            placeholder="Search freelancer name or service..."
          />
          <Card>
            {!data.rows?.length ? (
              emptyNote('No freelancer profiles yet. They appear here after a freelancer completes profile onboarding.')
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Freelancer</th>
                      <th className="py-2 pr-3 font-semibold">Service</th>
                      <th className="py-2 pr-3 font-semibold">Rating</th>
                      <th className="py-2 font-semibold">Registered</th>
                      <th className="py-2 pr-3 font-semibold">Verification</th>
                      <th className="py-2 font-semibold">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rows as FreelancerRow[]).map((f) => (
                      <tr key={f.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{f.full_name || f.username || '—'}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(f.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.service_name ?? '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.rating ?? '—'}</td>
                        <td className="py-3 text-xs text-[#7f918c]">{fmtDate(f.created_at)}</td>
                        <td className="py-3 pr-3 text-xs">
                          <div className="mb-2 text-[#e4c979]">Level: {f.verification?.verified_level || 'none'}</div>
                          <div className="mb-2 text-[#9aaca6]">
                            ID: {f.verification?.identity_status || 'unsubmitted'} · Skill:{' '}
                            {f.verification?.specialty_status || 'unreviewed'}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal(f, 'approve')}
                              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal(f, 'request_info')}
                              className="rounded-lg border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-2 py-1 text-[#e4c979]"
                            >
                              Request info
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal(f, 'reject')}
                              className="rounded-lg border border-red-400/30 bg-red-400/10 px-2 py-1 text-red-200"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                        <td className="py-3 text-xs">
                          {f.availability ? (
                            <>
                              <span className={f.availability.available ? 'text-emerald-300' : 'text-[#aab9b4]'}>
                                {f.availability.available ? 'Available' : 'Unavailable'}
                              </span>
                              <div className="mt-1 text-[#7f918c]">
                                Capacity: {f.availability.capacity} · {f.availability.typical_turnaround_days ?? '—'}d
                              </div>
                            </>
                          ) : (
                            <span className="text-[#f0b66a]">Not configured</span>
                          )}
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

      {active && mode ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a2926] p-5 shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d8b45a]">Freelancer review</p>
            <h3 className="mt-1 font-display text-xl font-bold text-white">{title}</h3>
            <p className="mt-1 text-sm text-[#9aaca6]">
              {active.full_name || active.username || truncateId(active.id)} · {helper}
            </p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#7f918c]">
              Note {mode === 'approve' ? '(optional)' : '(required)'}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={
                  mode === 'approve'
                    ? 'Portfolio looks solid / WhatsApp check done…'
                    : mode === 'reject'
                      ? 'Missing clear portfolio / identity mismatch…'
                      : 'Please send ID photo and 2 portfolio links…'
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-3 py-2.5 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
              />
            </label>
            {msg ? <p className="mt-3 text-sm text-[#e89a8d]">{msg}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#d9e0dc] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${
                  mode === 'reject'
                    ? 'bg-red-400/90 text-[#1a0b0b]'
                    : mode === 'request_info'
                      ? 'bg-[#d8b45a] text-[#10221f]'
                      : 'bg-emerald-400 text-[#062015]'
                }`}
              >
                {saving ? 'Saving…' : mode === 'approve' ? 'Approve' : mode === 'reject' ? 'Reject' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
