import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../auth/authContextValue'
import { AuthContext } from '../auth/authContextValue'
import type { AuthApi } from '../auth/authApi'
import {
  AccountFunctionError,
  type AccountManagement,
  type SettingsApi,
} from './settingsApi'
import { SettingsPage } from './SettingsPage'

const adminId = '11111111-1111-1111-1111-111111111111'

function profile(
  id: string,
  email: string,
  status: Profile['status'],
  role: Profile['role'] = 'member',
): Profile {
  return {
    created_at: '2026-07-17T00:00:00Z',
    cleanup_claimed_at: null,
    deactivated_at: status === 'deactivated' ? '2026-07-17T00:00:00Z' : null,
    deletion_scheduled_at:
      status === 'deactivated' ? '2026-08-16T00:00:00Z' : null,
    display_name: null,
    email,
    id,
    invitation_id: status === 'invited' ? `${id.slice(0, -1)}9` : null,
    role,
    status,
    updated_at: '2026-07-17T00:00:00Z',
  }
}

const admin = profile(adminId, 'admin@example.test', 'active', 'admin')

function renderPage(
  currentProfile: Profile,
  data: AccountManagement,
  api: SettingsApi,
  authApi?: AuthApi,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          error: null,
          profile: currentProfile,
          session: null,
          status: 'authenticated',
        }}
      >
        <SettingsPage api={api} authApi={authApi} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function api(data: AccountManagement): SettingsApi {
  return {
    inviteUser: vi.fn().mockResolvedValue(undefined),
    listAccounts: vi.fn().mockResolvedValue(data),
    manageUser: vi.fn().mockResolvedValue(undefined),
  }
}

function sessionApi(): AuthApi {
  return {
    acceptInvitation: vi.fn(),
    bootstrapAdmin: vi.fn(),
    requestPasswordReset: vi.fn(),
    signIn: vi.fn(),
    signOutAll: vi.fn().mockResolvedValue(undefined),
    signOutCurrent: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn(),
  }
}

describe('SettingsPage', () => {
  it('denies account management to a member', () => {
    const settingsApi = api({
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    })
    renderPage(
      profile(
        '22222222-2222-2222-2222-222222222222',
        'member@example.test',
        'active',
      ),
      {
        capacity: { maximumSlots: 10, occupiedSlots: 0 },
        invitations: [],
        profiles: [],
      },
      settingsApi,
    )

    expect(
      screen.getByText(
        'Diese Kontoverwaltung ist nur für Administratoren verfügbar.',
      ),
    ).toBeInTheDocument()
    expect(settingsApi.listAccounts).not.toHaveBeenCalled()
  })

  it('shows account and invitation states and disables invitations at ten slots', async () => {
    const invited = profile(
      '22222222-2222-2222-2222-222222222222',
      'invite@example.test',
      'invited',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 10 },
      profiles: [
        admin,
        profile(
          '33333333-3333-3333-3333-333333333333',
          'active@example.test',
          'active',
        ),
        invited,
        profile(
          '44444444-4444-4444-4444-444444444444',
          'old@example.test',
          'deactivated',
        ),
      ],
      invitations: [
        {
          accepted_at: null,
          auth_user_id: invited.id,
          created_at: '2026-07-17T00:00:00Z',
          email: invited.email,
          expires_at: '2099-07-24T00:00:00Z',
          id: invited.invitation_id!,
          invited_by: adminId,
          revoked_at: null,
          role: 'member',
          status: 'pending',
          updated_at: '2026-07-17T00:00:00Z',
        },
        {
          accepted_at: null,
          auth_user_id: null,
          created_at: '2026-07-17T00:00:00Z',
          email: 'reserved@example.test',
          expires_at: '2099-07-24T00:00:00Z',
          id: '55555555-5555-5555-5555-555555555555',
          invited_by: adminId,
          revoked_at: null,
          role: 'member',
          status: 'pending',
          updated_at: '2026-07-17T00:00:00Z',
        },
      ],
    }

    renderPage(admin, data, api(data))

    expect(
      await screen.findByText('10 von 10'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kontoplätzen belegt oder reserviert'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Aktiv')).toHaveLength(2)
    expect(screen.getByText('Eingeladen')).toBeInTheDocument()
    expect(screen.getByText('Deaktiviert')).toBeInTheDocument()
    expect(screen.getAllByText('Ausstehend')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Einladung senden' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Alle 10 Kontoplätze sind belegt oder reserviert.'),
    ).toBeInTheDocument()
  })

  it('keeps invitations enabled for the tenth account slot', async () => {
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [admin],
    }

    renderPage(admin, data, api(data))

    expect(await screen.findByText('9 von 10')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Einladung senden' }),
    ).toBeEnabled()
  })

  it('keeps capacity-dependent controls disabled while capacity is loading', () => {
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [admin],
    }
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts).mockReturnValue(
      new Promise<AccountManagement>(() => undefined),
    )

    renderPage(admin, data, settingsApi)

    expect(screen.getByLabelText('E-Mail-Adresse')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Einladung senden' }),
    ).toBeDisabled()
    expect(screen.getByText('Kontostand wird geladen.')).toBeInTheDocument()
    expect(screen.queryByText('0 von 0')).not.toBeInTheDocument()
  })

  it('keeps capacity-dependent controls disabled when capacity loading fails', async () => {
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [admin],
    }
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts).mockRejectedValue(
      new Error('capacity unavailable'),
    )

    renderPage(admin, data, settingsApi)

    expect(
      await screen.findByText('Kontostand nicht verfügbar.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Einladung senden' }),
    ).toBeDisabled()
    expect(screen.queryByText('0 von 0')).not.toBeInTheDocument()
  })

  it('requires explicit confirmation before deactivation', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const settingsApi = api(data)
    renderPage(admin, data, settingsApi)

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Konto von member@example.test deaktivieren',
      }),
    )
    expect(settingsApi.manageUser).not.toHaveBeenCalled()

    expect(
      screen.getByRole('dialog', { name: 'Konto deaktivieren' }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )

    expect(settingsApi.manageUser).toHaveBeenCalledWith({
      action: 'deactivate',
      userId: member.id,
    })
  })

  it('lets every active user end the current or all sessions', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const settingsApi = api({
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    })
    const authApi = sessionApi()
    renderPage(
      member,
      {
        capacity: { maximumSlots: 10, occupiedSlots: 0 },
        invitations: [],
        profiles: [],
      },
      settingsApi,
      authApi,
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Auf diesem Gerät abmelden' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Auf allen Geräten abmelden' }),
    )

    expect(authApi.signOutCurrent).toHaveBeenCalledOnce()
    expect(authApi.signOutAll).toHaveBeenCalledOnce()
  })

  it('shows the server capacity code when a stale view allows an eleventh invite', async () => {
    const data = {
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [admin],
    }
    const settingsApi = api(data)
    vi.mocked(settingsApi.inviteUser).mockRejectedValue(
      new AccountFunctionError(
        'ACCOUNT_CAPACITY_REACHED',
        'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
      ),
    )
    renderPage(admin, data, settingsApi)

    expect(await screen.findByText('9 von 10')).toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('E-Mail-Adresse'),
      'eleventh@example.test',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Einladung senden' }),
    )

    expect(
      await screen.findByText(
        'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
      ),
    ).toBeInTheDocument()
  })

  it('does not restore a deactivated profile whose invitation was never accepted', async () => {
    const cancelled = {
      ...profile(
        '22222222-2222-2222-2222-222222222222',
        'cancelled@example.test',
        'deactivated',
      ),
      invitation_id: '55555555-5555-5555-5555-555555555555',
    }
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 1 },
      profiles: [admin, cancelled],
      invitations: [
        {
          accepted_at: null,
          auth_user_id: cancelled.id,
          created_at: '2026-07-17T00:00:00Z',
          email: cancelled.email,
          expires_at: '2026-07-24T00:00:00Z',
          id: cancelled.invitation_id,
          invited_by: admin.id,
          revoked_at: '2026-07-17T01:00:00Z',
          role: 'member',
          status: 'revoked',
          updated_at: '2026-07-17T01:00:00Z',
        },
      ],
    }
    renderPage(admin, data, api(data))
    const row = (await screen.findByText('cancelled@example.test')).closest(
      '.account-row',
    )

    expect(row).not.toBeNull()
    expect(row).not.toHaveTextContent('Wiederherstellen')
  })
})
