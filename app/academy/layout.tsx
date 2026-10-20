import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DropVerse Academy',
  description:
    'Learn drop servicing step by step — free beginner path covering niches, offers, outreach, delivery, and a 7-day launch plan. Advanced training coming soon.',
}

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return children
}
