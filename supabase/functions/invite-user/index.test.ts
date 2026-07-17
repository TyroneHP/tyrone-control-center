import {
  createInviteUserHandler,
  type InviteUserDependencies,
} from './index.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createDependencies(
  overrides: Partial<InviteUserDependencies> = {},
): InviteUserDependencies {
  return {
    allowedOrigins: ['http://localhost:5173'],
    appOrigin: 'http://localhost:5173/',
    enforceRateLimit: async () => undefined,
    loadProfile: async () => ({ role: 'admin', status: 'active' }),
    reserveInvitation: async () => '22222222-2222-2222-2222-222222222222',
    revokeInvitation: async () => undefined,
    sendInvite: async () => undefined,
    verifyCaller: async () => '11111111-1111-1111-1111-111111111111',
    ...overrides,
  }
}

function request(authorization?: string) {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: 'http://localhost:5173',
  })
  if (authorization) headers.set('authorization', authorization)

  return new Request('http://localhost/functions/v1/invite-user', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'member@example.test' }),
  })
}

Deno.test('invite-user requires a bearer token', async () => {
  const response = await createInviteUserHandler(createDependencies())(request())

  assert(response.status === 401, 'missing bearer token must be rejected')
})

Deno.test('invite-user denies an active member', async () => {
  let reserved = false
  const response = await createInviteUserHandler(
    createDependencies({
      loadProfile: async () => ({ role: 'member', status: 'active' }),
      reserveInvitation: async () => {
        reserved = true
        return 'unreachable'
      },
    }),
  )(request('Bearer caller-token-placeholder'))

  assert(response.status === 403, 'member must be denied')
  assert(!reserved, 'member must not reserve a slot')
})

Deno.test('invite-user maps the eleventh reservation to a safe conflict', async () => {
  const response = await createInviteUserHandler(
    createDependencies({
      reserveInvitation: async () => {
        throw new Error('ACCOUNT_CAPACITY_REACHED')
      },
    }),
  )(request('Bearer caller-token-placeholder'))
  const payload = await response.json()

  assert(response.status === 409, 'capacity must return conflict')
  assert(
    payload.code === 'ACCOUNT_CAPACITY_REACHED',
    'capacity code must be preserved',
  )
  assert(
    payload.message ===
      'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
    'capacity message must be safe and current',
  )
})

Deno.test('invite-user sends a transactionally audited administrator invitation', async () => {
  const operations: string[] = []
  const response = await createInviteUserHandler(
    createDependencies({
      reserveInvitation: async () => {
        operations.push('reserve')
        return '22222222-2222-2222-2222-222222222222'
      },
      sendInvite: async () => {
        operations.push('send')
      },
    }),
  )(request('Bearer caller-token-placeholder'))

  assert(response.status === 201, 'invite must return created')
  assert(
    JSON.stringify(operations) === JSON.stringify(['reserve', 'send']),
    'invite operations must run in order',
  )
})

Deno.test('invite-user revokes its transactional reservation when delivery fails', async () => {
  let revoked = ''
  const response = await createInviteUserHandler(
    createDependencies({
      sendInvite: async () => {
        throw new Error('mail delivery failed')
      },
      revokeInvitation: async (invitationId) => {
        revoked = invitationId
      },
    }),
  )(request('Bearer caller-token-placeholder'))

  assert(response.status === 500, 'delivery failure must be safely redacted')
  assert(
    revoked === '22222222-2222-2222-2222-222222222222',
    'failed delivery must revoke the reserved slot',
  )
})

Deno.test('invite-user applies a per-administrator rate limit before reservation', async () => {
  let reserved = false
  const response = await createInviteUserHandler(
    createDependencies({
      enforceRateLimit: async () => {
        throw new Error('RATE_LIMIT_EXCEEDED')
      },
      reserveInvitation: async () => {
        reserved = true
        return 'unreachable'
      },
    }),
  )(request('Bearer caller-token-placeholder'))

  assert(response.status === 429, 'rate limit must return too many requests')
  assert(!reserved, 'rate-limited invite must not reserve a slot')
})
