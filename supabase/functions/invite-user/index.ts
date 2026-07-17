import {
  AccountRuleError,
  createPasswordRedirectUrl,
  parseInvitationRequest,
  resolveRequestOrigin,
  toSafeError,
} from '../_shared/accountRules.ts'
import { jsonResponse, optionsResponse } from '../_shared/http.ts'
import { edgeConfiguration } from '../_shared/runtime.ts'
import {
  createAdminClient,
  createUserClient,
} from '../_shared/supabaseClients.ts'

export interface InviteUserDependencies {
  allowedOrigins: readonly string[]
  appOrigin: string
  loadProfile: (userId: string) => Promise<{ role: string; status: string }>
  reserveInvitation: (email: string, actorId: string) => Promise<string>
  revokeInvitation: (invitationId: string) => Promise<void>
  sendInvite: (email: string, redirectTo: string) => Promise<void>
  verifyCaller: (authorization: string) => Promise<string>
  writeAudit: (invitationId: string, actorId: string) => Promise<void>
}

function runtimeDependencies(): InviteUserDependencies {
  const config = edgeConfiguration()
  const admin = createAdminClient(config)

  return {
    allowedOrigins: config.allowedOrigins,
    appOrigin: config.appOrigin,
    verifyCaller: async (authorization) => {
      const userClient = createUserClient({
        authorization,
        publicKey: config.publicKey,
        supabaseUrl: config.supabaseUrl,
      })
      const { data, error } = await userClient.auth.getUser()
      if (error || !data.user) {
        throw new AccountRuleError('AUTHENTICATION_REQUIRED')
      }
      return data.user.id
    },
    loadProfile: async (userId) => {
      const { data, error } = await admin
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single()
      if (error || !data) throw new AccountRuleError('ADMIN_REQUIRED')
      return data
    },
    reserveInvitation: async (email, actorId) => {
      const { data, error } = await admin.rpc('reserve_invitation', {
        p_email: email,
        p_invited_by: actorId,
        p_role: 'member',
      })
      if (error) throw error
      return String(data)
    },
    revokeInvitation: async (invitationId) => {
      const { error } = await admin.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) throw error
    },
    sendInvite: async (email, redirectTo) => {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      })
      if (error) throw error
    },
    writeAudit: async (invitationId, actorId) => {
      const { error } = await admin.from('activity_log').insert({
        action: 'invitation.created',
        actor_id: actorId,
        metadata: { role: 'member' },
        object_id: invitationId,
        object_type: 'invitation',
      })
      if (error) throw error
    },
  }
}

export function createInviteUserHandler(
  dependencies: InviteUserDependencies = runtimeDependencies(),
) {
  return async (request: Request) => {
    const requestOrigin = request.headers.get('origin')

    try {
      resolveRequestOrigin(requestOrigin, dependencies.allowedOrigins)
      if (request.method === 'OPTIONS') {
        return optionsResponse(requestOrigin, dependencies.allowedOrigins)
      }
      if (request.method !== 'POST') {
        throw new AccountRuleError('METHOD_NOT_ALLOWED')
      }

      const authorization = request.headers.get('authorization') ?? ''
      if (!authorization.startsWith('Bearer ')) {
        throw new AccountRuleError('AUTHENTICATION_REQUIRED')
      }

      const actorId = await dependencies.verifyCaller(authorization)
      const profile = await dependencies.loadProfile(actorId)
      if (profile.role !== 'admin' || profile.status !== 'active') {
        throw new AccountRuleError('ADMIN_REQUIRED')
      }

      const { email } = parseInvitationRequest(await request.json())
      const redirectTo = createPasswordRedirectUrl(
        dependencies.appOrigin,
        dependencies.allowedOrigins,
      )
      const invitationId = await dependencies.reserveInvitation(email, actorId)

      try {
        await dependencies.sendInvite(email, redirectTo)
      } catch (error) {
        await dependencies.revokeInvitation(invitationId)
        throw error
      }

      await dependencies.writeAudit(invitationId, actorId)
      return jsonResponse(
        { invitationId, status: 'sent' },
        201,
        requestOrigin,
        dependencies.allowedOrigins,
      )
    } catch (error) {
      const safeError = toSafeError(error)
      let safeOrigin: string | null = null
      try {
        safeOrigin = resolveRequestOrigin(
          requestOrigin,
          dependencies.allowedOrigins,
        )
      } catch {
        // A rejected origin must never be reflected in response headers.
      }
      return jsonResponse(
        { code: safeError.code, message: safeError.message },
        safeError.status,
        safeOrigin,
        dependencies.allowedOrigins,
      )
    }
  }
}

if (import.meta.main) {
  Deno.serve(createInviteUserHandler())
}
