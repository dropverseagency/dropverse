'use client'

import Image from 'next/image'
import Link from 'next/link'
import { DROPVERSE_LOGO_SRC } from '../lib/dropverseLogo'

/** Official DropVerse mark for shared headers (aspect preserved, no stretched text). */
export default function Brand({ compact = false }: { compact?: boolean }) {
  const height = compact ? 36 : 48
  const width = Math.round(height * (480 / 336))

  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
      <Image
        src={DROPVERSE_LOGO_SRC}
        alt="DropVerse"
        width={width}
        height={height}
        className={
          compact
            ? 'h-9 w-auto max-h-9 object-contain'
            : 'h-10 w-auto max-h-12 object-contain sm:h-12'
        }
        priority
        unoptimized
      />
    </Link>
  )
}
