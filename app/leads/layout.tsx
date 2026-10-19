import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lead Marketplace',
  description:
    'Browse seller-submitted lead packs on DropVerse. Approval is a listing review, not a guarantee that every contact is verified or sales-qualified.',
}

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return children
}
