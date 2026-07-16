import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPublicEnv } from '../../config/env'
import type { Database } from './database.types'

let browserClient: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient
  }

  const env = getPublicEnv()
  browserClient = createClient<Database>(
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
