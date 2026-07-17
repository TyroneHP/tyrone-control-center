import {
  AccountRuleError,
  createPasswordRedirectUrl,
  normalizeEmail,
  parseInvitationRequest,
  resolveRequestOrigin,
  toSafeError,
} from '../_shared/accountRules.ts'
import { jsonResponse, optionsResponse } from '../_shared/http.ts'
import { edgeConfiguration, requiredEnv } from '../_shared/runtime.ts'
import { createAdminClient } from '../_shared/supabaseClients.ts'

export interface BootstrapAdminDependencies {
  adminExists: () => Promise<boolean>
  allowedOrigins: readonly string[]
  appOrigin: string
  bootstrapAdminEmail: string
  reserveInvitation: (email: string) => Promise<string>
  revokeInvitation: (invitationId: string) => Promise<void>
  sendInvite: (email: string, redirectTo: string) => Promise<void>
  writeAudit: (invitationId: string) => Promise<void>
}

function runtimeDependencies(): BootstrapAdminDependencies {
  const config = edgeConfiguration()
  const admin = createAdminClient(config)

  return {
    allowedOrigins: config.allowedOrigins,
    appOrigin: config.appOrigin,
    bootstrapAdminEmail: requiredEnv('BOOTSTRAP_ADMIN_EMAIL'),
    adminExists: async () => {
      const { count, error } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .in('status', ['invited', 'active'])
      if (error) throw error
      return (count ?? 0) > 0
    },
    reserveInvitation: async (email) => {
      const { data, error } = await admin.rpc('reserve_invitation', {
        p_email: email,
        p_invited_by: null,
        p_role: 'admin',
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
    writeAudit: async (invitationId) => {
      const { error } = await admin.from('activity_log').insert({
        action: 'invitation.created',
        actor_id: null,
        metadata: { bootstrap: true, role: 'admin' },
        object_id: invitationId,
        object_type: 'invitation',
      })
      if (error) throw error
    },
  }
}

export function createBootstrapAdminHandler(
  dependencies: BootstrapAdminDependencies = runtimeDependencies(),
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

      const { email } = parseInvitationRequest(await request.json())
      if (email !== normalizeEmail(dependencies.bootstrapAdminEmail)) {
        throw new AccountRuleError('BOOTSTRAP_EMAIL_MISMATCH')
      }
      if (await dependencies.adminExists()) {
        throw new AccountRuleError('BOOTSTRAP_CLOSED')
      }

      const redirectTo = createPasswordRedirectUrl(
        dependencies.appOrigin,
        dependencies.allowedOrigins,
      )
      const invitationId = await dependencies.reserveInvitation(email)

      try {
        await dependencies.sendInvite(email, redirectTo)
      } catch (error) {
        await dependencies.revokeInvitation(invitationId)
        throw error
      }

      await dependencies.writeAudit(invitationId)
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
  Deno.serve(createBootstrapAdminHandler())
}
