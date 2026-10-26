import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Dynamic Supabase admin rows still use explicit any in several places.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Hash/footer links still use <a> in a few public pages; migrate gradually.
      '@next/next/no-html-link-for-pages': 'warn',
      // Copy still has a few unescaped apostrophes in JSX text.
      'react/no-unescaped-entities': 'warn',
    },
  },
]

export default eslintConfig
