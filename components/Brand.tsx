'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
      <Image
        src="/dropverse-logo.jpeg"
        alt="DropVerse — Linking Talent to Sales"
        width={compact ? 42 : 52}
        height={compact ? 42 : 52}
        className="rounded-xl object-cover"
        priority
      />
      <span className="font-display text-xl font-extrabold tracking-[.16em]">
        DROP<span className="text-[#d8b45a]">VERSE</span>
      </span>
    </Link>
  )
}
