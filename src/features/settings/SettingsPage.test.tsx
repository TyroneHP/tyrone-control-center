import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../design-system'
import {
  DEFAULT_DEVICE_PREFERENCES,
  type DevicePreferenceStorage,
} from '../../preferences/devicePreferences'
import { DevicePreferencesProvider } from '../../preferences/DevicePreferencesProvider'
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
  storage: DevicePreferenceStorage = deviceStorage(),
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return render(
    <ToastProvider>
      <DevicePreferencesProvider storage={storage}>
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
        </QueryClientProvider>
      </DevicePreferencesProvider>
    </ToastProvider>,
  )
}

function deviceStorage(): DevicePreferenceStorage {
  return {
    read: vi.fn(() => DEFAULT_DEVICE_PREFERENCES),
    write: vi.fn(() => true),
  }
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsPage', () => {
  it('shows personal settings to a member without loading account management', () => {
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

    expect(screen.getByRole('heading', { name: 'Darstellung' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Dunkelmodus' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Mobile Navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sitzungen' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Kontoverwaltung' }),
    ).not.toBeInTheDocument()
    expect(settingsApi.listAccounts).not.toHaveBeenCalled()
  })

  it('configures unique mobile tabs and reorders their positions', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }
    const storage = deviceStorage()
    const user = userEvent.setup()

    renderPage(member, data, api(data), undefined, storage)

    expect(
      screen.getByText('Übersicht', { selector: '.mobile-tabs-preview__fixed' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Mehr', { selector: '.mobile-tabs-preview__fixed' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(3)
    expect(screen.getByLabelText('Tab 1')).toHaveValue('calendar')
    expect(screen.getByLabelText('Tab 2')).toHaveValue('tasks')
    expect(screen.getByLabelText('Tab 3')).toHaveValue('training')
    expect(
      screen.getByLabelText('Tab 2').querySelector('option[value="calendar"]'),
    ).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Tab 1'), 'files')
    expect(storage.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileTabs: ['files', 'tasks', 'training'] }),
    )
    await user.click(screen.getByRole('button', { name: 'Tab 1 nach rechts' }))
    expect(screen.getByLabelText('Tab 2')).toHaveValue('files')
    expect(screen.getByRole('button', { name: 'Tab 1 nach links' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tab 3 nach rechts' })).toBeDisabled()
  })

  it('shows the current icon and label for every configurable mobile tab', () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }

    const { container } = renderPage(member, data, api(data))
    const currentTabs = Array.from(
      container.querySelectorAll('.mobile-tab-setting__current'),
    )

    expect(currentTabs.map((tab) => tab.textContent)).toEqual([
      'Kalender',
      'Aufgaben',
      'Training',
    ])
    expect(
      currentTabs.every((tab) => tab.querySelector('svg[aria-hidden="true"]')),
    ).toBe(true)
  })

  it('saves the desktop sidebar preference on this device', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }
    const storage = deviceStorage()
    const user = userEvent.setup()
    renderPage(member, data, api(data), undefined, storage)

    await user.click(
      screen.getByRole('button', { name: 'Seitenleiste einklappen' }),
    )

    expect(storage.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ desktopSidebar: 'collapsed' }),
    )
    expect(
      screen.getByRole('button', { name: 'Seitenleiste ausklappen' }),
    ).toBeInTheDocument()
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
    await userEvent.keyboard('{Escape}')
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
    expect(
      await screen.findByRole('status', {
        name: 'Erfolg: Konto wurde deaktiviert.',
      }),
    ).toBeInTheDocument()
  })

  it('restores focus after deactivation when the opener is enabled again', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const refresh = deferred<AccountManagement>()
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts)
      .mockResolvedValueOnce(data)
      .mockReturnValueOnce(refresh.promise)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    const opener = await screen.findByRole('button', {
      name: 'Konto von member@example.test deaktivieren',
    })
    opener.focus()
    expect(opener).toHaveFocus()
    await user.click(opener)
    await user.click(
      screen.getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Konto deaktivieren' }),
      ).not.toBeInTheDocument(),
    )
    expect(opener).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Kontoverwaltung' })).toHaveFocus()
    expect(document.body).not.toHaveFocus()

    await act(async () => {
      refresh.resolve(data)
      await refresh.promise
    })

    await waitFor(() => expect(opener).toBeEnabled())
    expect(opener).toHaveFocus()
  })

  it('keeps focus on account management when deactivation removes the opener', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const refreshedData: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 1 },
      invitations: [],
      profiles: [
        admin,
        profile(member.id, member.email, 'deactivated'),
      ],
    }
    const refresh = deferred<AccountManagement>()
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts)
      .mockResolvedValueOnce(data)
      .mockReturnValueOnce(refresh.promise)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    const opener = await screen.findByRole('button', {
      name: 'Konto von member@example.test deaktivieren',
    })
    await user.click(opener)
    await user.click(
      screen.getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )
    const fallback = screen.getByRole('heading', { name: 'Kontoverwaltung' })
    await waitFor(() => expect(fallback).toHaveFocus())

    await act(async () => {
      refresh.resolve(refreshedData)
      await refresh.promise
    })

    await waitFor(() => expect(opener).not.toBeInTheDocument())
    expect(fallback).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('keeps focus on account management when the opener remains hidden', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const refresh = deferred<AccountManagement>()
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts)
      .mockResolvedValueOnce(data)
      .mockReturnValueOnce(refresh.promise)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    const opener = await screen.findByRole('button', {
      name: 'Konto von member@example.test deaktivieren',
    })
    await user.click(opener)
    await user.click(
      screen.getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )
    const fallback = screen.getByRole('heading', { name: 'Kontoverwaltung' })
    await waitFor(() => expect(fallback).toHaveFocus())
    opener.hidden = true

    await act(async () => {
      refresh.resolve(data)
      await refresh.promise
    })

    await waitFor(() => expect(opener).toBeEnabled())
    expect(opener).not.toBeVisible()
    expect(fallback).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('does not overwrite later user focus after successful deactivation', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const refresh = deferred<AccountManagement>()
    const settingsApi = api(data)
    vi.mocked(settingsApi.listAccounts)
      .mockResolvedValueOnce(data)
      .mockReturnValueOnce(refresh.promise)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await user.click(
      await screen.findByRole('button', {
        name: 'Konto von member@example.test deaktivieren',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )
    const fallback = screen.getByRole('heading', { name: 'Kontoverwaltung' })
    await waitFor(() => expect(fallback).toHaveFocus())

    const laterTarget = screen.getByRole('button', {
      name: 'Seitenleiste einklappen',
    })
    await user.click(laterTarget)
    expect(laterTarget).toHaveFocus()

    await act(async () => {
      refresh.resolve(data)
      await refresh.promise
    })

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Konto von member@example.test deaktivieren',
        }),
      ).toBeEnabled(),
    )
    expect(laterTarget).toHaveFocus()
  })

  it('keeps a deactivation server error visible inside the critical dialog', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const settingsApi = api(data)
    vi.mocked(settingsApi.manageUser).mockRejectedValue(
      new AccountFunctionError(
        'ACCOUNT_DEACTIVATION_FAILED',
        'Das Konto konnte nicht deaktiviert werden.',
      ),
    )
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await user.click(
      await screen.findByRole('button', {
        name: 'Konto von member@example.test deaktivieren',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Konto deaktivieren' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Deaktivierung bestätigen' }),
    )

    expect(
      await within(dialog).findByRole('alert'),
    ).toHaveTextContent('Das Konto konnte nicht deaktiviert werden.')
  })

  it('keeps focus in the deactivation dialog while its pending action is disabled', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      invitations: [],
      profiles: [admin, member],
    }
    const request = deferred<void>()
    const settingsApi = api(data)
    vi.mocked(settingsApi.manageUser).mockReturnValue(request.promise)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await user.click(
      await screen.findByRole('button', {
        name: 'Konto von member@example.test deaktivieren',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Konto deaktivieren' })
    const confirm = within(dialog).getByRole('button', {
      name: 'Deaktivierung bestätigen',
    })
    await user.click(confirm)

    expect(confirm).toBeDisabled()
    expect(dialog).toHaveFocus()

    await act(async () => {
      request.reject(new Error('network unavailable'))
      await expect(request.promise).rejects.toThrow('network unavailable')
    })
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(dialog).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('does not carry a failed deactivation error to another account', async () => {
    const firstMember = profile(
      '22222222-2222-2222-2222-222222222222',
      'first@example.test',
      'active',
    )
    const secondMember = profile(
      '33333333-3333-3333-3333-333333333333',
      'second@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 3 },
      invitations: [],
      profiles: [admin, firstMember, secondMember],
    }
    const settingsApi = api(data)
    vi.mocked(settingsApi.manageUser).mockRejectedValueOnce(
      new AccountFunctionError(
        'ACCOUNT_DEACTIVATION_FAILED',
        'Das erste Konto konnte nicht deaktiviert werden.',
      ),
    )
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await user.click(
      await screen.findByRole('button', {
        name: 'Konto von first@example.test deaktivieren',
      }),
    )
    const firstDialog = screen.getByRole('dialog', { name: 'Konto deaktivieren' })
    await user.click(
      within(firstDialog).getByRole('button', {
        name: 'Deaktivierung bestätigen',
      }),
    )
    expect(await within(firstDialog).findByRole('alert')).toHaveTextContent(
      'Das erste Konto konnte nicht deaktiviert werden.',
    )
    await user.click(within(firstDialog).getByRole('button', { name: 'Abbrechen' }))

    await user.click(
      screen.getByRole('button', {
        name: 'Konto von second@example.test deaktivieren',
      }),
    )
    const secondDialog = screen.getByRole('dialog', { name: 'Konto deaktivieren' })
    expect(within(secondDialog).getByText('second@example.test')).toBeInTheDocument()
    expect(within(secondDialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows success feedback after sending an invitation', async () => {
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 9 },
      invitations: [],
      profiles: [admin],
    }
    const settingsApi = api(data)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await screen.findByText('9 von 10')
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'neu@example.test')
    await user.click(screen.getByRole('button', { name: 'Einladung senden' }))

    expect(settingsApi.inviteUser).toHaveBeenCalledWith('neu@example.test')
    expect(
      await screen.findByRole('status', {
        name: 'Erfolg: Einladung wurde gesendet.',
      }),
    ).toBeInTheDocument()
  })

  it('restores an accepted account and shows success feedback', async () => {
    const restored = {
      ...profile(
        '22222222-2222-2222-2222-222222222222',
        'restore@example.test',
        'deactivated',
      ),
      invitation_id: '55555555-5555-5555-5555-555555555555',
    }
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 1 },
      profiles: [admin, restored],
      invitations: [
        {
          accepted_at: '2026-07-17T01:00:00Z',
          auth_user_id: restored.id,
          created_at: '2026-07-17T00:00:00Z',
          email: restored.email,
          expires_at: '2026-07-24T00:00:00Z',
          id: restored.invitation_id,
          invited_by: admin.id,
          revoked_at: null,
          role: 'member',
          status: 'accepted',
          updated_at: '2026-07-17T01:00:00Z',
        },
      ],
    }
    const settingsApi = api(data)
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    await user.click(await screen.findByRole('button', { name: 'Wiederherstellen' }))

    expect(settingsApi.manageUser).toHaveBeenCalledWith({
      action: 'restore',
      userId: restored.id,
    })
    expect(
      await screen.findByRole('status', {
        name: 'Erfolg: Konto wurde wiederhergestellt.',
      }),
    ).toBeInTheDocument()
  })

  it('blocks deactivation while an account restore is pending', async () => {
    const restored = {
      ...profile(
        '22222222-2222-2222-2222-222222222222',
        'restore@example.test',
        'deactivated',
      ),
      invitation_id: '55555555-5555-5555-5555-555555555555',
    }
    const activeMember = profile(
      '33333333-3333-3333-3333-333333333333',
      'active@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 2 },
      profiles: [admin, restored, activeMember],
      invitations: [
        {
          accepted_at: '2026-07-17T01:00:00Z',
          auth_user_id: restored.id,
          created_at: '2026-07-17T00:00:00Z',
          email: restored.email,
          expires_at: '2026-07-24T00:00:00Z',
          id: restored.invitation_id,
          invited_by: admin.id,
          revoked_at: null,
          role: 'member',
          status: 'accepted',
          updated_at: '2026-07-17T01:00:00Z',
        },
      ],
    }
    let resolveRestore!: () => void
    const restoreRequest = new Promise<void>((resolve) => {
      resolveRestore = resolve
    })
    const settingsApi = api(data)
    vi.mocked(settingsApi.manageUser).mockImplementation((request) =>
      request.action === 'restore' ? restoreRequest : Promise.resolve(),
    )
    const user = userEvent.setup()
    renderPage(admin, data, settingsApi)

    const restoreButton = await screen.findByRole('button', {
      name: 'Wiederherstellen',
    })
    const deactivateButton = screen.getByRole('button', {
      name: 'Konto von active@example.test deaktivieren',
    })
    await user.click(restoreButton)

    try {
      expect(deactivateButton).toBeDisabled()
      await user.click(deactivateButton)
      expect(
        screen.queryByRole('dialog', { name: 'Konto deaktivieren' }),
      ).not.toBeInTheDocument()
      expect(settingsApi.manageUser).toHaveBeenCalledTimes(1)
      expect(settingsApi.manageUser).toHaveBeenCalledWith({
        action: 'restore',
        userId: restored.id,
      })
    } finally {
      await act(async () => {
        resolveRestore()
        await restoreRequest
      })
      await waitFor(() => expect(deactivateButton).toBeEnabled())
    }
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
    const user = userEvent.setup()
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

    await user.click(
      screen.getByRole('button', { name: 'Auf diesem Gerät abmelden' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Auf allen Geräten abmelden' }),
    )

    expect(authApi.signOutCurrent).toHaveBeenCalledOnce()
    expect(authApi.signOutAll).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', {
      name: 'Auf allen Geräten abmelden',
    })
    await user.keyboard('{Escape}')
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Überall abmelden' }))
    expect(authApi.signOutAll).toHaveBeenCalledOnce()
  })

  it('keeps an all-device sign-out error visible inside the critical dialog', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }
    const authApi = sessionApi()
    vi.mocked(authApi.signOutAll).mockRejectedValue(new Error('network unavailable'))
    const user = userEvent.setup()
    renderPage(member, data, api(data), authApi)

    await user.click(
      screen.getByRole('button', { name: 'Auf allen Geräten abmelden' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Auf allen Geräten abmelden',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Überall abmelden' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    )
    expect(dialog).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('retains meaningful focus while ending all sessions and after success or cancellation', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }
    const request = deferred<void>()
    const authApi = sessionApi()
    vi.mocked(authApi.signOutAll).mockReturnValue(request.promise)
    const user = userEvent.setup()
    renderPage(member, data, api(data), authApi)

    const opener = screen.getByRole('button', { name: 'Auf allen Geräten abmelden' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', {
      name: 'Auf allen Geräten abmelden',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Überall abmelden' }))

    expect(screen.getByRole('button', { name: 'Abmeldung läuft …' })).toBeDisabled()
    expect(dialog).toHaveFocus()

    await act(async () => {
      request.resolve()
      await request.promise
    })

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
    expect(document.body).not.toHaveFocus()

    await user.click(opener)
    const reopenedDialog = screen.getByRole('dialog', {
      name: 'Auf allen Geräten abmelden',
    })
    await user.click(within(reopenedDialog).getByRole('button', { name: 'Abbrechen' }))
    expect(opener).toHaveFocus()
  })

  it('does not carry a current-device error into all-device confirmation', async () => {
    const member = profile(
      '22222222-2222-2222-2222-222222222222',
      'member@example.test',
      'active',
    )
    const data: AccountManagement = {
      capacity: { maximumSlots: 10, occupiedSlots: 0 },
      invitations: [],
      profiles: [],
    }
    const authApi = sessionApi()
    vi.mocked(authApi.signOutCurrent).mockRejectedValue(
      new Error('network unavailable'),
    )
    const user = userEvent.setup()
    renderPage(member, data, api(data), authApi)

    await user.click(
      screen.getByRole('button', { name: 'Auf diesem Gerät abmelden' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    )

    await user.click(
      screen.getByRole('button', { name: 'Auf allen Geräten abmelden' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Auf allen Geräten abmelden',
    })
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
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
