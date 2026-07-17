import {
  createManageUserHandler,
  type ManageUserDependencies,
} from './index.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const actorId = '11111111-1111-1111-1111-111111111111'
const memberId = '22222222-2222-2222-2222-222222222222'

function createDependencies(
  overrides: Partial<ManageUserDependencies> = {},
): ManageUserDependencies {
  return {
    allowedOrigins: ['http://localhost:5173'],
    loadProfile: async () => ({ role: 'admin', status: 'active' }),
    manageUser: async (management) => ({
      status: management.action === 'restore' ? 'active' : 'deactivated',
    }),
    verifyCaller: async () => actorId,
    ...overrides,
  }
}

function request(
  body: unknown,
  authorization = 'Bearer caller-token-placeholder',
) {
  return new Request('http://localhost/functions/v1/manage-user', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
    },
    body: JSON.stringify(body),
  })
}

Deno.test('manage-user denies a member before any mutation', async () => {
  let mutated = false
  const response = await createManageUserHandler(
    createDependencies({
      loadProfile: async () => ({ role: 'member', status: 'active' }),
      manageUser: async () => {
        mutated = true
        return { status: 'deactivated' }
      },
    }),
  )(request({ action: 'deactivate', userId: memberId }))

  assert(response.status === 403, 'member must be denied')
  assert(!mutated, 'member must not mutate an account')
})

Deno.test('manage-user rejects self-deactivation explicitly', async () => {
  let mutated = false
  const response = await createManageUserHandler(
    createDependencies({
      manageUser: async () => {
        mutated = true
        return { status: 'deactivated' }
      },
    }),
  )(request({ action: 'deactivate', userId: actorId }))
  const payload = await response.json()

  assert(response.status === 409, 'self-deactivation must conflict')
  assert(
    payload.code === 'SELF_DEACTIVATION_FORBIDDEN',
    'safe code must be returned',
  )
  assert(!mutated, 'self-deactivation must not reach the database')
})

Deno.test('manage-user delegates deactivation to the transactional database operation', async () => {
  let receivedActor = ''
  let receivedAction = ''
  const response = await createManageUserHandler(
    createDependencies({
      manageUser: async (management, receivedActorId) => {
        receivedAction = management.action
        receivedActor = receivedActorId
        return { status: 'deactivated' }
      },
    }),
  )(request({ action: 'deactivate', userId: memberId }))

  assert(response.status === 200, 'deactivation must succeed')
  assert(receivedAction === 'deactivate', 'deactivation must be delegated')
  assert(receivedActor === actorId, 'verified administrator must be the actor')
})

Deno.test('manage-user delegates restore to the transactional database operation', async () => {
  let receivedAction = ''
  const response = await createManageUserHandler(
    createDependencies({
      manageUser: async (management) => {
        receivedAction = management.action
        return { status: 'active' }
      },
    }),
  )(request({ action: 'restore', userId: memberId }))

  assert(response.status === 200, 'restore must succeed')
  assert(receivedAction === 'restore', 'restore must be delegated')
})
