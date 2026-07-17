import {
  AccountRuleError,
  createPasswordRedirectUrl,
  normalizeEmail,
  parseInvitationRequest,
  resolveRequestOrigin,
  toSafeError,
} from '../_shared/accountRules.ts'
import { jsonResponse, optionsResponse } from '../_shared/http.ts'
import {
  enforceRateLimit,
  requestClientAddress,
} from '../_shared/rateLimit.ts'
import { edgeConfiguration, requiredEnv } from '../_shared/runtime.ts'
import { createAdminClient } from '../_shared/supabaseClients.ts'

export interface BootstrapAdminDependencies {
  allowedOrigins: readonly string[]
  appOrigin: string
  bootstrapAdminEmail: string
  deleteStaleAuthUser: (userId: string) => Promise<void>
  enforceRateLimit: (request: Request) => Promise<void>
  loadBootstrapState: () => Promise<
    | { status: 'active' | 'open' | 'pending' }
    | { status: 'stale'; userId: string }
  >
  reserveInvitation: (email: string) => Promise<string>
  revokeInvitation: (invitationId: string) => Promise<void>
  sendInvite: (email: string, redirectTo: string) => Promise<void>
}

function runtimeDependencies(): BootstrapAdminDependencies {
  const config = edgeConfiguration()
  const admin = createAdminClient(config)

  return {
    allowedOrigins: config.allowedOrigins,
    appOrigin: config.appOrigin,
    bootstrapAdminEmail: requiredEnv('BOOTSTRAP_ADMIN_EMAIL'),
    enforceRateLimit: (request) =>
      enforceRateLimit(
        admin,
        'bootstrap-admin',
        requestClientAddress(request),
        5,
        3600,
      ),
    loadBootstrapState: async () => {
      const { data: profile, error } = await admin
        .from('profiles')
        .select('id, invitation_id, status')
        .eq('role', 'admin')
        .in('status', ['invited', 'active'])
        .maybeSingle()
      if (error) throw error
      if (!profile) return { status: 'open' }
      if (profile.status === 'active') return { status: 'active' }
      if (!profile.invitation_id) {
        return { status: 'stale', userId: String(profile.id) }
      }

      const { data: invitation, error: invitationError } = await admin
        .from('invitations')
        .select('expires_at, status')
        .eq('id', profile.invitation_id)
        .maybeSingle()
      if (invitationError) throw invitationError
      if (
        invitation?.status === 'pending' &&
        new Date(invitation.expires_at).getTime() > Date.now()
      ) {
        return { status: 'pending' }
      }
      return { status: 'stale', userId: String(profile.id) }
    },
    deleteStaleAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error && error.status !== 404) throw error
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

      await dependencies.enforceRateLimit(request)

      const { email } = parseInvitationRequest(await request.json())
      if (email !== normalizeEmail(dependencies.bootstrapAdminEmail)) {
        return jsonResponse(
          { status: 'accepted' },
          202,
          requestOrigin,
          dependencies.allowedOrigins,
        )
      }
      const bootstrapState = await dependencies.loadBootstrapState()
      if (bootstrapState.status === 'active' || bootstrapState.status === 'pending') {
        return jsonResponse(
          { status: 'accepted' },
          202,
          requestOrigin,
          dependencies.allowedOrigins,
        )
      }
      if (bootstrapState.status === 'stale') {
        await dependencies.deleteStaleAuthUser(bootstrapState.userId)
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

      return jsonResponse(
        { status: 'accepted' },
        202,
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
      if (
        ['ACCOUNT_ALREADY_EXISTS', 'BOOTSTRAP_CLOSED', 'INVITATION_ALREADY_PENDING'].includes(
          safeError.code,
        )
      ) {
        return jsonResponse(
          { status: 'accepted' },
          202,
          safeOrigin,
          dependencies.allowedOrigins,
        )
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
