import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DropVerse — Linking Talent to Sales',
  description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
