import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPublicEnv } from '../../config/env'

let browserClient: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  const env = getPublicEnv()
  browserClient = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )

  return browserClient
}
