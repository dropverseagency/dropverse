'use client'
import { useEffect } from 'react'

export default function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const nodes = Array.from(document.querySelectorAll('main section, main .card'))
    const seen = new Set<Element>()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || seen.has(entry.target)) return
        seen.add(entry.target)
        entry.target.classList.add('in')
        io.unobserve(entry.target)
      })
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' })
    nodes.forEach((node) => {
      node.classList.add('reveal')
      io.observe(node)
    })
    return () => io.disconnect()
  }, [])
  return null
}
