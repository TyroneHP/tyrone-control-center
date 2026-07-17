import {
  AccountRuleError,
  createPasswordRedirectUrl,
  normalizeEmail,
  parseManageUserRequest,
  parseInvitationRequest,
  parseAllowedOrigins,
  resolveRequestOrigin,
  toSafeError,
} from './accountRules.ts'
import { corsHeaders } from './cors.ts'
import {
  createAdminClient,
  createUserClient,
  type SupabaseClientFactory,
} from './supabaseClients.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  assert(actualJson === expectedJson, `${message}: ${actualJson} !== ${expectedJson}`)
}

Deno.test('normalizes invitation e-mail addresses', () => {
  assertEquals(normalizeEmail('  Admin@Example.COM '), 'admin@example.com', 'email')
})

Deno.test('validates and normalizes invitation request bodies', () => {
  assertEquals(
    parseInvitationRequest({ email: ' Member@Example.COM ' }),
    { email: 'member@example.com' },
    'invitation request',
  )
  assert(
    (() => {
      try {
        parseInvitationRequest({ email: 'keine-adresse' })
        return false
      } catch {
        return true
      }
    })(),
    'invalid email must throw',
  )
})

Deno.test('parses the exact account-management request union', () => {
  assertEquals(
    parseManageUserRequest({
      action: 'deactivate',
      userId: '22222222-2222-2222-2222-222222222222',
    }),
    {
      action: 'deactivate',
      userId: '22222222-2222-2222-2222-222222222222',
    },
    'deactivation request',
  )
  assertEquals(
    parseManageUserRequest({
      action: 'restore',
      userId: '22222222-2222-2222-2222-222222222222',
    }),
    {
      action: 'restore',
      userId: '22222222-2222-2222-2222-222222222222',
    },
    'restore request',
  )
})

Deno.test('rejects unsupported management actions, user ids, and fields', () => {
  for (const payload of [
    { action: 'delete', userId: '22222222-2222-2222-2222-222222222222' },
    { action: 'restore', userId: 'not-a-uuid' },
    {
      action: 'deactivate',
      userId: '22222222-2222-2222-2222-222222222222',
      extra: true,
    },
  ]) {
    let rejected = false
    try {
      parseManageUserRequest(payload)
    } catch (error) {
      rejected =
        error instanceof AccountRuleError &&
        error.code === 'INVALID_MANAGE_REQUEST'
    }
    assert(rejected, 'invalid management request must be rejected')
  }
})

Deno.test('parses and enforces the exact CORS origin allowlist', () => {
  const allowed = parseAllowedOrigins(
    'https://tyronehp.github.io, http://localhost:5173, https://tyronehp.github.io',
  )

  assertEquals(
    allowed,
    ['https://tyronehp.github.io', 'http://localhost:5173'],
    'origins',
  )
  assertEquals(
    resolveRequestOrigin('http://localhost:5173', allowed),
    'http://localhost:5173',
    'allowed request origin',
  )
  assert(
    (() => {
      try {
        resolveRequestOrigin('https://example.invalid', allowed)
        return false
      } catch {
        return true
      }
    })(),
    'disallowed origin must throw',
  )
})

Deno.test('builds the password redirect under the configured Pages base', () => {
  assertEquals(
    createPasswordRedirectUrl(
      'https://tyronehp.github.io/tyrone-control-center/',
      ['https://tyronehp.github.io'],
    ),
    'https://tyronehp.github.io/tyrone-control-center/update-password',
    'redirect URL',
  )
})

Deno.test('returns strict CORS headers only for an allowed origin', () => {
  const headers = corsHeaders('http://localhost:5173', [
    'http://localhost:5173',
  ])

  assertEquals(
    headers['Access-Control-Allow-Origin'],
    'http://localhost:5173',
    'CORS origin',
  )
  assert(
    headers['Access-Control-Allow-Headers'].includes('authorization'),
    'authorization header must be allowed',
  )
})

Deno.test('redacts unknown service errors and preserves safe account codes', () => {
  const unknown = toSafeError(new Error('database password: private-value'))
  const capacity = toSafeError(new Error('ACCOUNT_CAPACITY_REACHED'))

  assertEquals(unknown.code, 'INTERNAL_ERROR', 'unknown error code')
  assert(!unknown.message.includes('private-value'), 'unknown error must be redacted')
  assertEquals(capacity.code, 'ACCOUNT_CAPACITY_REACHED', 'capacity code')
  assertEquals(capacity.status, 409, 'capacity status')
  assertEquals(
    capacity.message,
    'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
    'capacity message',
  )
})

Deno.test('preserves safe codes from Supabase service error objects', () => {
  const capacity = toSafeError({
    code: 'P0001',
    message: 'ACCOUNT_CAPACITY_REACHED',
  })

  assertEquals(capacity.code, 'ACCOUNT_CAPACITY_REACHED', 'capacity code')
  assertEquals(capacity.status, 409, 'capacity status')
})

Deno.test('creates separated service and caller clients without persisted sessions', () => {
  const calls: Array<{
    key: string
    options: Record<string, unknown>
    url: string
  }> = []
  const factory: SupabaseClientFactory = (url, key, options) => {
    calls.push({ url, key, options })
    return { key, options, url }
  }

  const admin = createAdminClient(
    {
      supabaseUrl: 'https://project-ref.supabase.co',
      serviceRoleKey: 'service-role-placeholder',
    },
    factory,
  )
  const user = createUserClient(
    {
      authorization: 'Bearer caller-token-placeholder',
      publicKey: 'publishable-placeholder',
      supabaseUrl: 'https://project-ref.supabase.co',
    },
    factory,
  )

  assertEquals(
    (admin as { url: string }).url,
    'https://project-ref.supabase.co',
    'admin client URL',
  )
  assertEquals(
    (user as { url: string }).url,
    'https://project-ref.supabase.co',
    'user client URL',
  )
  assertEquals(calls[0].key, 'service-role-placeholder', 'admin key')
  assertEquals(calls[1].key, 'publishable-placeholder', 'user key')
  assertEquals(
    (calls[1].options.global as { headers: { Authorization: string } }).headers
      .Authorization,
    'Bearer caller-token-placeholder',
    'caller authorization',
  )
})
