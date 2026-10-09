'use client'
import {useEffect,useState} from 'react'
import {Moon,Sun} from 'lucide-react'
type Theme='light'|'dark'
export default function ThemeToggle(){
 const [theme,setTheme]=useState<Theme>('light')
 const [mounted,setMounted]=useState(false)
 useEffect(()=>{const saved=window.localStorage.getItem('dropverse-theme');const initial:Theme=saved==='light'||saved==='dark'?saved:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';setTheme(initial);document.documentElement.classList.toggle('dark',initial==='dark');document.documentElement.style.colorScheme=initial;setMounted(true)},[])
 function toggleTheme(){const next:Theme=theme==='dark'?'light':'dark';document.documentElement.classList.toggle('dark',next==='dark');document.documentElement.style.colorScheme=next;window.localStorage.setItem('dropverse-theme',next);setTheme(next)}
 return <button type="button" onClick={toggleTheme} aria-label={!mounted?'Toggle color theme':theme==='dark'?'Switch to light mode':'Switch to dark mode'} aria-pressed={mounted&&theme==='dark'} title={mounted?(theme==='dark'?'Switch to light mode':'Switch to dark mode'):'Toggle color theme'} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors duration-200 hover:bg-muted">{mounted&&theme==='dark'?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}</button>
}
