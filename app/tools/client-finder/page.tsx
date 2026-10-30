import type { Metadata } from 'next'
import ClientFinder from './ClientFinder'

export const metadata: Metadata = {
  title: 'Client Request Finder | DropVerse Tools',
  description: 'Find public posts where people explicitly ask for creative and digital services.',
  robots: { index: true, follow: true },
}

export default function ClientFinderPage() {
  return <ClientFinder />
}
