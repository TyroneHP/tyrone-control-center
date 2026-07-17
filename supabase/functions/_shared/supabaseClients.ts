import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from 'npm:@supabase/supabase-js@2.110.7'
import { AccountRuleError } from './accountRules.ts'

export type SupabaseClientFactory<T = unknown> = (
  url: string,
  key: string,
  options: SupabaseClientOptions<'public'>,
) => T

const defaultFactory = createClient as SupabaseClientFactory<SupabaseClient>

export function createAdminClient<T = SupabaseClient>(
  config: { serviceRoleKey: string; supabaseUrl: string },
  factory: SupabaseClientFactory<T> = defaultFactory as SupabaseClientFactory<T>,
) {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new AccountRuleError('CONFIGURATION_ERROR')
  }

  return factory(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export function createUserClient<T = SupabaseClient>(
  config: {
    authorization: string
    publicKey: string
    supabaseUrl: string
  },
  factory: SupabaseClientFactory<T> = defaultFactory as SupabaseClientFactory<T>,
) {
  if (
    !config.authorization.startsWith('Bearer ') ||
    !config.publicKey ||
    !config.supabaseUrl
  ) {
    throw new AccountRuleError('AUTHENTICATION_REQUIRED')
  }

  return factory(config.supabaseUrl, config.publicKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: config.authorization },
    },
  })
}
