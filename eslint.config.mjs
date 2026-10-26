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
      // Track as warnings so npm run lint is usable; tighten in follow-ups.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default eslintConfig
