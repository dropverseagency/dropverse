'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'dropverse-theme'

function applyTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  document.documentElement.style.colorScheme = next
}

export default function ThemeToggle() {
  // Default dark = original DropVerse look. Hydration-safe: script in layout
  // applies the same default before paint.
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const initial: Theme =
      saved === 'light' || saved === 'dark' ? saved : 'dark'
    setTheme(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        !mounted
          ? 'Toggle color theme'
          : theme === 'dark'
            ? 'Switch to light mode'
            : 'Switch to dark mode'
      }
      aria-pressed={mounted && theme === 'dark'}
      title={
        mounted
          ? theme === 'dark'
            ? 'Switch to light mode'
            : 'Switch to dark mode'
          : 'Toggle color theme'
      }
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors duration-200 hover:bg-muted"
    >
      {mounted && theme === 'dark' ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  )
}
