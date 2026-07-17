import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../auth/authContextValue'
import { AuthContext } from '../auth/authContextValue'
import type { AccountManagement, SettingsApi } from './settingsApi'
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
        <SettingsPage api={api} />
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

describe('SettingsPage', () => {
  it('denies account management to a member', () => {
    const settingsApi = api({ invitations: [], profiles: [] })
    renderPage(
      profile(
        '22222222-2222-2222-2222-222222222222',
        'member@example.test',
        'active',
      ),
      { invitations: [], profiles: [] },
      settingsApi,
    )

    expect(
      screen.getByText(
        'Diese Kontoverwaltung ist nur für Administratoren verfügbar.',
      ),
    ).toBeInTheDocument()
    expect(settingsApi.listAccounts).not.toHaveBeenCalled()
  })

  it('shows account and invitation states and disables invitations at four slots', async () => {
    const invited = profile(
      '22222222-2222-2222-2222-222222222222',
      'invite@example.test',
      'invited',
    )
    const data: AccountManagement = {
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
      await screen.findByText('4 von 4'),
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
  })

  it('requires explicit confirmation before deactivation', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data = { invitations: [], profiles: [admin, member] }
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
})
