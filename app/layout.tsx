import type { Metadata } from 'next'
import './globals.css'
import Motion from '../components/Motion'
import VisitBeacon from '../components/VisitBeacon'

export const metadata: Metadata = {
  metadataBase: new URL('https://dropverse.js.org'),
  title: { default: 'DropVerse — Linking Talent to Sales', template: '%s | DropVerse' },
  description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
  keywords: ['drop servicing', 'freelancers', 'video editing', 'graphic design', 'web design', 'UGC content', 'copywriting'],
  authors: [{ name: 'DropVerse' }],
  icons: { icon: '/dropverse-logo.jpeg', apple: '/dropverse-logo.jpeg' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — Linking Talent to Sales',
    description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
    siteName: 'DropVerse',
    images: [{ url: '/dropverse-logo.jpeg', width: 500, height: 500, alt: 'DropVerse logo' }],
  },
  twitter: { card: 'summary_large_image', title: 'DropVerse — Linking Talent to Sales', description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business.' },
  robots: { index: true, follow: true },
  other: { 'spaceremit-verification': 'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800' },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#061916' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Motion /><VisitBeacon />{children}</body></html>
}
