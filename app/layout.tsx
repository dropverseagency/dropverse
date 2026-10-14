import type { Metadata } from 'next'
import { DM_Sans, Manrope, Noto_Sans_Arabic } from 'next/font/google'
import './globals.css'
import Motion from '../components/Motion'

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const headingFont = Manrope({ subsets: ['latin'], variable: '--font-heading', display: 'swap' })
const arabicFont = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://dropverse.js.org'),
  title: {
    default: 'DropVerse — Project & Workspace Platform for Digital Teams',
    template: '%s | DropVerse',
  },
  description:
    'B2B SaaS workspace for digital teams — manage projects, clients, assets, and workflows in one place.',
  keywords: [
    'B2B SaaS',
    'workspace management',
    'project management',
    'workflow automation',
    'team collaboration',
    'DropVerse',
  ],
  authors: [{ name: 'DropVerse' }],
  icons: { icon: '/dropverse-logo.jpeg', apple: '/dropverse-logo.jpeg' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — Project & Workspace Platform for Digital Teams',
    description:
      'B2B SaaS workspace for digital teams — manage projects, clients, assets, and workflows in one place.',
    siteName: 'DropVerse',
    images: [{ url: '/dropverse-logo.jpeg', width: 500, height: 500, alt: 'DropVerse logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropVerse — Project & Workspace Platform for Digital Teams',
    description:
      'B2B SaaS workspace for digital teams — manage projects, clients, assets, and workflows in one place.',
  },
  robots: { index: true, follow: true },
  other: {
    'spaceremit-verification': 'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#061916',
}

// Default dark (original brand). Only switch to light when the user explicitly saved it.
const themeInitScript = `(function(){try{var s=localStorage.getItem('dropverse-theme');var d=s!=='light';document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){document.documentElement.classList.add('dark')}})()`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${headingFont.variable} ${arabicFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Motion />
        {children}
      </body>
    </html>
  )
}
