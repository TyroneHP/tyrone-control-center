import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { getSupabaseClient } from '../../lib/supabase/client'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']

export type ManageUserRequest =
  | { action: 'deactivate'; userId: string }
  | { action: 'restore'; userId: string }

export interface AccountCapacity {
  maximumSlots: number
  occupiedSlots: number
}

export interface AccountManagement {
  capacity: AccountCapacity
  invitations: Invitation[]
  profiles: Profile[]
}

export interface SettingsApi {
  inviteUser: (email: string) => Promise<void>
  listAccounts: () => Promise<AccountManagement>
  manageUser: (request: ManageUserRequest) => Promise<void>
}

export class AccountFunctionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AccountFunctionError'
  }
}

async function throwFunctionError(error: unknown): Promise<never> {
  const context =
    typeof error === 'object' && error && 'context' in error
      ? error.context
      : null
  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as {
        code?: unknown
        message?: unknown
      }
      if (
        typeof payload.code === 'string' &&
        typeof payload.message === 'string'
      ) {
        throw new AccountFunctionError(payload.code, payload.message)
      }
    } catch (responseError) {
      if (responseError instanceof AccountFunctionError) throw responseError
    }
  }

  if (error instanceof Error) throw error
  throw new Error('Die Kontoanfrage ist fehlgeschlagen.')
}

export function createSettingsApi(
  client: SupabaseClient<Database>,
): SettingsApi {
  return {
    async listAccounts() {
      const [profilesResult, invitationsResult, capacityResult] =
        await Promise.all([
        client.from('profiles').select('*').order('created_at'),
        client.from('invitations').select('*').order('created_at'),
        client.rpc('get_account_capacity').single(),
      ])
      if (profilesResult.error) throw profilesResult.error
      if (invitationsResult.error) throw invitationsResult.error
      if (capacityResult.error) throw capacityResult.error
      return {
        capacity: {
          maximumSlots: capacityResult.data.maximum_slots,
          occupiedSlots: capacityResult.data.occupied_slots,
        },
        invitations: invitationsResult.data,
        profiles: profilesResult.data,
      }
    },
    async inviteUser(email) {
      const { error } = await client.functions.invoke('invite-user', {
        body: { email },
      })
      if (error) await throwFunctionError(error)
    },
    async manageUser(request) {
      const { error } = await client.functions.invoke('manage-user', {
        body: request,
      })
      if (error) await throwFunctionError(error)
    },
  }
}

let browserSettingsApi: SettingsApi | undefined

export function getSettingsApi() {
  if (!browserSettingsApi) {
    browserSettingsApi = createSettingsApi(getSupabaseClient())
  }
  return browserSettingsApi
}
