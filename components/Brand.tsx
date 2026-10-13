'use client'

import Image from 'next/image'
import Link from 'next/link'
import { DROPVERSE_LOGO_SRC } from '../lib/dropverseLogo'

/** Official DropVerse horizontal mark (aspect preserved). */
export default function Brand({ compact = false }: { compact?: boolean }) {
  const height = compact ? 36 : 44
  const width = Math.round(height * 2.5)

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
            : 'h-10 w-auto max-h-11 object-contain sm:h-11'
        }
        priority
        unoptimized
      />
    </Link>
  )
}
