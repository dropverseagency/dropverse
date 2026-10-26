'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Item = {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setAvailable(data.available !== false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ markAll: true }),
    })
    void load()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Workspace</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-[#8fa29c]">Updates about your projects, payouts, samples, and leads.</p>
        </div>
        <button
          type="button"
          onClick={() => void markAll()}
          className="rounded-full border border-[#2c403a] px-3 py-2 text-xs font-semibold text-[#d9e0dc]"
        >
          Mark all read
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#8fa29c]">Loading…</p>
      ) : !available ? (
        <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-6 text-sm text-[#aebcb7]">
          Notifications storage is not active yet. After the database migration is applied, updates will show here.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-6 text-sm text-[#aebcb7]">No notifications yet.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border border-[#1e3d36] px-4 py-3 ${item.read_at ? 'bg-[#0b2420]' : 'bg-[#102923]'}`}
            >
              {item.href ? (
                <Link href={item.href} className="block">
                  <p className="font-semibold text-white">{item.title}</p>
                  {item.body ? <p className="mt-1 text-sm text-[#aebcb7]">{item.body}</p> : null}
                </Link>
              ) : (
                <>
                  <p className="font-semibold text-white">{item.title}</p>
                  {item.body ? <p className="mt-1 text-sm text-[#aebcb7]">{item.body}</p> : null}
                </>
              )}
              <p className="mt-2 text-[11px] text-[#6f857e]">{new Date(item.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
