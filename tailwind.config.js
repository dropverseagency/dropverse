/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./lib/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {
    colors: {
      background:'rgb(var(--background) / <alpha-value>)', foreground:'rgb(var(--foreground) / <alpha-value>)',
      card:'rgb(var(--card) / <alpha-value>)', 'card-foreground':'rgb(var(--card-foreground) / <alpha-value>)',
      popover:'rgb(var(--popover) / <alpha-value>)', 'popover-foreground':'rgb(var(--popover-foreground) / <alpha-value>)',
      muted:'rgb(var(--muted) / <alpha-value>)', 'muted-foreground':'rgb(var(--muted-foreground) / <alpha-value>)',
      border:'rgb(var(--border) / <alpha-value>)', input:'rgb(var(--input) / <alpha-value>)',
      primary:'rgb(var(--primary) / <alpha-value>)', 'primary-foreground':'rgb(var(--primary-foreground) / <alpha-value>)',
      secondary:'rgb(var(--secondary) / <alpha-value>)', 'secondary-foreground':'rgb(var(--secondary-foreground) / <alpha-value>)',
      accent:'rgb(var(--accent) / <alpha-value>)', 'accent-foreground':'rgb(var(--accent-foreground) / <alpha-value>)',
      ring:'rgb(var(--ring) / <alpha-value>)', success:'rgb(var(--success) / <alpha-value>)',
      warning:'rgb(var(--warning) / <alpha-value>)', danger:'rgb(var(--danger) / <alpha-value>)',
      gold:'rgb(var(--gold-rgb) / <alpha-value>)',
      neutral:Object.fromEntries([50,100,200,300,400,500,600,700,800,900,950].map(n=>[n,`rgb(var(--neutral-${n}) / <alpha-value>)`])),
      teal:Object.fromEntries([50,100,200,300,400,500,600,700,800,900,950].map(n=>[n,`rgb(var(--teal-${n}) / <alpha-value>)`])),
    },
    borderRadius:{sm:'var(--radius-sm)',md:'var(--radius-md)',lg:'var(--radius-lg)'},
    boxShadow:{soft:'var(--shadow-sm)',card:'var(--shadow-md)',elevated:'var(--shadow-lg)'},
    fontFamily:{sans:['var(--font-body)','Arial','sans-serif'],display:['var(--font-heading)','var(--font-body)','sans-serif']},
    fontSize:{xs:['.75rem',{lineHeight:'1rem'}],sm:['.875rem',{lineHeight:'1.25rem'}],base:['1rem',{lineHeight:'1.6rem'}],lg:['1.125rem',{lineHeight:'1.75rem'}],xl:['1.25rem',{lineHeight:'1.8rem']},'2xl':['1.5rem',{lineHeight:'2rem'}],'3xl':['1.875rem',{lineHeight:'2.25rem'}],'4xl':['2.25rem',{lineHeight:'2.6rem'}],'5xl':['3rem',{lineHeight:'1.08'}],'6xl':['3.75rem',{lineHeight:'1.02'}]},
    spacing:{'18':'4.5rem','22':'5.5rem'}
  }},
  plugins:[]
}
