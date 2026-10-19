'use client'

/**
 * DropVerse hero backdrop — fast kinetic type loop (no logo).
 * Dark emerald + gold accent on key words only.
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

const GOLD = '#e2b656'
const WHITE = 'rgba(231,237,234,0.92)'
const MUTED = 'rgba(226,232,240,0.05)'

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x))
}
function expOut(t: number, k = 5) {
  return 1 - Math.exp(-k * clamp01(t))
}
function spring(t: number) {
  const x = clamp01(t)
  return 1 - Math.exp(-5.5 * x) * Math.cos(x * Math.PI * 0.4)
}
/** Segment local time 0..1 inside [a,b] of full loop t */
function seg(t: number, a: number, b: number) {
  if (t < a) return 0
  if (t >= b) return 1
  return (t - a) / (b - a)
}

const BEATS: { text: string; accent?: string; sub?: string }[] = [
  { text: 'PITCH', accent: 'SAMPLES' },
  { text: 'CLOSE', accent: 'CLIENTS' },
  { text: 'KEEP THE', accent: 'MARGIN' },
  { text: 'TALENT', accent: '→ SALES' },
  { text: 'ZERO', accent: 'UPFRONT HIRE' },
]

export default function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let start = performance.now()
    const LOOP = 10000 // 10s full cycle — fast paced

    function resize() {
      const parent = canvas!.parentElement
      const w = parent?.clientWidth || window.innerWidth
      const h = parent?.clientHeight || window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function paint(now: number) {
      const w = canvas!.clientWidth
      const h = canvas!.clientHeight
      const t = reduce ? 0.35 : ((now - start) % LOOP) / LOOP

      ctx!.clearRect(0, 0, w, h)

      // soft gold wash right side
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
      const grd = ctx!.createRadialGradient(w * 0.78, h * 0.4, 0, w * 0.78, h * 0.4, Math.max(w, h) * 0.55)
      grd.addColorStop(0, `rgba(226,182,86,${0.08 * pulse})`)
      grd.addColorStop(0.5, 'rgba(13,53,48,0.25)')
      grd.addColorStop(1, 'rgba(6,25,22,0)')
      ctx!.fillStyle = grd
      ctx!.fillRect(0, 0, w, h)

      // drifting grid
      ctx!.strokeStyle = MUTED
      ctx!.lineWidth = 1
      const step = 56
      const drift = (t * step * 1.4) % step
      for (let x = -step + drift; x < w + step; x += step) {
        ctx!.beginPath()
        ctx!.moveTo(x, 0)
        ctx!.lineTo(x, h)
        ctx!.stroke()
      }
      for (let y = -step + drift * 0.35; y < h + step; y += step) {
        ctx!.beginPath()
        ctx!.moveTo(0, y)
        ctx!.lineTo(w, y)
        ctx!.stroke()
      }

      // Horizontal sweep line (camera feel)
      const sweepY = h * (0.28 + 0.44 * ((Math.sin(t * Math.PI * 2) + 1) / 2))
      ctx!.strokeStyle = 'rgba(226,182,86,0.12)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(0, sweepY)
      ctx!.lineTo(w, sweepY)
      ctx!.stroke()

      // Beat index (5 beats across loop)
      const n = BEATS.length
      const beatF = t * n
      const bi = Math.min(n - 1, Math.floor(beatF))
      const local = beatF - bi
      const beat = BEATS[bi]

      // enter / hold / exit
      let alpha = 1
      let scale = 1
      let yOff = 0
      if (local < 0.18) {
        const u = spring(local / 0.18)
        alpha = u
        scale = 0.86 + 0.14 * u
        yOff = (1 - u) * 28
      } else if (local > 0.78) {
        const u = expOut((local - 0.78) / 0.22)
        alpha = 1 - u
        scale = 1 + 0.08 * u
        yOff = -12 * u
      }

      // slight continuous camera push
      const cam = 1 + 0.03 * Math.sin(t * Math.PI * 2)

      const cx = w * 0.72
      const cy = h * 0.42 + yOff

      ctx!.save()
      ctx!.translate(cx, cy)
      ctx!.scale(scale * cam, scale * cam)
      ctx!.globalAlpha = alpha * 0.95

      // main word
      const fs = Math.max(28, Math.min(64, w * 0.055))
      ctx!.font = `800 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`
      ctx!.textAlign = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillStyle = WHITE
      ctx!.fillText(beat.text, 0, -fs * 0.55)

      // accent word in gold
      if (beat.accent) {
        const fs2 = fs * 0.92
        ctx!.font = `800 ${fs2}px ui-sans-serif, system-ui, -apple-system, sans-serif`
        ctx!.fillStyle = GOLD
        // letter stagger reveal inside beat
        const reveal = clamp01((local - 0.08) / 0.25)
        const letters = beat.accent.split('')
        const full = beat.accent
        ctx!.font = `800 ${fs2}px ui-sans-serif, system-ui, -apple-system, sans-serif`
        const totalW = ctx!.measureText(full).width
        let x = -totalW / 2
        for (let i = 0; i < letters.length; i++) {
          const li = clamp01((reveal * letters.length - i) / 1.2)
          const ch = letters[i]
          const cw = ctx!.measureText(ch).width
          ctx!.globalAlpha = alpha * li
          ctx!.fillText(ch, x + cw / 2, fs * 0.55)
          x += cw
        }
      }

      ctx!.restore()

      // floating mini cards (sample silhouettes) — right zone, low opacity
      const cardAlpha = 0.35 * (0.6 + 0.4 * Math.sin(t * Math.PI * 4))
      for (let i = 0; i < 3; i++) {
        const phase = (t + i * 0.22) % 1
        const cAlpha = cardAlpha * Math.sin(phase * Math.PI)
        if (cAlpha < 0.02) continue
        const ox = w * (0.58 + i * 0.12)
        const oy = h * (0.55 + Math.sin((t + i) * Math.PI * 2) * 0.04)
        const cw = 88 + i * 12
        const ch = 56
        ctx!.save()
        ctx!.globalAlpha = cAlpha
        ctx!.fillStyle = '#101c19'
        ctx!.strokeStyle = 'rgba(226,182,86,0.2)'
        ctx!.lineWidth = 1
        roundRect(ctx!, ox, oy, cw, ch, 12)
        ctx!.fill()
        ctx!.stroke()
        ctx!.fillStyle = 'rgba(226,232,240,0.12)'
        ctx!.fillRect(ox + 12, oy + 14, cw * 0.55, 6)
        ctx!.fillRect(ox + 12, oy + 28, cw * 0.4, 6)
        ctx!.restore()
      }

      // thin connector talent→sales on specific beat
      if (bi === 3) {
        const u = spring(seg(local, 0.15, 0.7))
        ctx!.save()
        ctx!.globalAlpha = 0.45 * alpha * u
        ctx!.strokeStyle = 'rgba(226,182,86,0.35)'
        ctx!.lineWidth = 1.5
        const x0 = w * 0.52
        const x1 = w * 0.52 + (w * 0.28) * u
        const y0 = h * 0.62
        ctx!.beginPath()
        ctx!.moveTo(x0, y0)
        ctx!.lineTo(x1, y0)
        ctx!.stroke()
        ctx!.restore()
      }

      if (!reduce) raf = requestAnimationFrame(paint)
    }

    raf = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [reduce])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
