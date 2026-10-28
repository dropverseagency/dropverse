'use client'
import { useState } from 'react'
import { Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, useAdminData, adminMutate } from '@/components/admin/shared'

export default function FreelancersSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('freelancers', [String(page), String(limit), q])
  async function verify(userId:string){
    const identityProviderReference = prompt('After reviewing identity evidence, enter the internal evidence/reference ID:')
    if (!identityProviderReference?.trim()) return
    const note = prompt('Specialty review note (portfolio or skills test reviewed):')
    if (!note?.trim() || note.trim().length < 5) return
    const res = await adminMutate('set_freelancer_verification', {
      userId,
      identityStatus: 'verified',
      specialtyStatus: 'passed',
      verifiedLevel: 'specialist',
      identityProviderReference: identityProviderReference.trim(),
      note: note.trim(),
    })
    if (res.error) alert(String(res.error))
    else window.location.reload()
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
            placeholder="Search freelancer name or service..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No freelancer profiles yet. They appear here after a freelancer completes profile onboarding.') : (
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
                    {data.rows.map((f: any) => (
                      <tr key={f.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{f.full_name || f.username || '—'}</div>
                          <div className="text-xs text-[#7f918c]">{truncateId(f.id)}</div>
                        </td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.service_name ?? '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{f.rating ?? '—'}</td>
                        <td className="py-3 text-xs text-[#7f918c]">{fmtDate(f.created_at)}</td>
                        <td className="py-3 pr-3 text-xs"><span className="me-2 text-[#e4c979]">{f.verification?.verified_level||'none'}</span><button onClick={()=>verify(f.id)} className="rounded-lg border border-white/15 px-2 py-1">Verify identity + specialty</button></td>
                        <td className="py-3 text-xs">
                          {f.availability ? <><span className={f.availability.available ? 'text-emerald-300' : 'text-[#aab9b4]'}>{f.availability.available ? 'Available' : 'Unavailable'}</span><div className="mt-1 text-[#7f918c]">Capacity: {f.availability.capacity} · {f.availability.typical_turnaround_days ?? '—'}d</div></> : <span className="text-[#f0b66a]">Not configured</span>}
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
