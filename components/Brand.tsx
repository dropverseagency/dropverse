'use client'

import Image from 'next/image'
import Link from 'next/link'
import { DROPVERSE_LOGO_SRC } from '../lib/dropverseLogo'

/** Official DropVerse horizontal mark (transparent, aspect ~4.7). */
export default function Brand({ compact = false }: { compact?: boolean }) {
  const height = compact ? 32 : 40
  const width = Math.round(height * 4.7)

  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
      <Image
        src={DROPVERSE_LOGO_SRC}
        alt="DropVerse"
        width={width}
        height={height}
        className={
          compact
            ? 'h-8 w-auto max-h-8 object-contain'
            : 'h-9 w-auto max-h-10 object-contain sm:h-10'
        }
        priority
        unoptimized
      />
    </Link>
  )
}
