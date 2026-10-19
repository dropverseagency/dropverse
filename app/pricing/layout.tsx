import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Compare DropVerse workspace plans, prices, and what each plan includes. Figures come from the live plan configuration.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
