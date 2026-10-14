'use client'

import Image from 'next/image'
import Link from 'next/link'

/** Official DropVerse mark: transparent gold icon + wordmark (DROP white, VERSE gold). */
export default function Brand({ compact = false }: { compact?: boolean }) {
  const icon = compact ? 28 : 36

  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="DropVerse home">
      <Image
        src="/dropverse-icon.svg"
        alt=""
        width={icon}
        height={icon}
        className={compact ? 'h-7 w-7 object-contain' : 'h-8 w-8 object-contain sm:h-9 sm:w-9'}
        priority
        unoptimized
      />
      <span className={`font-display font-extrabold tracking-tight ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
        <span className="text-white">DROP</span>
        <span className="text-[#d8b45a]">VERSE</span>
      </span>
    </Link>
  )
}
