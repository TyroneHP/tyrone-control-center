import { AccountRuleError, toSafeError } from '../_shared/accountRules.ts'
import { requiredEnv, runtimeAdminClient } from '../_shared/runtime.ts'

export interface CleanupDependencies {
  cronSecret: string
  deleteAuthUser: (userId: string) => Promise<void>
  listDueUserIds: () => Promise<string[]>
}

function runtimeDependencies(): CleanupDependencies {
  const admin = runtimeAdminClient()

  return {
    cronSecret: requiredEnv('CLEANUP_CRON_SECRET'),
    listDueUserIds: async () => {
      const { data, error } = await admin.rpc('list_cleanup_candidates')
      if (error) throw error
      return (data ?? []).map((candidate: { user_id: string }) =>
        String(candidate.user_id),
      )
    },
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error && error.status !== 404) throw error
    },
  }
}

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function secretsMatch(actual: string, expected: string) {
  if (!actual || !expected) return false
  const encoder = new TextEncoder()
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const actualBytes = new Uint8Array(actualHash)
  const expectedBytes = new Uint8Array(expectedHash)
  let difference = 0
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

export function createCleanupHandler(
  dependencies: CleanupDependencies = runtimeDependencies(),
) {
  return async (request: Request) => {
    try {
      if (request.method !== 'POST') {
        throw new AccountRuleError('METHOD_NOT_ALLOWED')
      }
      if (
        !(await secretsMatch(
          request.headers.get('x-cron-secret') ?? '',
          dependencies.cronSecret,
        ))
      ) {
        throw new AccountRuleError('CRON_AUTHENTICATION_REQUIRED')
      }

      const userIds = await dependencies.listDueUserIds()
      let deleted = 0
      let failed = 0

      for (const userId of userIds) {
        try {
          await dependencies.deleteAuthUser(userId)
          deleted += 1
        } catch {
          failed += 1
        }
      }

      return response({ processed: userIds.length, deleted, failed }, 200)
    } catch (error) {
      const safeError = toSafeError(error)
      return response(
        { code: safeError.code, message: safeError.message },
        safeError.status,
      )
    }
  }
}

if (import.meta.main) {
  Deno.serve(createCleanupHandler())
}
