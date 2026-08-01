import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type {
  ActiveWorkout,
  TrainingState,
  WorkoutTemplate,
} from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { TrainingHomePage } from './TrainingHomePage'

const MONDAY_TEMPLATE: WorkoutTemplate = {
  id: 'template-monday',
  name: 'Oberkörper',
  weekdays: [1],
  exercises: [],
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
}

const TUESDAY_TEMPLATE: WorkoutTemplate = {
  id: 'template-tuesday',
  name: 'Unterkörper',
  weekdays: [2],
  exercises: [],
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
}

const ACTIVE_WORKOUT: ActiveWorkout = {
  id: 'workout-active',
  templateId: 'template-existing',
  name: 'Bestehendes Training',
  startedAt: '2026-07-27T07:00:00.000Z',
  updatedAt: '2026-07-27T07:30:00.000Z',
  exercises: [],
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function trainingState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    schemaVersion: 2,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    bodyWeightEntries: [],
    analyticsPreferences: {
      range: { preset: '30d' },
      exerciseMetric: 'weight',
      muscleMetric: 'sets',
      dismissedBalanceInsightIds: [],
    },
    preferences: {
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg: 2.5,
    },
    ...overrides,
  }
}

function createRepository(
  state: TrainingState,
  overrides: Partial<TrainingRepository> = {},
): TrainingRepository {
  return {
    deleteImage: vi.fn(async () => undefined),
    exportRaw: vi.fn(async () => 'null'),
    load: vi.fn(async () => state),
    loadImage: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    saveImage: vi.fn(async () => undefined),
    ...overrides,
  }
}

function LocationMarker() {
  const location = useLocation()
  return <output aria-label="Aktueller Pfad">{location.pathname}</output>
}

function renderHome(
  state: TrainingState,
  overrides: Partial<TrainingRepository> = {},
) {
  const repository = createRepository(state, overrides)
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/training']}>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <Routes>
            <Route path="/training" element={<TrainingHomePage />} />
            <Route path="/training/active" element={<LocationMarker />} />
            <Route path="/training/library" element={<LocationMarker />} />
            <Route path="/training/history" element={<LocationMarker />} />
            <Route path="/training/templates/new" element={<LocationMarker />} />
            <Route
              path="/training/templates/:templateId/edit"
              element={<LocationMarker />}
            />
          </Routes>
        </TrainingProvider>
      </MemoryRouter>
    </ToastProvider>,
  )
  return repository
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
  vi.setSystemTime(new Date('2026-07-27T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TrainingHomePage', () => {
  it('shows active training first, then todays ISO-weekday plans, all plans, and quick links', async () => {
    renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE, TUESDAY_TEMPLATE],
      }),
    )

    await screen.findByRole('heading', { name: 'Training' })
    const continueLink = screen.getByRole('link', { name: 'Training fortsetzen' })
    const todayHeading = screen.getByRole('heading', { name: 'Heute geplant' })
    const allHeading = screen.getByRole('heading', { name: 'Trainingsvorlagen' })
    expect(
      continueLink.compareDocumentPosition(todayHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      todayHeading.compareDocumentPosition(allHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const today = screen.getByRole('region', { name: 'Heute geplant' })
    expect(within(today).getByText('Oberkörper')).toBeInTheDocument()
    expect(within(today).queryByText('Unterkörper')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Übungsbibliothek öffnen' })).toHaveAttribute(
      'href',
      '/training/library',
    )
    expect(screen.getByRole('link', { name: 'Trainingsverlauf öffnen' })).toHaveAttribute(
      'href',
      '/training/history',
    )
  })

  it('starts a template when no workout is active', async () => {
    const user = userEvent.setup()
    const repository = renderHome(trainingState({ templates: [MONDAY_TEMPLATE] }))

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0])

    await waitFor(() => {
      const saved = vi.mocked(repository.save).mock.calls.at(-1)?.[1]
      expect(saved?.activeWorkout).toMatchObject({
        name: 'Oberkörper',
        templateId: 'template-monday',
      })
    })
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
  })

  it('offers exactly the three active-workout choices and continues the existing workout', async () => {
    const user = userEvent.setup()
    renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE],
      }),
    )

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Aktives Training' })
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Fortsetzen',
      'Aktives Training abschließen',
      'Aktives Training verwerfen',
    ])

    await user.keyboard('{Escape}')
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByTestId('responsive-dialog-backdrop'))
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Fortsetzen' }))
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
  })

  it('finishes the active workout before starting the selected template', async () => {
    const user = userEvent.setup()
    const repository = renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE],
      }),
    )

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Aktives Training' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Aktives Training abschließen' }),
    )

    await waitFor(() => {
      expect(repository.save).toHaveBeenCalledTimes(1)
      const saved = vi.mocked(repository.save).mock.calls[0]?.[1]
      expect(saved?.completedWorkouts).toEqual([
        expect.objectContaining({ id: 'workout-active', name: 'Bestehendes Training' }),
      ])
      expect(saved?.activeWorkout).toMatchObject({ templateId: 'template-monday' })
    })
  })

  it('requires a second confirmation before discarding and starting the selected template', async () => {
    const user = userEvent.setup()
    const repository = renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE],
      }),
    )

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0])
    const choices = await screen.findByRole('dialog', { name: 'Aktives Training' })
    await user.click(
      within(choices).getByRole('button', { name: 'Aktives Training verwerfen' }),
    )

    const confirmation = await screen.findByRole('dialog', {
      name: 'Aktives Training wirklich verwerfen?',
    })
    expect(vi.mocked(repository.save)).not.toHaveBeenCalled()
    await user.click(
      within(confirmation).getByRole('button', { name: 'Endgültig verwerfen' }),
    )

    await waitFor(() => {
      const saves = vi.mocked(repository.save).mock.calls.map(([, state]) => state)
      expect(saves).toHaveLength(1)
      expect(saves[0].activeWorkout).toMatchObject({ templateId: 'template-monday' })
      expect(saves[0].completedWorkouts).toEqual([])
      expect(saves[0].completedWorkouts).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'workout-active' })]),
      )
    })
  })

  it('does not navigate when atomic conflict resolution cannot be persisted', async () => {
    const user = userEvent.setup()
    const repository = renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE],
      }),
      {
        save: vi.fn(async () => {
          throw new Error('local persistence unavailable')
        }),
      },
    )

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(
      screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0],
    )
    const dialog = await screen.findByRole('dialog', { name: 'Aktives Training' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Aktives Training abschließen' }),
    )

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Aktives Training' })).toBeInTheDocument()
  })

  it('waits for the atomic save and blocks duplicate conflict actions', async () => {
    const user = userEvent.setup()
    const saveGate = deferred<void>()
    const repository = renderHome(
      trainingState({
        activeWorkout: ACTIVE_WORKOUT,
        templates: [MONDAY_TEMPLATE],
      }),
      { save: vi.fn(async () => saveGate.promise) },
    )

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(
      screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0],
    )
    const dialog = await screen.findByRole('dialog', { name: 'Aktives Training' })
    const complete = within(dialog).getByRole('button', {
      name: 'Aktives Training abschließen',
    })
    await user.click(complete)

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(complete).toBeDisabled()
    await user.click(complete)

    await act(async () => saveGate.resolve())
    expect(await screen.findByLabelText('Aktueller Pfad')).toHaveTextContent(
      '/training/active',
    )
    expect(repository.save).toHaveBeenCalledTimes(1)
  })

  it('does not navigate when the profile changes during the atomic save', async () => {
    const user = userEvent.setup()
    const saveGate = deferred<void>()
    const state = trainingState({
      activeWorkout: ACTIVE_WORKOUT,
      templates: [MONDAY_TEMPLATE],
    })
    const repository = createRepository(state, {
      save: vi.fn(async (profileId) => {
        if (profileId === 'profile-a') await saveGate.promise
      }),
    })
    const tree = (profileId: string) => (
      <ToastProvider>
        <MemoryRouter initialEntries={['/training']}>
          <TrainingProvider profileId={profileId} repository={repository}>
            <Routes>
              <Route path="/training" element={<TrainingHomePage />} />
              <Route path="/training/active" element={<LocationMarker />} />
            </Routes>
          </TrainingProvider>
        </MemoryRouter>
      </ToastProvider>
    )
    const page = render(tree('profile-a'))

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(
      screen.getAllByRole('button', { name: 'Training starten: Oberkörper' })[0],
    )
    const dialog = await screen.findByRole('dialog', { name: 'Aktives Training' })
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Aktives Training abschließen',
      }),
    )
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith('profile-a', expect.any(Object)),
    )

    page.rerender(tree('profile-b'))
    await screen.findByRole('heading', { name: 'Training' })
    await act(async () => saveGate.resolve())

    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(repository.save).toHaveBeenCalledTimes(1)
  })
})
