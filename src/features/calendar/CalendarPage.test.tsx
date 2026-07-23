import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../design-system'
import { AuthContext, type Profile } from '../auth/authContextValue'
import {
  calendarEventsStorageKey,
  type CalendarEvent,
  type CalendarStorage,
} from './calendarEvents'
import { CalendarPage } from './CalendarPage'

const profile: Profile = {
  cleanup_claimed_at: null,
  created_at: '2026-07-17T00:00:00Z',
  deactivated_at: null,
  deletion_scheduled_at: null,
  display_name: 'Testmitglied',
  email: 'member@example.test',
  id: 'profile-a',
  invitation_id: null,
  role: 'member',
  status: 'active',
  updated_at: '2026-07-17T00:00:00Z',
}

function memoryStorage(initialEvents: CalendarEvent[] = []): CalendarStorage {
  const values = new Map<string, string>()
  if (initialEvents.length > 0) {
    values.set(calendarEventsStorageKey(profile.id), JSON.stringify(initialEvents))
  }
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

function renderPage(storage: CalendarStorage = memoryStorage()) {
  return render(
    <ToastProvider>
      <AuthContext.Provider
        value={{
          error: null,
          profile,
          session: null,
          status: 'authenticated',
        }}
      >
        <CalendarPage
          createId={() => 'event-created'}
          storage={storage}
          today={new Date(2026, 6, 16)}
        />
      </AuthContext.Provider>
    </ToastProvider>,
  )
}

function dayButton(day: number, eventCount?: number) {
  const suffix = eventCount === undefined ? '' : `, ${eventCount} Termin`
  return screen.getByRole('button', {
    name: new RegExp(`(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), ${day}\\. Juli 2026${suffix}`),
  })
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

describe('CalendarPage', () => {
  it('navigates across a year boundary without changing today', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthContext.Provider
          value={{ error: null, profile, session: null, status: 'authenticated' }}
        >
          <CalendarPage
            storage={memoryStorage()}
            today={new Date(2026, 11, 18)}
          />
        </AuthContext.Provider>
      </ToastProvider>,
    )

    expect(
      screen.getByRole('heading', { name: 'Dezember 2026' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(
      screen.getByRole('heading', { name: 'Januar 2027' }),
    ).toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent(
      '18',
    )
  })

  it('creates an event on the selected day and renders it only in that cell', async () => {
    const user = userEvent.setup()
    renderPage()

    const july20 = dayButton(20)
    await user.click(july20)
    await user.click(screen.getByRole('button', { name: 'Termin erstellen' }))
    await user.type(screen.getByLabelText('Titel'), 'Arzt')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    const updatedJuly20 = dayButton(20, 1)
    expect(within(updatedJuly20).getByText('Arzt')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Termine am 20. Juli 2026' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Arzt' })).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Erfolg: Termin wurde erstellt.' }),
    ).toBeInTheDocument()
  })

  it('edits every event field and moves it to the new date', async () => {
    const user = userEvent.setup()
    renderPage(
      memoryStorage([{ id: 'event-1', title: 'Arzt', date: '2026-07-20' }]),
    )

    await user.click(dayButton(20, 1))
    await user.click(screen.getByRole('button', { name: 'Arzt bearbeiten' }))
    await user.clear(screen.getByLabelText('Titel'))
    await user.type(screen.getByLabelText('Titel'), 'Zahnarzt')
    await user.clear(screen.getByLabelText('Datum'))
    await user.type(screen.getByLabelText('Datum'), '2026-07-21')
    await user.type(screen.getByLabelText('Startzeit'), '10:00')
    await user.type(screen.getByLabelText('Endzeit'), '11:00')
    await user.type(screen.getByLabelText('Beschreibung'), 'Kontrolle')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    expect(within(dayButton(20)).queryByText('Zahnarzt')).not.toBeInTheDocument()
    expect(within(dayButton(21, 1)).getByText('Zahnarzt')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Termine am 21. Juli 2026' }),
    ).toBeInTheDocument()
    expect(screen.getByText('10:00–11:00')).toBeInTheDocument()
    expect(screen.getByText('Kontrolle')).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Erfolg: Termin wurde gespeichert.' }),
    ).toBeInTheDocument()
  })

  it('requires confirmation before deleting an event', async () => {
    const user = userEvent.setup()
    renderPage(
      memoryStorage([{ id: 'event-1', title: 'Arzt', date: '2026-07-20' }]),
    )

    await user.click(dayButton(20, 1))
    await user.click(screen.getByRole('button', { name: 'Arzt bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Termin löschen' }))

    const confirmation = screen.getByRole('dialog', { name: 'Termin löschen' })
    expect(within(confirmation).getByText(/Arzt/)).toBeInTheDocument()
    expect(within(confirmation).getByRole('button', { name: 'Abbrechen' }))
      .toBeInTheDocument()
    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Termin endgültig löschen',
      }),
    )

    expect(dayButton(20)).toHaveAccessibleName(/kein Termin/)
    expect(screen.queryByRole('heading', { name: 'Arzt' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Erfolg: Termin wurde gelöscht.' }),
    ).toBeInTheDocument()
  })

  it('keeps the dialog open and the calendar unchanged after a storage failure', async () => {
    const user = userEvent.setup()
    const storage: CalendarStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Storage blocked')
      },
    }
    renderPage(storage)

    await user.click(dayButton(20))
    await user.click(screen.getByRole('button', { name: 'Termin erstellen' }))
    await user.type(screen.getByLabelText('Titel'), 'Arzt')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))

    expect(
      await screen.findByRole('alert', {
        name: 'Fehler: Termine konnten nicht lokal gespeichert werden.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Termin erstellen' }))
      .toBeInTheDocument()
    expect(dayButton(20)).toHaveAccessibleName(/kein Termin/)
    expect(screen.queryByRole('heading', { name: 'Arzt' })).not.toBeInTheDocument()
  })

  it('shows a load warning only once', async () => {
    const storage: CalendarStorage = {
      getItem: () => {
        throw new DOMException('Storage blocked')
      },
      setItem: vi.fn(),
    }
    const page = renderPage(storage)

    expect(
      await screen.findByRole('status', {
        name: 'Warnung: Gespeicherte Termine konnten nicht gelesen werden.',
      }),
    ).toBeInTheDocument()
    page.rerender(
      <ToastProvider>
        <AuthContext.Provider
          value={{ error: null, profile, session: null, status: 'authenticated' }}
        >
          <CalendarPage storage={storage} today={new Date(2026, 6, 16)} />
        </AuthContext.Provider>
      </ToastProvider>,
    )

    await waitFor(() =>
      expect(
        screen.getAllByRole('status', {
          name: 'Warnung: Gespeicherte Termine konnten nicht gelesen werden.',
        }),
      ).toHaveLength(1),
    )
  })

  it('resets page-local event state when the authenticated profile changes', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage([
      { id: 'event-1', title: 'Privater Termin', date: '2026-07-20' },
    ])
    const otherProfile = { ...profile, id: 'profile-b', email: 'other@example.test' }
    const page = render(
      <ToastProvider>
        <AuthContext.Provider
          value={{ error: null, profile, session: null, status: 'authenticated' }}
        >
          <CalendarPage storage={storage} today={new Date(2026, 6, 16)} />
        </AuthContext.Provider>
      </ToastProvider>,
    )

    await user.click(dayButton(20, 1))
    await user.click(
      screen.getByRole('button', { name: 'Privater Termin bearbeiten' }),
    )
    expect(screen.getByRole('dialog', { name: 'Termin bearbeiten' }))
      .toBeInTheDocument()

    page.rerender(
      <ToastProvider>
        <AuthContext.Provider
          value={{
            error: null,
            profile: otherProfile,
            session: null,
            status: 'authenticated',
          }}
        >
          <CalendarPage storage={storage} today={new Date(2026, 6, 16)} />
        </AuthContext.Provider>
      </ToastProvider>,
    )

    expect(screen.queryByRole('dialog', { name: 'Termin bearbeiten' }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Privater Termin' }))
      .not.toBeInTheDocument()
  })
})
