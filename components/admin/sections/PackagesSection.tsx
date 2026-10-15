'use client'
import { useState } from 'react'
import { Card, LoadingOrError, adminMutate, useAdminData } from '@/components/admin/shared'

type PackageRow = {
  id: string
  service_id: string
  service_title: string | null
  name: string
  description: string
  retail_price: number
  currency: string
  sort_order: number
  active: boolean
}

type ServiceRow = {
  id: string
  title: string
  active: boolean
}

export default function PackagesSection() {
  const { data, loading, error } = useAdminData('packages')
  const services = useAdminData('services')
  const [serviceId, setServiceId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [retailPrice, setRetailPrice] = useState('99')
  const [busy, setBusy] = useState(false)

  const rows = (data?.rows as PackageRow[] | undefined) ?? []
  const serviceRows = (services.data?.rows as ServiceRow[] | undefined) ?? []

  async function createPackage() {
    setBusy(true)
    const res = await adminMutate('create_package', {
      serviceId,
      name,
      description,
      retailPrice: Number(retailPrice) || 0,
      active: true,
    })
    setBusy(false)
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  async function toggle(pkg: PackageRow) {
    const res = await adminMutate('update_package', { packageId: pkg.id, active: !pkg.active })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  return (
    <div className="space-y-6">
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}

      <Card title="Create retail package">
        <p className="mb-4 text-sm text-[#8fa29c]">
          Packages are DropVerse-managed retail SKUs shown on agency landing pages. Agencies select services only;
          they cannot set package prices.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#071210] px-3 py-2 text-sm outline-none"
          >
            <option value="">Select service</option>
            {serviceRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {!s.active ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Package name (e.g. Starter)"
            className="rounded-xl border border-white/10 bg-[#071210] px-3 py-2 text-sm outline-none"
          />
          <input
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            type="number"
            min="1"
            step="0.01"
            placeholder="Retail price USD"
            className="rounded-xl border border-white/10 bg-[#071210] px-3 py-2 text-sm outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="rounded-xl border border-white/10 bg-[#071210] px-3 py-2 text-sm outline-none sm:col-span-2"
          />
        </div>
        <button
          type="button"
          disabled={busy || !serviceId || !name}
          onClick={createPackage}
          className="mt-4 rounded-full bg-[#d8b45a] px-5 py-2 text-sm font-bold text-[#10221f] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Create package'}
        </button>
      </Card>

      <Card title="Packages">
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-[#849792]">
              No packages yet. Create one after the agency landing migration is applied.
            </p>
          ) : (
            rows.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-[#d9e0dc]">
                    {pkg.name}{' '}
                    <span className="text-xs font-normal text-[#849792]">
                      · {pkg.service_title || pkg.service_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-xs text-[#7f918c]">
                    {pkg.currency} {Number(pkg.retail_price).toLocaleString()} ·{' '}
                    {pkg.active ? 'active' : 'inactive'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(pkg)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#e4c979]"
                >
                  {pkg.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
