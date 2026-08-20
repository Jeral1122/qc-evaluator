import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The database handle, server side only.
 *
 * This uses the SERVICE ROLE key, which bypasses row level security and can read every row in
 * the table. It must never reach the browser, which is why it has no NEXT_PUBLIC_ prefix: Next
 * only ships env vars to the client when they carry that prefix, so the naming is the guard.
 *
 * Built on demand rather than at module load. A missing key should fail the one request that
 * needed it, with a sentence saying so, rather than crashing the whole app at boot or breaking
 * a build that never touches the database.
 */
export function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.',
    )
  }

  // No session to persist: this is a server process, not a signed-in user.
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}
