import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { LoginValues } from './schemas'

export type AuthApiClient = SupabaseClient<Database>

function throwIfError(result: { error: Error | null }) {
  if (result.error) throw result.error
}

export function createAuthApi(client: AuthApiClient, appBaseUrl: string) {
  return {
    async signIn(values: LoginValues) {
      throwIfError(await client.auth.signInWithPassword(values))
    },
    async requestPasswordReset(email: string) {
      const base = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`
      throwIfError(
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL('update-password', base).toString(),
        }),
      )
    },
    async updatePassword(password: string) {
      throwIfError(await client.auth.updateUser({ password }))
    },
    async signOutCurrent() {
      throwIfError(await client.auth.signOut({ scope: 'local' }))
    },
    async signOutAll() {
      throwIfError(await client.auth.signOut({ scope: 'global' }))
    },
    async acceptInvitation() {
      throwIfError(await client.rpc('accept_current_invitation'))
    },
    async bootstrapAdmin(email: string) {
      throwIfError(
        await client.functions.invoke('bootstrap-admin', {
          body: { email },
        }),
      )
    },
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>

let browserAuthApi: AuthApi | undefined

export function getAuthApi() {
  if (!browserAuthApi) {
    const appBaseUrl = new URL(
      import.meta.env.BASE_URL,
      window.location.origin,
    ).toString()
    browserAuthApi = createAuthApi(getSupabaseClient(), appBaseUrl)
  }
  return browserAuthApi
}
