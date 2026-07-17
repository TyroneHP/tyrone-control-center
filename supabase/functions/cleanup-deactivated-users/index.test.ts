import {
  createCleanupHandler,
  type CleanupDependencies,
} from './index.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const userId = '22222222-2222-2222-2222-222222222222'

function createDependencies(
  overrides: Partial<CleanupDependencies> = {},
): CleanupDependencies {
  return {
    claimDueUser: async () => true,
    cronSecret: 'cron-secret-placeholder',
    deleteAuthUser: async () => undefined,
    listDueUserIds: async () => [userId],
    releaseClaim: async () => undefined,
    ...overrides,
  }
}

function request(secret?: string) {
  const headers = new Headers()
  if (secret) headers.set('x-cron-secret', secret)
  return new Request(
    'http://localhost/functions/v1/cleanup-deactivated-users',
    { method: 'POST', headers },
  )
}

Deno.test('cleanup rejects a missing or invalid cron secret', async () => {
  const handler = createCleanupHandler(createDependencies())

  assert(
    (await handler(request())).status === 401,
    'missing secret must be rejected',
  )
  assert(
    (await handler(request('wrong-secret'))).status === 401,
    'wrong secret must be rejected',
  )
})

Deno.test('cleanup processes due users and returns counts without e-mail addresses', async () => {
  const secondId = '33333333-3333-3333-3333-333333333333'
  const released: string[] = []
  const response = await createCleanupHandler(
    createDependencies({
      listDueUserIds: async () => [userId, secondId],
      deleteAuthUser: async (candidateId) => {
        if (candidateId === secondId) throw new Error('temporary failure')
      },
      releaseClaim: async (candidateId) => {
        released.push(candidateId)
      },
    }),
  )(request('cron-secret-placeholder'))
  const body = await response.text()

  assert(response.status === 200, 'cleanup must finish the batch')
  assert(
    body === JSON.stringify({ processed: 2, deleted: 1, failed: 1 }),
    'cleanup must return aggregate counts',
  )
  assert(!body.includes('@'), 'cleanup response must not expose e-mail addresses')
  assert(
    JSON.stringify(released) === JSON.stringify([secondId]),
    'a failed deletion must release its claim for retry',
  )
})

Deno.test('cleanup does not delete a user restored before the cleanup claim', async () => {
  let deleted = false
  const response = await createCleanupHandler(
    createDependencies({
      claimDueUser: async () => false,
      deleteAuthUser: async () => {
        deleted = true
      },
    }),
  )(request('cron-secret-placeholder'))

  assert(!deleted, 'an unclaimed candidate must never be deleted')
  assert(
    (await response.text()) ===
      JSON.stringify({ processed: 0, deleted: 0, failed: 0 }),
    'a restored candidate must be skipped',
  )
})

Deno.test('cleanup is idempotent when no due profiles remain', async () => {
  let firstRun = true
  const handler = createCleanupHandler(
    createDependencies({
      listDueUserIds: async () => {
        if (firstRun) {
          firstRun = false
          return [userId]
        }
        return []
      },
    }),
  )

  await handler(request('cron-secret-placeholder'))
  const response = await handler(request('cron-secret-placeholder'))

  assert(
    (await response.text()) ===
      JSON.stringify({ processed: 0, deleted: 0, failed: 0 }),
    'repeated cleanup must have no further effect',
  )
})
