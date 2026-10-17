'use client'

/**
 * Sample CTA — Dodo Payments checkout was removed.
 * Keeps the landing layout stable without calling any payment provider.
 */
export default function DodoSampleCheckout({ sampleId }: { sampleId?: string }) {
  return (
    <a
      href={sampleId ? `/samples#${sampleId}` : '#start'}
      className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(226,182,86,0.35)] bg-[rgba(226,182,86,0.08)] px-4 py-2.5 text-sm font-bold text-[#e2b656] transition hover:bg-[rgba(226,182,86,0.14)]"
    >
      Pitch this sample
    </a>
  )
}
