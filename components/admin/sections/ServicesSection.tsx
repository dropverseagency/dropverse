'use client'
import { useState } from 'react'
import { Card, LoadingOrError, emptyNote, fmtUsd, adminMutate, useAdminData } from '@/components/admin/shared'

export default function ServicesSection() {
  const { data, loading, error } = useAdminData('services')
  const [editing, setEditing] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  async function save(serviceId: string) {
    const price = values.price != null ? Number(values.price) : undefined
    const dvCostRate = values.dvCostRate != null ? Number(values.dvCostRate) : undefined
    if (!Number.isFinite(price as number) || (price as number) < 0) { alert('Invalid price'); return }
    if (dvCostRate !== undefined && (dvCostRate < 0 || dvCostRate > 1)) { alert('DV cost share must be 0–1'); return }
    const res = await adminMutate('update_service', { serviceId, price, dvCostRate })
    if (res.error) alert(String(res.error))
    else { setEditing(null); window.location.reload() }
  }

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <Card>
          {!data.rows?.length ? emptyNote('No services in the catalog yet.') : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                    <th className="py-2 pr-3 font-semibold">Service</th>
                    <th className="py-2 pr-3 font-semibold">Description</th>
                    <th className="py-2 pr-3 font-semibold">Price (USD)</th>
                    <th className="py-2 pr-3 font-semibold">DV cost share</th>
                    <th className="py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((s: any) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-[#f0f4f2]">{s.name}</div>
                        <div className="text-xs text-[#7f918c]">{s.category ?? '—'} · {s.tier ?? 'standard'}</div>
                      </td>
                      <td className="py-3 pr-3 text-xs text-[#8fa29c]">{s.description || '—'}</td>
                      <td className="py-3 pr-3">
                        {editing === s.id ? (
                          <input
                            type="number"
                            min={0}
                            step={10}
                            defaultValue={values.price ?? Number(s.price_usd ?? 0)}
                            onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
                            className="w-24 rounded-lg border border-white/10 bg-[#071210] px-2 py-1.5 text-sm text-[#d9e0dc] outline-none"
                          />
                        ) : (
                          fmtUsd(s.price_usd)
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {editing === s.id ? (
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            defaultValue={values.dvCostRate ?? Number(s.dv_cost_rate ?? 0.4)}
                            onChange={(e) => setValues((v) => ({ ...v, dvCostRate: e.target.value }))}
                            className="w-20 rounded-lg border border-white/10 bg-[#071210] px-2 py-1.5 text-sm text-[#d9e0dc] outline-none"
                          />
                        ) : (
                          `${Math.round(Number(s.dv_cost_rate ?? 0) * 100)}%`
                        )}
                      </td>
                      <td className="py-3">
                        {editing === s.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => save(s.id)} className="rounded-lg bg-[#d8b45a] px-3 py-1.5 text-xs font-bold text-[#10221f] hover:bg-[#f0d98b]">Save</button>
                            <button onClick={() => setEditing(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9aaca6]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(s.id); setValues({}) }} className="rounded-lg border border-[rgba(216,180,90,0.35)] px-3 py-1.5 text-xs font-semibold text-[#e4c979] hover:bg-[rgba(216,180,90,0.10)]">Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
