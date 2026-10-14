'use client'

import Image from 'next/image'
import Link from 'next/link'

/** Official DropVerse horizontal logo — exact design from brand asset. */
export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
      <Image
        src="/dropverse-logo-h.svg"
        alt="DropVerse"
        width={compact ? 140 : 185}
        height={compact ? 29 : 38}
        className={compact ? "h-7 w-auto object-contain" : "h-8 w-auto object-contain sm:h-9"}
        priority
        unoptimized
      />
    </Link>
  )
}
