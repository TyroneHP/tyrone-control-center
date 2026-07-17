import {
  AccountRuleError,
  parseManageUserRequest,
  resolveRequestOrigin,
  toSafeError,
  type ManageUserRequest,
} from '../_shared/accountRules.ts'
import { jsonResponse, optionsResponse } from '../_shared/http.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { edgeConfiguration } from '../_shared/runtime.ts'
import {
  createAdminClient,
  createUserClient,
} from '../_shared/supabaseClients.ts'

export interface ManageUserDependencies {
  allowedOrigins: readonly string[]
  enforceRateLimit: (actorId: string) => Promise<void>
  loadProfile: (userId: string) => Promise<{ role: string; status: string }>
  manageUser: (
    request: ManageUserRequest,
    actorId: string,
  ) => Promise<{ status: string }>
  verifyCaller: (authorization: string) => Promise<string>
}

function runtimeDependencies(): ManageUserDependencies {
  const config = edgeConfiguration()
  const admin = createAdminClient(config)

  return {
    allowedOrigins: config.allowedOrigins,
    enforceRateLimit: (actorId) =>
      enforceRateLimit(admin, 'manage-user', actorId, 20, 600),
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
    manageUser: async (request, actorId) => {
      const functionName =
        request.action === 'deactivate'
          ? 'deactivate_profile'
          : 'restore_profile'
      const { data, error } = await admin.rpc(functionName, {
        p_actor_id: actorId,
        p_user_id: request.userId,
      })
      if (error) throw error
      return { status: String(data.status) }
    },
  }
}

export function createManageUserHandler(
  dependencies: ManageUserDependencies = runtimeDependencies(),
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
      await dependencies.enforceRateLimit(actorId)

      const management = parseManageUserRequest(await request.json())
      if (
        management.action === 'deactivate' &&
        management.userId === actorId
      ) {
        throw new AccountRuleError('SELF_DEACTIVATION_FORBIDDEN')
      }

      const result = await dependencies.manageUser(management, actorId)

      return jsonResponse(
        {
          action: management.action,
          status: result.status,
          userId: management.userId,
        },
        200,
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
  Deno.serve(createManageUserHandler())
}
