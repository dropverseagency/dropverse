'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

type Item = {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=15', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setUnread(Number(data.unreadCount || 0))
      setAvailable(data.available !== false)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 60000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markAll() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markAll: true }),
      })
      setUnread(0)
      setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at || new Date().toISOString() })))
    } catch {
      /* ignore */
    }
  }

  async function markOne(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [id] }),
      })
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: i.read_at || new Date().toISOString() } : i)))
      setUnread((n) => Math.max(0, n - 1))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2c403a] text-[#d9e0dc] hover:bg-[#102923]"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d8b45a] px-1 text-[10px] font-bold text-[#10221f]">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#1e3d36] bg-[#0b2420] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1e3d36] px-3 py-2.5">
            <p className="text-sm font-bold text-white">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 ? (
                <button type="button" onClick={() => void markAll()} className="text-[11px] font-semibold text-[#7ee0cf]">
                  Mark all read
                </button>
              ) : null}
              <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-[#f0d98b]">
                View all
              </Link>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!available ? (
              <p className="px-3 py-6 text-center text-sm text-[#8fa29c]">Notifications will appear after setup is complete.</p>
            ) : loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#8fa29c]">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#8fa29c]">No notifications yet.</p>
            ) : (
              items.map((item) => {
                const unreadItem = !item.read_at
                const inner = (
                  <div className={`border-b border-[#1e3d36] px-3 py-2.5 ${unreadItem ? 'bg-[#102923]/40' : ''}`}>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    {item.body ? <p className="mt-0.5 text-xs text-[#aebcb7]">{item.body}</p> : null}
                    <p className="mt-1 text-[10px] text-[#6f857e]">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                )
                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        if (unreadItem) void markOne(item.id)
                        setOpen(false)
                      }}
                      className="block hover:bg-[#102923]"
                    >
                      {inner}
                    </Link>
                  )
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full text-left hover:bg-[#102923]"
                    onClick={() => {
                      if (unreadItem) void markOne(item.id)
                    }}
                  >
                    {inner}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
