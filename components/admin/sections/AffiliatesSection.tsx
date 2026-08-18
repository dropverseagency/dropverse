'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, TableControls, truncateId, fmtDate, emptyNote, fmtUsd, adminMutate, useAdminData } from '@/components/admin/shared'
import { ShieldCheck, ShieldX } from 'lucide-react'

export default function AffiliatesSection() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const limit = 20
  const { data, loading, error } = useAdminData('affiliates', [String(page), String(limit), q])

  async function setReferralActive(profileId: string, active: boolean) {
    if (!confirm(`${active ? 'Enable' : 'Disable'} this user's affiliate participation?`)) return
    const res = await adminMutate('set_referral_active', { profileId, active })
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
            placeholder="Search by code, name, username or email..."
          />
          <Card>
            {!data.rows?.length ? emptyNote('No affiliate data found.') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                      <th className="py-2 pr-3 font-semibold">Affiliate</th>
                      <th className="py-2 pr-3 font-semibold">Code</th>
                      <th className="py-2 pr-3 font-semibold">Referrals</th>
                      <th className="py-2 pr-3 font-semibold">Commissions</th>
                      <th className="py-2 pr-3 font-semibold">Earned</th>
                      <th className="py-2 pr-3 font-semibold">Active</th>
                      <th className="py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((a: any) => (
                      <tr key={a.profile_id ?? a.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-[#f0f4f2]">{a.full_name || a.username || '—'}</div>
                          <div className="text-xs text-[#7f918c]">{a.email ? a.email.split('@')[0] : truncateId(a.profile_id ?? a.id)}</div>
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-[#f0d98b]">{a.referral_code ?? '—'}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{a.referral_count ?? 0}</td>
                        <td className="py-3 pr-3 text-[#c8d4d0]">{a.commission_count ?? 0}</td>
                        <td className="py-3 pr-3 font-semibold text-[#6fbf73]">{fmtUsd(a.commission_amount ?? 0)}</td>
                        <td className="py-3 pr-3">
                          <Badge status={a.active ? 'approved' : 'cancelled'} label={a.active ? 'active' : 'disabled'} />
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => setReferralActive(a.profile_id ?? a.id, !a.active)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${a.active ? 'border border-red-400/30 text-red-300 hover:bg-red-400/10' : 'border border-[rgba(216,180,90,0.35)] text-[#e4c979] hover:bg-[rgba(216,180,90,0.12)]'}`}
                          >
                            {a.active ? <><ShieldX size={13} /> Disable</> : <><ShieldCheck size={13} /> Enable</>}
                          </button>
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
