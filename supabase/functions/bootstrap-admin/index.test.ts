import {
  createBootstrapAdminHandler,
  type BootstrapAdminDependencies,
} from './index.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createDependencies(
  overrides: Partial<BootstrapAdminDependencies> = {},
): BootstrapAdminDependencies {
  return {
    allowedOrigins: ['http://localhost:5173'],
    appOrigin: 'http://localhost:5173/',
    bootstrapAdminEmail: 'admin@example.test',
    deleteStaleAuthUser: async () => undefined,
    enforceRateLimit: async () => undefined,
    loadBootstrapState: async () => ({ status: 'open' }),
    reserveInvitation: async () => '11111111-1111-1111-1111-111111111111',
    revokeInvitation: async () => undefined,
    sendInvite: async () => undefined,
    ...overrides,
  }
}

function request(email: string, method = 'POST') {
  return new Request('http://localhost/functions/v1/bootstrap-admin', {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
    },
    body: method === 'POST' ? JSON.stringify({ email }) : undefined,
  })
}

Deno.test('bootstrap-admin accepts only POST', async () => {
  const response = await createBootstrapAdminHandler(createDependencies())(
    request('admin@example.test', 'GET'),
  )

  assert(response.status === 405, 'GET must be rejected')
})

Deno.test('bootstrap-admin does not reveal whether an address matches the bootstrap address', async () => {
  let reserved = false
  const response = await createBootstrapAdminHandler(
    createDependencies({
      reserveInvitation: async () => {
        reserved = true
        return 'unreachable'
      },
    }),
  )(request('other@example.test'))

  assert(response.status === 202, 'wrong bootstrap address must get a generic response')
  assert(!reserved, 'wrong bootstrap address must not reserve a slot')
})

Deno.test('bootstrap-admin reserves transactionally and sends without returning e-mail', async () => {
  const operations: string[] = []
  const response = await createBootstrapAdminHandler(
    createDependencies({
      reserveInvitation: async () => {
        operations.push('reserve')
        return '11111111-1111-1111-1111-111111111111'
      },
      sendInvite: async () => {
        operations.push('send')
      },
    }),
  )(request(' ADMIN@example.test '))
  const payload = await response.json()

  assert(response.status === 202, 'bootstrap must return a non-enumerating response')
  assert(
    JSON.stringify(payload).includes('admin@example.test') === false,
    'response must not expose e-mail',
  )
  assert(
    JSON.stringify(operations) === JSON.stringify(['reserve', 'send']),
    'bootstrap operations must run in order',
  )
})

Deno.test('bootstrap-admin replaces an expired invited administrator before reissuing', async () => {
  const operations: string[] = []
  const response = await createBootstrapAdminHandler(
    createDependencies({
      loadBootstrapState: async () => ({
        status: 'stale',
        userId: '22222222-2222-2222-2222-222222222222',
      }),
      deleteStaleAuthUser: async () => {
        operations.push('delete-stale')
      },
      reserveInvitation: async () => {
        operations.push('reserve')
        return '11111111-1111-1111-1111-111111111111'
      },
      sendInvite: async () => {
        operations.push('send')
      },
    }),
  )(request('admin@example.test'))

  assert(response.status === 202, 'expired bootstrap must be reissued safely')
  assert(
    JSON.stringify(operations) ===
      JSON.stringify(['delete-stale', 'reserve', 'send']),
    'stale auth user must be removed before a new reservation',
  )
})

Deno.test('bootstrap-admin keeps active and still-valid bootstrap states non-enumerating', async () => {
  for (const status of ['active', 'pending'] as const) {
    let reserved = false
    const response = await createBootstrapAdminHandler(
      createDependencies({
        loadBootstrapState: async () => ({ status }),
        reserveInvitation: async () => {
          reserved = true
          return 'unreachable'
        },
      }),
    )(request('admin@example.test'))

    assert(response.status === 202, `${status} state must look successful`)
    assert(!reserved, `${status} state must not reserve another invitation`)
  }
})

Deno.test('bootstrap-admin applies server-side rate limiting before mutation', async () => {
  let reserved = false
  const response = await createBootstrapAdminHandler(
    createDependencies({
      enforceRateLimit: async () => {
        throw new Error('RATE_LIMIT_EXCEEDED')
      },
      reserveInvitation: async () => {
        reserved = true
        return 'unreachable'
      },
    }),
  )(request('admin@example.test'))

  assert(response.status === 429, 'rate limit must return too many requests')
  assert(!reserved, 'rate-limited bootstrap must not reserve an invitation')
})
