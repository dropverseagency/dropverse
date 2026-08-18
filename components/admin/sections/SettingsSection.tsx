'use client'
import { useState } from 'react'
import { Card, LoadingOrError, emptyNote, adminMutate, useAdminData } from '@/components/admin/shared'

export default function SettingsSection() {
  const { data, loading, error } = useAdminData('settings')
  const [tiers, setTiers] = useState<Record<string, string>>({})
  const [holding, setHolding] = useState('')

  async function saveTiers() {
    const payload: Record<string, { fromRate: number; capPerProject: number | null; enabled: boolean }> = {}
    const entries = Object.entries(tiers)
    if (!entries.length) { alert('Change at least one rate first.'); return }
    for (const [tier, rateStr] of entries) {
      const fromRate = Number(rateStr)
      if (isNaN(fromRate) || fromRate < 0 || fromRate > 1) { alert(`Invalid rate for ${tier}`); return }
      payload[tier] = { fromRate, capPerProject: data?.program?.capPerProject ?? null, enabled: data?.program?.enabled ?? true }
    }
    const res = await adminMutate('update_tiers', { tiers: payload })
    if (res.error) alert(String(res.error))
    else { setTiers({}); window.location.reload() }
  }

  async function saveHolding() {
    const days = Number(holding)
    if (!Number.isInteger(days) || days < 0 || days > 90) { alert('Days must be 0–90.'); return }
    const res = await adminMutate('update_program', { holdingDays: days })
    if (res.error) alert(String(res.error))
    else { setHolding(''); window.location.reload() }
  }

  const program = data?.program
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <>
          <Card title="Commission rates by plan tier">
            {!data.tiers?.length ? emptyNote('No tiers.') : (
              <div className="space-y-3">
                {data.tiers.map((t: any) => (
                  <div key={t.plan} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#f0f4f2]">{t.plan}</div>
                      <div className="text-xs text-[#7f918c]">Current: {Math.round(t.from_rate * 100)}% of DropVerse revenue{t.cap_per_project != null ? ` · cap ${t.cap_per_project}/project` : ' · no cap'}</div>
                    </div>
                    <input
                      type="number"
                      min={0} max={1} step={0.01}
                      placeholder={String(t.from_rate)}
                      value={tiers[t.plan] ?? ''}
                      onChange={(e) => setTiers((v) => ({ ...v, [t.plan]: e.target.value }))}
                      className="w-20 rounded-lg border border-white/10 bg-[#071210] px-2 py-1.5 text-sm text-[#d9e0dc] outline-none"
                    />
                  </div>
                ))}
                <button onClick={saveTiers} className="rounded-lg bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">Save rates</button>
                <p className="text-xs text-[#7f918c]">Rates are a share of DropVerse revenue (fulfillment cost), not the client price. Changes apply to commissions created after saving.</p>
              </div>
            )}
          </Card>

          <Card title="Program rules">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-[#f0f4f2]">Payout holding period</div>
                <div className="text-xs text-[#7f918c]">Days an approved commission waits before becoming withdrawable. Current: <span className="text-[#e4c979]">{program?.holdingDays ?? '—'} days</span></div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min={0} max={90}
                    value={holding}
                    onChange={(e) => setHolding(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-20 rounded-lg border border-white/10 bg-[#071210] px-2 py-1.5 text-sm text-[#d9e0dc] outline-none"
                  />
                  <button onClick={saveHolding} className="rounded-lg bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">Save</button>
                </div>
              </div>
              <div className="rounded-lg border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.06)] px-4 py-3 text-xs leading-5 text-[#b9a66c]">
                Program is {program?.enabled ? 'enabled' : 'disabled'}. 30-day attribution window, no self-referrals, eligibility 12 months from attribution, commission base = DropVerse revenue only.
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
