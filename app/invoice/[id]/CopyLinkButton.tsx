'use client'
import { useState } from 'react'

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  function copyLink() {
    navigator.clipboard
      .writeText(typeof window !== 'undefined' ? window.location.href : '')
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }
  return (
    <button
      onClick={copyLink}
      className="shrink-0 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3 py-1.5 text-[11px] font-bold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.18)]"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
