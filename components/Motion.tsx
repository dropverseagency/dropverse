'use client'
import { useEffect } from 'react'

export default function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const sections = Array.from(document.querySelectorAll('main section'))
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement
        if (!entry.isIntersecting) {
          if (!el.classList.contains('in')) el.classList.add('reveal')
          return
        }
        el.classList.add('in')
        el.querySelectorAll('.card').forEach((card, index) => {
          const node = card as HTMLElement
          node.style.animationDelay = `${Math.min(index, 10) * 60}ms`
          node.classList.add('rise')
        })
        io.unobserve(el)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' })
    sections.forEach((node) => io.observe(node))
    document.querySelectorAll('.glow').forEach((el) => el.classList.add('float-slow'))
    return () => io.disconnect()
  }, [])
  return null
}
