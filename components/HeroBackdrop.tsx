'use client'

/**
 * DropVerse hero backdrop — through-line object: the dual-chevron logo mark.
 * Every frame is computed from time (loop ~12s). Gold accent only on the mark.
 * Respects prefers-reduced-motion.
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

const BG = '#061916'
const GOLD = '#e2b656'
const GOLD_DIM = 'rgba(226,182,86,0.14)'
const LINE = 'rgba(226,182,86,0.22)'
const MUTED = 'rgba(226,232,240,0.06)'

function expOut(t: number, k = 4) {
  return 1 - Math.exp(-k * Math.min(1, Math.max(0, t)))
}
function spring(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.exp(-5.2 * x) * Math.cos(x * Math.PI * 0.55)
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  filled: boolean,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(-size * 0.55, -size * 0.55)
  ctx.lineTo(0, 0)
  ctx.lineTo(-size * 0.55, size * 0.55)
  ctx.lineTo(-size * 0.55, size * 0.28)
  ctx.lineTo(-size * 0.18, 0)
  ctx.lineTo(-size * 0.55, -size * 0.28)
  ctx.closePath()
  ctx.moveTo(-size * 0.05, -size * 0.35)
  ctx.lineTo(size * 0.4, 0)
  ctx.lineTo(-size * 0.05, size * 0.35)
  ctx.lineTo(-size * 0.05, size * 0.18)
  ctx.lineTo(size * 0.18, 0)
  ctx.lineTo(-size * 0.05, -size * 0.18)
  ctx.closePath()
  if (filled) {
    ctx.fillStyle = GOLD
    ctx.fill()
  } else {
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
  }
  ctx.restore()
}

function drawMarkFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
) {
  const r = size * 0.22
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.beginPath()
  const s = size
  const half = s / 2
  ctx.moveTo(-half + r, -half)
  ctx.lineTo(half - r, -half)
  ctx.quadraticCurveTo(half, -half, half, -half + r)
  ctx.lineTo(half, half - r)
  ctx.quadraticCurveTo(half, half, half - r, half)
  ctx.lineTo(-half + r, half)
  ctx.quadraticCurveTo(-half, half, -half, half - r)
  ctx.lineTo(-half, -half + r)
  ctx.quadraticCurveTo(-half, -half, -half + r, -half)
  ctx.closePath()
  ctx.fillStyle = '#0d3530'
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = Math.max(2, size * 0.045)
  ctx.stroke()
  ctx.restore()
  drawChevron(ctx, x, y, size * 0.42, alpha, true)
}

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
    const LOOP = 12000

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
      const t = reduce ? 0 : ((now - start) % LOOP) / LOOP

      ctx!.clearRect(0, 0, w, h)
      const pulse = 0.55 + 0.45 * Math.sin(t * Math.PI * 2)
      const grd = ctx!.createRadialGradient(w * 0.72, h * 0.38, 0, w * 0.72, h * 0.38, Math.max(w, h) * 0.55)
      grd.addColorStop(0, `rgba(226,182,86,${0.07 * pulse})`)
      grd.addColorStop(0.45, 'rgba(13,53,48,0.35)')
      grd.addColorStop(1, 'rgba(6,25,22,0)')
      ctx!.globalAlpha = 1
      ctx!.fillStyle = grd
      ctx!.fillRect(0, 0, w, h)

      ctx!.strokeStyle = MUTED
      ctx!.lineWidth = 1
      const step = 48
      const drift = (t * step) % step
      for (let x = -step + drift; x < w + step; x += step) {
        ctx!.beginPath()
        ctx!.moveTo(x, 0)
        ctx!.lineTo(x, h)
        ctx!.stroke()
      }
      for (let y = -step + drift * 0.4; y < h + step; y += step) {
        ctx!.beginPath()
        ctx!.moveTo(0, y)
        ctx!.lineTo(w, y)
        ctx!.stroke()
      }

      const cx = w * 0.78
      const cy = h * 0.42

      const p1 = expOut(t / 0.22)
      const p2 = t < 0.22 ? 0 : spring((t - 0.22) / 0.23)
      const p3 = t < 0.45 ? 0 : spring((t - 0.45) / 0.23)
      const p4 = t < 0.68 ? 0 : spring((t - 0.68) / 0.2)
      const fadeOut = t < 0.88 ? 1 : 1 - expOut((t - 0.88) / 0.12)

      for (let i = 0; i < 3; i++) {
        const ang = t * Math.PI * 2 + (i * Math.PI * 2) / 3
        const ox = cx + Math.cos(ang) * (90 + i * 28)
        const oy = cy + Math.sin(ang) * (54 + i * 16)
        drawChevron(ctx!, ox, oy, 14 + i * 3, 0.12 + 0.08 * Math.sin(t * Math.PI * 2 + i), false)
      }

      if (p3 > 0) {
        const x0 = w * 0.55
        const x1 = w * 0.88
        const y0 = cy
        ctx!.save()
        ctx!.globalAlpha = 0.35 * p3 * fadeOut
        ctx!.strokeStyle = LINE
        ctx!.lineWidth = 1.5
        ctx!.beginPath()
        ctx!.moveTo(x0, y0)
        const mid = x0 + (x1 - x0) * p3
        ctx!.lineTo(mid, y0)
        ctx!.stroke()
        if (p3 > 0.6) {
          ctx!.globalAlpha = 0.5 * fadeOut
          ctx!.fillStyle = GOLD
          ctx!.font = '600 11px ui-sans-serif, system-ui, sans-serif'
          ctx!.fillText('TALENT', x0 - 4, y0 - 10)
          if (p3 > 0.85) ctx!.fillText('SALES', mid - 28, y0 - 10)
        }
        ctx!.restore()
      }

      if (p2 > 0 && p4 < 0.85) {
        const cardW = 160 * p2
        const cardH = 100 * p2
        const cardX = cx - 40
        const cardY = cy - 20
        ctx!.save()
        ctx!.globalAlpha = 0.55 * Math.min(1, p2 * 1.4) * (1 - p4 * 0.9) * fadeOut
        ctx!.fillStyle = '#101c19'
        ctx!.strokeStyle = GOLD_DIM
        ctx!.lineWidth = 1
        roundRect(ctx!, cardX, cardY, cardW, cardH, 14)
        ctx!.fill()
        ctx!.stroke()
        ctx!.fillStyle = 'rgba(226,232,240,0.12)'
        for (let r = 0; r < 3; r++) {
          ctx!.fillRect(cardX + 14, cardY + 18 + r * 22, cardW * 0.55, 8)
        }
        ctx!.restore()
      }

      const size = 36 + 28 * p4
      const x = cx - 30 * (1 - p1) + 10 * Math.sin(t * Math.PI * 2) * (1 - p4)
      const y = cy + (1 - p1) * 40
      const alpha = Math.min(1, p1) * fadeOut

      if (p4 > 0.15) {
        drawMarkFrame(ctx!, x, y, size * 1.65, alpha * Math.min(1, p4 * 1.2))
      } else {
        drawChevron(ctx!, x, y, size, alpha, true)
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
