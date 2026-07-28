import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type {
  ActiveWorkout,
  CompletedWorkout,
  TrainingState,
  WorkoutExerciseEntry,
} from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { ActiveWorkoutPage } from './ActiveWorkoutPage'

const BENCH_ENTRY: WorkoutExerciseEntry = {
  id: 'entry-bench',
  exerciseId: 'bench-press',
  order: 0,
  targetSets: 1,
  repMin: 8,
  repMax: 12,
  loadMode: 'external',
  note: 'Schulterblätter stabil halten',
  sets: [
    {
      id: 'set-bench-1',
      weightKg: 80,
      reps: 10,
      rating: 8,
      completed: false,
    },
  ],
}

const PULLDOWN_ENTRY: WorkoutExerciseEntry = {
  id: 'entry-pulldown',
  exerciseId: 'lat-pulldown',
  order: 1,
  targetSets: 1,
  repMin: 8,
  repMax: 12,
  grip: 'Breit',
  loadMode: 'external',
  note: 'Zur oberen Brust ziehen',
  sets: [
    {
      id: 'set-pulldown-1',
      weightKg: 65,
      reps: 9,
      rating: 7,
      completed: false,
    },
  ],
}

const PULL_UP_ENTRY: WorkoutExerciseEntry = {
  id: 'entry-pull-up',
  exerciseId: 'pull-up',
  order: 0,
  targetSets: 1,
  repMin: 6,
  repMax: 10,
  loadMode: 'bodyweight',
  note: '',
  sets: [
    {
      id: 'set-pull-up-1',
      weightKg: 15,
      reps: 8,
      rating: 6,
      completed: false,
    },
  ],
}

const ACTIVE_WORKOUT: ActiveWorkout = {
  id: 'workout-active',
  templateId: 'template-upper',
  name: 'Oberkörper',
  startedAt: '2026-07-28T07:00:00.000Z',
  updatedAt: '2026-07-28T07:15:00.000Z',
  exercises: [BENCH_ENTRY, PULLDOWN_ENTRY],
}

const PREVIOUS_WORKOUT: CompletedWorkout = {
  id: 'workout-previous',
  name: 'Früheres Training',
  startedAt: '2026-07-27T07:00:00.000Z',
  completedAt: '2026-07-27T08:00:00.000Z',
  exercises: [],
}

function trainingState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: ACTIVE_WORKOUT,
    completedWorkouts: [PREVIOUS_WORKOUT],
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

interface StatefulRepository extends TrainingRepository {
  read: () => TrainingState
}

function createRepository(
  initialState = trainingState(),
  saveImplementation?: (state: TrainingState) => Promise<void>,
): StatefulRepository {
  let storedState = initialState
  return {
    deleteImage: vi.fn(async () => undefined),
    exportRaw: vi.fn(async () => 'null'),
    load: vi.fn(async () => storedState),
    loadImage: vi.fn(async () => undefined),
    read: () => storedState,
    reset: vi.fn(async () => undefined),
    save: vi.fn(async (_profileId, state) => {
      await saveImplementation?.(state)
      storedState = state
    }),
    saveImage: vi.fn(async () => undefined),
  }
}

function LocationMarker() {
  const location = useLocation()
  return <output aria-label="Aktueller Pfad">{location.pathname}</output>
}

function renderActive(repository = createRepository()) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/training/active']}>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <Routes>
            <Route path="/training/active" element={<ActiveWorkoutPage />} />
            <Route path="/training" element={<LocationMarker />} />
            <Route
              path="/training/history/:workoutId"
              element={<LocationMarker />}
            />
          </Routes>
        </TrainingProvider>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function addExercise(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }))
  const picker = await screen.findByRole('dialog', { name: 'Übung auswählen' })
  await user.click(
    within(picker).getByRole('button', { name: `Details zu ${name}` }),
  )
  const details = await screen.findByRole('dialog', { name })
  await user.click(
    within(details).getByRole('button', {
      name: 'Zum Training hinzufügen',
    }),
  )
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
  vi.setSystemTime(new Date('2026-07-28T08:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ActiveWorkoutPage', () => {
  it('continues the persisted workout after a reload with prior values prefilled', async () => {
    const repository = createRepository()
    const firstPage = renderActive(repository)

    expect(
      await screen.findByRole('heading', { name: 'Oberkörper' }),
    ).toBeInTheDocument()
    const benchCard = screen
      .getByRole('heading', { name: 'Bankdrücken' })
      .closest('.card') as HTMLElement | null
    expect(benchCard).not.toBeNull()
    expect(within(benchCard!).getByLabelText('Satz 1 Gewicht')).toHaveValue(80)
    expect(within(benchCard!).getByLabelText('Satz 1 Wiederholungen')).toHaveValue(10)
    expect(within(benchCard!).getByLabelText('Satz 1 Bewertung')).toHaveValue('8')
    expect(screen.getByLabelText('Notiz für Bankdrücken')).toHaveValue(
      'Schulterblätter stabil halten',
    )
    expect(screen.queryByRole('button', { name: /speichern/i })).not.toBeInTheDocument()

    firstPage.unmount()
    renderActive(repository)

    expect(
      await screen.findByRole('heading', { name: 'Oberkörper' }),
    ).toBeInTheDocument()
    const reloadedBenchCard = screen
      .getByRole('heading', { name: 'Bankdrücken' })
      .closest('.card') as HTMLElement | null
    expect(reloadedBenchCard).not.toBeNull()
    expect(within(reloadedBenchCard!).getByLabelText('Satz 1 Gewicht')).toHaveValue(80)
    expect(within(reloadedBenchCard!).getByLabelText('Satz 1 Wiederholungen')).toHaveValue(10)
  })

  it('autosaves every set field, the supported grip, and an explicitly cleared note', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [PULLDOWN_ENTRY],
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Latziehen zur Brust' })
    const weight = screen.getByLabelText('Satz 1 Gewicht')
    const reps = screen.getByLabelText('Satz 1 Wiederholungen')
    expect(weight).toHaveAttribute('inputmode', 'decimal')
    expect(reps).toHaveAttribute('inputmode', 'numeric')
    await user.clear(weight)
    await user.type(weight, '70.5')
    await user.clear(reps)
    await user.type(reps, '12')
    await user.selectOptions(screen.getByLabelText('Satz 1 Bewertung'), '9')
    await user.click(screen.getByLabelText('Satz 1 abgeschlossen'))
    await user.selectOptions(
      screen.getByLabelText('Griff für Latziehen zur Brust'),
      'Eng',
    )
    await user.clear(screen.getByLabelText('Notiz für Latziehen zur Brust'))

    await waitFor(() => {
      const entry = repository.read().activeWorkout?.exercises[0]
      expect(entry).toMatchObject({ grip: 'Eng', note: '' })
      expect(entry?.sets[0]).toMatchObject({
        completed: true,
        rating: 9,
        reps: 12,
        weightKg: 70.5,
      })
    })
  })

  it('hides disabled ratings without clearing their stored values', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [BENCH_ENTRY],
        },
        preferences: {
          ...trainingState().preferences,
          showSetRating: false,
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Bankdrücken' })
    expect(screen.queryByLabelText('Satz 1 Bewertung')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Satz 1 Wiederholungen'))
    await user.type(screen.getByLabelText('Satz 1 Wiederholungen'), '11')

    await waitFor(() =>
      expect(
        repository.read().activeWorkout?.exercises[0].sets[0],
      ).toMatchObject({ rating: 8, reps: 11 }),
    )
  })

  it('adds and deletes sets immediately', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [BENCH_ENTRY],
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Bankdrücken' })
    await user.click(screen.getByRole('button', { name: 'Satz hinzufügen: Bankdrücken' }))
    await waitFor(() =>
      expect(repository.read().activeWorkout?.exercises[0].sets).toHaveLength(2),
    )
    expect(screen.getByLabelText('Satz 2 Wiederholungen')).toHaveValue(null)

    await user.click(screen.getByRole('button', { name: 'Satz 1 löschen' }))
    await waitFor(() => {
      const sets = repository.read().activeWorkout?.exercises[0].sets
      expect(sets).toHaveLength(1)
      expect(sets?.[0].id).not.toBe('set-bench-1')
    })
  })

  it('switches bodyweight modes and shows only the applicable weight label', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [PULL_UP_ENTRY],
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Klimmzug' })
    const mode = screen.getByLabelText('Belastungsmodus für Klimmzug')
    expect(mode).toHaveValue('bodyweight')
    expect(screen.queryByLabelText('Satz 1 Gewicht')).not.toBeInTheDocument()

    await user.selectOptions(mode, 'added')
    const weight = screen.getByLabelText('Satz 1 Gewicht')
    expect(weight.closest('label')).toHaveTextContent('Zusatzgewicht')
    expect(weight).toHaveValue(15)
    await user.selectOptions(mode, 'assisted')
    expect(screen.getByLabelText('Satz 1 Gewicht').closest('label')).toHaveTextContent(
      'Unterstützung',
    )

    await waitFor(() =>
      expect(repository.read().activeWorkout?.exercises[0].loadMode).toBe(
        'assisted',
      ),
    )
  })

  it('adds, removes, and reorders exercises with accessible fallback buttons', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    const upButtons = screen.getAllByRole('button', { name: 'Übung nach oben' })
    const downButtons = screen.getAllByRole('button', { name: 'Übung nach unten' })
    expect(upButtons).toHaveLength(2)
    expect(downButtons).toHaveLength(2)
    await user.click(upButtons[1])
    await waitFor(() =>
      expect(
        repository.read().activeWorkout?.exercises.map(
          ({ exerciseId, order }) => [exerciseId, order],
        ),
      ).toEqual([
        ['lat-pulldown', 0],
        ['bench-press', 1],
      ]),
    )

    await user.click(
      screen.getByRole('button', { name: 'Übung entfernen: Bankdrücken' }),
    )
    await waitFor(() =>
      expect(repository.read().activeWorkout?.exercises).toHaveLength(1),
    )
    await addExercise(user, 'Klimmzug')

    await waitFor(() =>
      expect(
        repository.read().activeWorkout?.exercises.map(
          ({ exerciseId, order }) => [exerciseId, order],
        ),
      ).toEqual([
        ['lat-pulldown', 0],
        ['pull-up', 1],
      ]),
    )
  })

  it('finishes only after persistence succeeds and opens the completed workout', async () => {
    const user = userEvent.setup()
    const saveGate = deferred<void>()
    const repository = createRepository(trainingState(), async () => saveGate.promise)
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    await user.click(screen.getByRole('button', { name: 'Training abschließen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Training abschließen?' })
    const confirm = within(dialog).getByRole('button', {
      name: 'Training abschließen',
    })
    await user.click(confirm)

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(confirm).toBeDisabled()
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(repository.read().activeWorkout).toBe(ACTIVE_WORKOUT)

    await act(async () => saveGate.resolve())
    expect(await screen.findByLabelText('Aktueller Pfad')).toHaveTextContent(
      '/training/history/workout-active',
    )
    expect(repository.read().activeWorkout).toBeNull()
    expect(repository.read().completedWorkouts).toEqual([
      PREVIOUS_WORKOUT,
      expect.objectContaining({
        completedAt: '2026-07-28T08:00:00.000Z',
        id: 'workout-active',
      }),
    ])
  })

  it('keeps the active workout and finish dialog when persistence fails', async () => {
    const user = userEvent.setup()
    const repository = createRepository(trainingState(), async () => {
      throw new Error('local persistence unavailable')
    })
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    await user.click(screen.getByRole('button', { name: 'Training abschließen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Training abschließen?' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Training abschließen' }),
    )

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Training abschließen?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Oberkörper' })).toBeInTheDocument()
  })

  it('discards only the active workout after destructive confirmation and persistence', async () => {
    const user = userEvent.setup()
    const saveGate = deferred<void>()
    const repository = createRepository(trainingState(), async () => saveGate.promise)
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    await user.click(screen.getByRole('button', { name: 'Training verwerfen' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Training wirklich verwerfen?',
    })
    expect(repository.save).not.toHaveBeenCalled()
    const confirm = within(dialog).getByRole('button', {
      name: 'Endgültig verwerfen',
    })
    expect(confirm).toHaveClass('button--danger')
    await user.click(confirm)

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    await act(async () => saveGate.resolve())

    expect(await screen.findByLabelText('Aktueller Pfad')).toHaveTextContent(
      '/training',
    )
    expect(repository.read().activeWorkout).toBeNull()
    expect(repository.read().completedWorkouts).toEqual([PREVIOUS_WORKOUT])
  })

  it('does not discard or navigate when persistence fails', async () => {
    const user = userEvent.setup()
    const repository = createRepository(trainingState(), async () => {
      throw new Error('local persistence unavailable')
    })
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    await user.click(screen.getByRole('button', { name: 'Training verwerfen' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Training wirklich verwerfen?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Endgültig verwerfen' }),
    )

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Aktueller Pfad')).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Training wirklich verwerfen?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Oberkörper' })).toBeInTheDocument()
  })
})
