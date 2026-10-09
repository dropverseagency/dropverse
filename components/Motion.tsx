'use client'
import { useEffect } from 'react'

export default function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const nodes = Array.from(document.querySelectorAll('main section'))
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in')
          io.unobserve(entry.target)
          return
        }
        if (!entry.target.classList.contains('in')) entry.target.classList.add('reveal')
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    nodes.forEach((node) => io.observe(node))
    return () => io.disconnect()
  }, [])
  return null
}
