'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SKIP = [/^\/admin(?:\/|$)/, /^\/dashboard(?:\/|$)/, /^\/login(?:\/|$)/, /^\/signup(?:\/|$)/, /^\/register(?:\/|$)/, /^\/auth(?:\/|$)/, /^\/api(?:\/|$)/, /^\/pay(?:\/|$)/, /^\/invoice(?:\/|$)/]

export default function VisitBeacon() {
  const path = usePathname()
  useEffect(() => {
    if (!path || SKIP.some((rule) => rule.test(path))) return
    const key = `dv-visit:${path}`
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        fetch('/api/public/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        }).catch(() => undefined)
      }
    } catch {
      /* private mode still gets a live heartbeat */
    }
    const beat = () => {
      fetch('/api/public/presence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }).catch(() => undefined)
    }
    beat()
    const timer = window.setInterval(beat, 20000)
    return () => window.clearInterval(timer)
  }, [path])
  return null
}
