'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'
import { cn } from './ui'

export type NavItem = {
  href: string
  label: string
  icon?: ReactNode
}

export default function DashboardShell({
  nav,
  title,
  actions,
  children,
}: {
  nav: NavItem[]
  title?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const navList = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Dashboard">
      {nav.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <Brand compact />
        <ThemeToggle />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/70"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Brand compact />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            {navList}
          </aside>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="border-b border-border px-4 py-4">
            <Brand compact />
          </div>
          <div className="flex-1 overflow-y-auto">{navList}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 hidden items-center justify-between gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur lg:flex">
            <div>
              {title ? <h1 className="font-display text-lg font-bold text-foreground">{title}</h1> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
