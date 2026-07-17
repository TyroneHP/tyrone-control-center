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
    adminExists: async () => false,
    reserveInvitation: async () => '11111111-1111-1111-1111-111111111111',
    revokeInvitation: async () => undefined,
    sendInvite: async () => undefined,
    writeAudit: async () => undefined,
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

Deno.test('bootstrap-admin rejects every address except BOOTSTRAP_ADMIN_EMAIL', async () => {
  let reserved = false
  const response = await createBootstrapAdminHandler(
    createDependencies({
      reserveInvitation: async () => {
        reserved = true
        return 'unreachable'
      },
    }),
  )(request('other@example.test'))

  assert(response.status === 403, 'wrong bootstrap address must be rejected')
  assert(!reserved, 'wrong bootstrap address must not reserve a slot')
})

Deno.test('bootstrap-admin reserves, sends and audits without returning e-mail', async () => {
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
      writeAudit: async () => {
        operations.push('audit')
      },
    }),
  )(request(' ADMIN@example.test '))
  const payload = await response.json()

  assert(response.status === 201, 'bootstrap must return created')
  assert(
    JSON.stringify(payload).includes('admin@example.test') === false,
    'response must not expose e-mail',
  )
  assert(
    JSON.stringify(operations) === JSON.stringify(['reserve', 'send', 'audit']),
    'bootstrap operations must run in order',
  )
})
