'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import { createClient } from '../lib/supabase'

type UserRole = 'drop_servicer' | 'freelancer' | 'lead_generator'

type HeroCta = { href: string; label: string; ghost?: boolean }

function buildHeroCtas(signedIn: boolean, roles: UserRole[]): HeroCta[] {
  if (!signedIn) {
    return [
      { href: '/login?mode=signup', label: 'For Drop Servicers' },
      { href: '/login?mode=signup', label: 'For Freelancers', ghost: true },
      { href: '/login?mode=signup', label: 'Create your workspace' },
    ]
  }

  const ctas: HeroCta[] = []
  const has = (r: UserRole) => roles.includes(r)

  if (has('drop_servicer')) {
    ctas.push({ href: '/dashboard/create-project', label: 'Create project' })
  }
  if (has('freelancer')) {
    ctas.push({ href: '/dashboard/samples', label: 'Upload a sample', ghost: ctas.length > 0 })
  }
  if (has('lead_generator')) {
    ctas.push({ href: '/leads', label: 'Leads marketplace', ghost: ctas.length > 0 })
  }

  ctas.push({
    href: '/dashboard',
    label: ctas.length ? 'Open dashboard' : 'Open your workspace',
    ghost: ctas.length > 0,
  })

  return ctas
}

export default function HeroCtas() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [roles, setRoles] = useState<UserRole[]>([])

  useEffect(() => {
    if (!signedIn || !auth.user?.id) {
      setRoles([])
      return
    }
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_type, user_types')
        .eq('id', auth.user!.id)
        .maybeSingle()
      if (cancelled) return
      const allowed: UserRole[] = ['drop_servicer', 'freelancer', 'lead_generator']
      const collected = new Set<UserRole>()
      if (Array.isArray(data?.user_types)) {
        for (const value of data.user_types) {
          if (allowed.includes(value as UserRole)) collected.add(value as UserRole)
        }
      }
      if (data?.user_type && allowed.includes(data.user_type as UserRole)) {
        collected.add(data.user_type as UserRole)
      }
      setRoles([...collected])
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, auth.user?.id])

  const heroCtas = buildHeroCtas(signedIn, roles)

  return (
    <>
      <div className="hero-paths" aria-label={signedIn ? 'Your next actions' : 'Choose how you work'}>
        {heroCtas.slice(0, 2).map((cta) => (
          <Link
            key={cta.href + cta.label}
            href={cta.href}
            className={cta.ghost ? 'editorial-button editorial-button-ghost' : 'editorial-button'}
          >
            {cta.label}
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
      {heroCtas.length > 2 ? (
        <Link
          href={heroCtas[2].href}
          className={heroCtas[2].ghost ? 'editorial-button editorial-button-ghost' : 'editorial-button'}
        >
          {heroCtas[2].label}
          <ArrowUpRight size={18} />
        </Link>
      ) : null}
    </>
  )
}
