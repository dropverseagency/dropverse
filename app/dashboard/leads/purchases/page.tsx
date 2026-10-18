'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Item = {
  id: string
  status: string
  price_usd: number
  paid_at: string | null
  lead_packs: { id: string; title: string; niche: string } | null
}

export default function MyLeadPurchasesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/leads/purchases/mine')
      if (res.status === 401) {
        window.location.href = '/login?redirect=/dashboard/leads/purchases'
        return
      }
      const json = await res.json().catch(() => ({}))
      setItems(json.items || [])
    })()
  }, [])

  async function download(purchaseId: string) {
    setMsg(null)
    const res = await fetch(`/api/leads/purchases/${purchaseId}/download`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error || 'Download failed')
      return
    }
    window.open(json.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-[#e7edea]">
      <Link href="/leads" className="text-xs text-[#8fa29c] hover:text-[#e4c979]">
        ← Marketplace
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-white">My purchases</h1>
      {msg ? <p className="mt-2 text-xs text-red-300">{msg}</p> : null}
      <ul className="mt-6 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-3">
            <div>
              <p className="font-medium text-white">{it.lead_packs?.title || 'Pack'}</p>
              <p className="text-xs text-[#8fa29c]">
                {it.status} · ${Number(it.price_usd).toFixed(2)}
              </p>
            </div>
            {it.status === 'paid' ? (
              <button
                type="button"
                onClick={() => download(it.id)}
                className="rounded-full bg-[#d8b45a] px-4 py-2 text-xs font-bold text-[#10221f]"
              >
                Download
              </button>
            ) : (
              <span className="text-xs text-[#6f827c]">{it.status}</span>
            )}
          </li>
        ))}
        {items.length === 0 ? <p className="text-sm text-[#8fa29c]">No purchases yet.</p> : null}
      </ul>
    </div>
  )
}
