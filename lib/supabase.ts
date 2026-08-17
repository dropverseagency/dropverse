import { createBrowserClient } from '@supabase/ssr'

/**
 * DropVerse Supabase client (browser).
 * Active as soon as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are set. Until then, pages remain static placeholders (see README).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
