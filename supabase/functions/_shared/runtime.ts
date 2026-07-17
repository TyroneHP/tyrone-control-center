import { AccountRuleError, parseAllowedOrigins } from './accountRules.ts'
import { createAdminClient, createUserClient } from './supabaseClients.ts'

export function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new AccountRuleError('CONFIGURATION_ERROR')
  return value
}

export function edgeConfiguration() {
  return {
    allowedOrigins: parseAllowedOrigins(requiredEnv('ALLOWED_ORIGINS')),
    appOrigin: requiredEnv('APP_ORIGIN'),
    publicKey: requiredEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseUrl: requiredEnv('SUPABASE_URL'),
  }
}

export function runtimeAdminClient() {
  const config = edgeConfiguration()
  return createAdminClient(config)
}

export function runtimeUserClient(authorization: string) {
  const config = edgeConfiguration()
  return createUserClient({ ...config, authorization })
}
