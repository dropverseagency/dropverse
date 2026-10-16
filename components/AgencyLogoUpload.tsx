'use client'

import { useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'

export default function AgencyLogoUpload({
  orgId,
  logoUrl,
  onLogoUrl,
}: {
  orgId: string
  logoUrl: string
  onLogoUrl: (url: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('organizationId', orgId)
      body.append('file', file)
      const res = await fetch('/api/agency/upload', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Upload failed')
        return
      }
      onLogoUrl(String(json.url || ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#6e817c]">Logo</p>
      <p className="mt-1 text-xs text-[#849792]">Upload an image or paste a URL.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-xl border border-white/10 object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-white/15 text-[#6e817c]">
            <ImagePlus size={18} />
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] px-4 py-2 text-sm font-semibold text-[#e4c979]">
          <Upload size={14} />
          {busy ? 'Uploading…' : 'Upload image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <input
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
        value={logoUrl}
        onChange={(e) => onLogoUrl(e.target.value)}
        placeholder="Or logo URL (https://…)"
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
