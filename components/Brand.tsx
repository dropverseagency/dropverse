'use client'

import Image from 'next/image'
import Link from 'next/link'

/** Original DropVerse arrow silhouette, adapted for light and dark surfaces. */
export default function Brand({
  compact = false,
  editorial = false,
  gold = true,
}: {
  compact?: boolean
  editorial?: boolean
  gold?: boolean
}) {
  const icon = compact ? 28 : 36

  if (editorial) {
    return (
      <Link href="/" className="editorial-brand" aria-label="DropVerse home">
        <Image
          src={gold ? '/editorial/dropverse-mark-dark.png' : '/editorial/dropverse-mark-light.png'}
          alt=""
          width={44}
          height={44}
          className="editorial-brand-mark"
          priority
        />
        <span className={`editorial-wordmark ${gold ? 'editorial-wordmark-gold' : ''}`}>
          <span>DROP</span>
          <span>VERSE</span>
        </span>
      </Link>
    )
  }

  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="DropVerse home">
      <Image
        src="/editorial/dropverse-mark-dark.png"
        alt=""
        width={icon}
        height={icon}
        className={compact ? 'h-7 w-7 object-contain' : 'h-8 w-8 object-contain sm:h-9 sm:w-9'}
        priority
      />
      <span
        className={`font-display font-extrabold tracking-tight ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}
      >
        <span className="text-white">DROP</span>
        <span className="text-[#d8b45a]">VERSE</span>
      </span>
    </Link>
  )
}
