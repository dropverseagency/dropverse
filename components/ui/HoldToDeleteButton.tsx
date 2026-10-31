'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

type Props = {
  onConfirm: () => void | Promise<void>
  label?: string
  holdMs?: number
  disabled?: boolean
  className?: string
  /** Compact icon-only style */
  compact?: boolean
}

/**
 * Press-and-hold destructive action.
 * Progress ring fills while held; releases cancel.
 * Inspired by skeuomorphic "Hold to delete" patterns.
 */
export function HoldToDeleteButton({
  onConfirm,
  label = 'Hold to delete',
  holdMs = 900,
  disabled = false,
  className = '',
  compact = false,
}: Props) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const raf = useRef<number | null>(null)
  const start = useRef<number>(0)
  const confirmed = useRef(false)

  const clear = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
    setHolding(false)
    setProgress(0)
    confirmed.current = false
  }, [])

  const tick = useCallback(
    (now: number) => {
      const elapsed = now - start.current
      const p = Math.min(1, elapsed / holdMs)
      setProgress(p)
      if (p >= 1 && !confirmed.current) {
        confirmed.current = true
        setDone(true)
        void Promise.resolve(onConfirm()).finally(() => {
          setTimeout(() => {
            setDone(false)
            clear()
          }, 280)
        })
        return
      }
      raf.current = requestAnimationFrame(tick)
    },
    [holdMs, onConfirm, clear],
  )

  const begin = useCallback(() => {
    if (disabled || done) return
    start.current = performance.now()
    setHolding(true)
    confirmed.current = false
    raf.current = requestAnimationFrame(tick)
  }, [disabled, done, tick])

  useEffect(() => () => clear(), [clear])

  // Cancel if pointer leaves / is cancelled
  const end = useCallback(() => {
    if (!confirmed.current) clear()
  }, [clear])

  const pct = Math.round(progress * 100)

  return (
    <button
      type="button"
      disabled={disabled || done}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId)
        begin()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      className={
        compact
          ? `relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-red-400/35 bg-red-500/10 text-red-200 transition select-none touch-none ${disabled ? 'opacity-40' : 'hover:border-red-400/55 hover:bg-red-500/15'} ${className}`
          : `relative inline-flex min-w-[9.5rem] items-center justify-center gap-2 overflow-hidden rounded-full border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 transition select-none touch-none ${disabled ? 'opacity-40' : 'hover:border-red-400/55 hover:bg-red-500/15'} ${className}`
      }
      style={{
        // soft progress fill from left
        backgroundImage: holding
          ? `linear-gradient(90deg, rgba(239,68,68,0.35) ${pct}%, transparent ${pct}%)`
          : undefined,
      }}
    >
      {/* Progress ring (compact) or bar feel */}
      {compact && holding && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="2.5" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="rgb(252,165,165)"
            strokeWidth="2.5"
            strokeDasharray={`${progress * 97.4} 97.4`}
            strokeLinecap="round"
          />
        </svg>
      )}
      <Trash2 size={compact ? 15 : 14} className={holding ? 'animate-pulse' : ''} />
      {!compact && <span>{done ? 'Deleted' : holding ? `${pct}%` : label}</span>}
    </button>
  )
}
