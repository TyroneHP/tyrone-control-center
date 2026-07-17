import { describe, expect, it, vi } from 'vitest'
import { createAuthApi, type AuthApiClient } from './authApi'

function createClient() {
  const client = {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return client
}

describe('createAuthApi', () => {
  it('wraps login, password, sign-out, invitation and bootstrap calls', async () => {
    const client = createClient()
    const api = createAuthApi(
      client as unknown as AuthApiClient,
      'https://tyronehp.github.io/tyrone-control-center/',
    )

    await api.signIn({ email: 'user@example.test', password: 'passwort' })
    await api.requestPasswordReset('user@example.test')
    await api.updatePassword('mindestens-12')
    await api.signOutCurrent()
    await api.signOutAll()
    await api.acceptInvitation()
    await api.bootstrapAdmin('admin@example.test')

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'passwort',
    })
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.test',
      {
        redirectTo:
          'https://tyronehp.github.io/tyrone-control-center/update-password',
      },
    )
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'mindestens-12',
    })
    expect(client.auth.signOut).toHaveBeenNthCalledWith(1, { scope: 'local' })
    expect(client.auth.signOut).toHaveBeenNthCalledWith(2, { scope: 'global' })
    expect(client.rpc).toHaveBeenCalledWith('accept_current_invitation')
    expect(client.functions.invoke).toHaveBeenCalledWith('bootstrap-admin', {
      body: { email: 'admin@example.test' },
    })
  })

  it('throws errors returned by Supabase', async () => {
    const client = createClient()
    client.auth.signInWithPassword.mockResolvedValue({
      error: new Error('invalid credentials'),
    })
    const api = createAuthApi(client as unknown as AuthApiClient, '/')

    await expect(
      api.signIn({ email: 'user@example.test', password: 'falsch' }),
    ).rejects.toThrow('invalid credentials')
  })
})
