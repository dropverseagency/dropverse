import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Work Samples',
  description: 'Browse published DropVerse work samples you can use when pitching services. Samples are real catalog entries, not invented case studies.',
}

export default function SamplesLayout({ children }: { children: React.ReactNode }) {
  return children
}
