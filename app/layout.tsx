import type { Metadata } from 'next'
import { DM_Sans, Manrope, Noto_Sans_Arabic } from 'next/font/google'
import './globals.css'
import Motion from '../components/Motion'
import ThemeToggle from '../components/ThemeToggle'

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const headingFont = Manrope({ subsets: ['latin'], variable: '--font-heading', display: 'swap' })
const arabicFont = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' })

export const metadata: Metadata = {
 metadataBase:new URL('https://dropverse.js.org'),
 title:{default:'DropVerse — Linking Talent to Sales',template:'%s | DropVerse'},
 description:'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
 keywords:['drop servicing','freelancers','video editing','graphic design','web design','UGC content','copywriting'],
 authors:[{name:'DropVerse'}], icons:{icon:'/dropverse-logo.jpeg',apple:'/dropverse-logo.jpeg'},
 openGraph:{type:'website',locale:'en_US',title:'DropVerse — Linking Talent to Sales',description:'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',siteName:'DropVerse',images:[{url:'/dropverse-logo.jpeg',width:500,height:500,alt:'DropVerse logo'}]},
 twitter:{card:'summary_large_image',title:'DropVerse — Linking Talent to Sales',description:'Access professional service samples, discover talented freelancers, and build your Drop Servicing business.'},
 robots:{index:true,follow:true},other:{'spaceremit-verification':'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800'}
}
export const viewport={width:'device-width',initialScale:1,themeColor:'#091917'}
const themeInitScript=`(function(){try{var s=localStorage.getItem('dropverse-theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable} ${arabicFont.variable}`}><head><script dangerouslySetInnerHTML={{__html:themeInitScript}} /></head><body><Motion />{children}<div className="fixed bottom-5 right-5 z-[100]"><ThemeToggle /></div></body></html>
}
