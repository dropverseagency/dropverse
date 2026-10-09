'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitBeacon() {
  const path = usePathname()
  useEffect(() => {
    if (!path) return
    const key = `dv-visit:${path}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    fetch('/api/public/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => undefined)
  }, [path])
  return null
}
