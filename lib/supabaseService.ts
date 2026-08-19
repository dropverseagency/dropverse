import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client.
 *
 * The Vercel env `SUPABASE_SERVICE_ROLE_KEY` stores the long-lived
 * Supabase publishable secret (`sb_secret_...`), which works as a
 * privileged REST key when passed as the `apikey` header. This client
 * therefore passes it as the anon/public key AND authorization header,
 * which PostgREST treats as an admin key.
 */
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { apikey: serviceKey },
      },
    },
  )
}
