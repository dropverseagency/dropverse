'use client'

import Image from 'next/image'
import Link from 'next/link'
import { DROPVERSE_LOGO_SRC } from '../lib/dropverseLogo'

/** Official DropVerse horizontal logo for shared headers (aspect preserved). */
export default function Brand({ compact = false }: { compact?: boolean }) {
  const height = compact ? 32 : 40
  const width = Math.round(height * 2.5)

  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
      <Image
        src={DROPVERSE_LOGO_SRC}
        alt="DropVerse logo"
        width={width}
        height={height}
        className={
          compact
            ? 'h-8 w-auto max-h-8 max-w-[9.5rem] object-contain'
            : 'h-9 w-auto max-h-10 max-w-[11rem] object-contain sm:h-10 sm:max-w-[12.5rem]'
        }
        priority
        unoptimized
      />
    </Link>
  )
}
