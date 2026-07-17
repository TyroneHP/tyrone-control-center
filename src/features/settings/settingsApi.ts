import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { getSupabaseClient } from '../../lib/supabase/client'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']

export type ManageUserRequest =
  | { action: 'deactivate'; userId: string }
  | { action: 'restore'; userId: string }

export interface AccountManagement {
  invitations: Invitation[]
  profiles: Profile[]
}

export interface SettingsApi {
  inviteUser: (email: string) => Promise<void>
  listAccounts: () => Promise<AccountManagement>
  manageUser: (request: ManageUserRequest) => Promise<void>
}

export function createSettingsApi(
  client: SupabaseClient<Database>,
): SettingsApi {
  return {
    async listAccounts() {
      const [profilesResult, invitationsResult] = await Promise.all([
        client.from('profiles').select('*').order('created_at'),
        client.from('invitations').select('*').order('created_at'),
      ])
      if (profilesResult.error) throw profilesResult.error
      if (invitationsResult.error) throw invitationsResult.error
      return {
        invitations: invitationsResult.data,
        profiles: profilesResult.data,
      }
    },
    async inviteUser(email) {
      const { error } = await client.functions.invoke('invite-user', {
        body: { email },
      })
      if (error) throw error
    },
    async manageUser(request) {
      const { error } = await client.functions.invoke('manage-user', {
        body: request,
      })
      if (error) throw error
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
