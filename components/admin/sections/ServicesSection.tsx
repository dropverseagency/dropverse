'use client'
import { useEffect, useState } from 'react'
import { Card, LoadingOrError, emptyNote, adminMutate, useAdminData } from '@/components/admin/shared'

type ServiceRow = {
  id: string
  title: string
  description: string | null
  active: boolean
  slug: string
  base_cost_one_time: number | null
}

export default function ServicesSection() {
  const { data, loading, error } = useAdminData('services')
  const samples = useAdminData('samples')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [sampleTitle, setSampleTitle] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function createService() {
    setBusy(true)
    const res = await adminMutate('create_service', {
      title,
      description,
      baseCostOneTime: Number(price) || 0,
      active: true,
    })
    setBusy(false)
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  async function toggle(service: ServiceRow) {
    const res = await adminMutate('update_service', { serviceId: service.id, active: !service.active })
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  async function upload(file: File) {
    const body = new FormData()
    body.set('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body })
    const json = await res.json()
    if (!res.ok || json.error) alert(String(json.error || 'Upload failed'))
    else setMediaUrl(String(json.url))
  }

  async function createSample() {
    setBusy(true)
    const res = await adminMutate('create_sample', { title: sampleTitle, mediaUrl, description: '' })
    setBusy(false)
    if (res.error) alert(String(res.error))
    else window.location.reload()
  }

  const inputCls =
    'rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50'

  return (
    <div className="space-y-6">
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      <Card title="Publish a service">
        <p className="mb-4 text-sm text-muted-foreground">
          Active services replace the static landing list. If none are active, the landing keeps the built-in eight.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Service title" className={inputCls} />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            placeholder="One-time cost"
            className={inputCls}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className={`${inputCls} sm:col-span-2`}
          />
        </div>
        <button
          disabled={busy || !title}
          onClick={createService}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Publish service
        </button>
      </Card>
      <Card title="Catalog">
        {!data?.rows?.length ? (
          emptyNote('No services yet. Publish one above and it will show on the landing page.')
        ) : (
          <div className="space-y-2">
            {data.rows.map((s: ServiceRow) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                <div>
                  <div className="font-semibold text-foreground">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.description || 'No description'} · ${Number(s.base_cost_one_time ?? 0)}
                  </div>
                </div>
                <button
                  onClick={() => toggle(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  {s.active ? 'Published' : 'Hidden'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Work samples">
        <p className="mb-4 text-sm text-muted-foreground">
          Upload an image or video, or paste a public URL. Featured samples replace the landing format cards.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={sampleTitle}
            onChange={(e) => setSampleTitle(e.target.value)}
            placeholder="Sample title"
            className={inputCls}
          />
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Media URL" className={inputCls} />
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="text-sm text-muted-foreground sm:col-span-2"
          />
        </div>
        <button
          disabled={busy || !sampleTitle || !mediaUrl}
          onClick={createSample}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Add sample
        </button>
        <SampleList rows={samples.data?.rows} error={samples.data?.error} />
      </Card>
    </div>
  )
}

function SampleList({ rows, error }: { rows?: { id: string; title: string; media_url?: string }[]; error?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (error) return <p className="mt-4 text-sm text-danger">{error}</p>
  if (!rows?.length) return <p className="mt-4 text-sm text-muted-foreground">No samples yet.</p>
  return (
    <div className="mt-4 space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="text-sm text-muted-foreground">
          {row.title}
        </div>
      ))}
    </div>
  )
}
