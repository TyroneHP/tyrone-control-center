import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type {
  CompletedWorkout,
  TrainingState,
  WorkoutExerciseEntry,
} from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { CompletedWorkoutPage } from './CompletedWorkoutPage'
import { WorkoutHistoryPage } from './WorkoutHistoryPage'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function workoutExercise(
  overrides: Partial<WorkoutExerciseEntry> = {},
): WorkoutExerciseEntry {
  return {
    id: 'entry-bench',
    exerciseId: 'bench-press',
    order: 0,
    targetSets: 1,
    repMin: 8,
    repMax: 12,
    grip: 'Breit',
    loadMode: 'external',
    note: 'Kontrolliert absenken',
    sets: [
      {
        id: 'set-bench',
        weightKg: 80,
        reps: 12,
        rating: 7,
        completed: true,
      },
    ],
    ...overrides,
  }
}

function completedWorkout(
  overrides: Partial<CompletedWorkout> = {},
): CompletedWorkout {
  return {
    id: 'workout-latest',
    name: 'Oberkörper schwer',
    startedAt: '2026-07-27T08:00:00.000Z',
    completedAt: '2026-07-27T09:00:00.000Z',
    exercises: [workoutExercise()],
    ...overrides,
  }
}

function progressionHistory(
  latestOverrides: Partial<CompletedWorkout> = {},
): CompletedWorkout[] {
  const assistedEntry = workoutExercise({
    id: 'entry-pull-up',
    exerciseId: 'pull-up',
    order: 1,
    grip: 'Neutral',
    loadMode: 'assisted',
    note: 'Brust zur Stange',
    repMin: 6,
    repMax: 10,
    sets: [
      {
        id: 'set-pull-up',
        weightKg: 25,
        reps: 10,
        rating: 7,
        completed: true,
      },
    ],
  })

  return [
    completedWorkout({
      id: 'workout-oldest',
      name: 'Oberkörper eins',
      startedAt: '2026-07-20T08:00:00.000Z',
      completedAt: '2026-07-20T09:00:00.000Z',
      exercises: [
        workoutExercise({ id: 'entry-bench-oldest', sets: [{ ...workoutExercise().sets[0], id: 'set-bench-oldest' }] }),
        { ...assistedEntry, id: 'entry-pull-oldest', sets: [{ ...assistedEntry.sets[0], id: 'set-pull-oldest' }] },
      ],
    }),
    completedWorkout({
      id: 'workout-middle',
      name: 'Oberkörper zwei',
      startedAt: '2026-07-24T08:00:00.000Z',
      completedAt: '2026-07-24T09:00:00.000Z',
      exercises: [
        workoutExercise({ id: 'entry-bench-middle', sets: [{ ...workoutExercise().sets[0], id: 'set-bench-middle' }] }),
        { ...assistedEntry, id: 'entry-pull-middle', sets: [{ ...assistedEntry.sets[0], id: 'set-pull-middle' }] },
      ],
    }),
    completedWorkout({
      exercises: [workoutExercise(), assistedEntry],
      ...latestOverrides,
    }),
  ]
}

function trainingState(
  completedWorkouts: CompletedWorkout[],
  overrides: Partial<TrainingState> = {},
): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts,
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

function renderTrainingPage(
  state: TrainingState,
  initialEntry = '/training/history/workout-latest',
  overrides: Partial<TrainingRepository> = {},
) {
  const repository = createRepository(state, overrides)
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <Routes>
            <Route path="/training/history" element={<WorkoutHistoryPage />} />
            <Route
              path="/training/history/:workoutId"
              element={<CompletedWorkoutPage />}
            />
            <Route path="*" element={<LocationMarker />} />
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
})

describe('WorkoutHistoryPage', () => {
  it('orders workouts by their actual completion instant across ISO offsets', async () => {
    renderTrainingPage(
      trainingState([
        completedWorkout({
          id: 'lexically-later-but-older',
          name: 'Früheres Training',
          completedAt: '2026-07-27T02:00:00+02:00',
        }),
        completedWorkout({
          id: 'lexically-earlier-but-newer',
          name: 'Späteres Training',
          completedAt: '2026-07-26T23:30:00-04:00',
        }),
      ]),
      '/training/history',
    )

    const heading = await screen.findByRole('heading', { name: 'Trainingsverlauf' })
    const later = screen.getByRole('link', { name: /Späteres Training/ })
    const earlier = screen.getByRole('link', { name: /Früheres Training/ })
    expect(heading).toBeInTheDocument()
    expect(
      later.compareDocumentPosition(earlier) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('CompletedWorkoutPage', () => {
  it('shows exercise, set, load, grip, note and fresh standard and assisted recommendations', async () => {
    renderTrainingPage(trainingState(progressionHistory()))

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    const bench = screen.getByRole('region', { name: 'Bankdrücken' })
    expect(within(bench).getByText('Belastung: Externes Gewicht')).toBeInTheDocument()
    expect(within(bench).getByText('Griff: Breit')).toBeInTheDocument()
    expect(within(bench).getByText('Notiz: Kontrolliert absenken')).toBeInTheDocument()
    expect(within(bench).getByRole('cell', { name: '80 kg' })).toBeInTheDocument()
    expect(within(bench).getByRole('cell', { name: '12' })).toBeInTheDocument()
    expect(within(bench).getByRole('cell', { name: '7' })).toBeInTheDocument()

    expect(screen.getAllByRole('heading', { name: 'Steigerung möglich' })).toHaveLength(2)
    expect(
      screen.getByText(
        'Du hast 80 kg im Zielbereich wiederholt erreicht. Vorschlag für das nächste Training: 82,5 kg.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Weniger Unterstützung ausprobieren: 22,5 kg'),
    ).toBeInTheDocument()
  })

  it('does not show a recommendation when progression is disabled', async () => {
    const history = progressionHistory()
    renderTrainingPage(
      trainingState(history, {
        preferences: {
          showSetRating: true,
          progressionEnabled: false,
          successfulWorkoutCount: 3,
          maximumAverageRating: 8,
          defaultIncrementKg: 2.5,
        },
      }),
    )

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    expect(screen.queryByRole('heading', { name: 'Steigerung möglich' })).not.toBeInTheDocument()
  })

  it('uses the load mode from the qualifying recent workouts when an older detail is open', async () => {
    const assistedWorkouts = progressionHistory().map((workout) => ({
      ...workout,
      exercises: workout.exercises.filter(
        ({ exerciseId }) => exerciseId === 'pull-up',
      ),
    }))
    const olderExternal = completedWorkout({
      id: 'workout-older-external',
      name: 'Älteres Training',
      startedAt: '2026-07-10T08:00:00.000Z',
      completedAt: '2026-07-10T09:00:00.000Z',
      exercises: [
        workoutExercise({
          id: 'entry-pull-external',
          exerciseId: 'pull-up',
          loadMode: 'external',
          repMax: 10,
          sets: [
            {
              id: 'set-pull-external',
              weightKg: 25,
              reps: 10,
              rating: 7,
              completed: true,
            },
          ],
        }),
      ],
    })
    renderTrainingPage(
      trainingState([olderExternal, ...assistedWorkouts]),
      '/training/history/workout-older-external',
    )

    await screen.findByRole('heading', { name: 'Älteres Training' })
    expect(
      screen.getByText('Weniger Unterstützung ausprobieren: 22,5 kg'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Du hast 25 kg/)).not.toBeInTheDocument()
  })

  it('edits every mutable field locally and persists an immutable replacement with stable identity timestamps', async () => {
    const user = userEvent.setup()
    const originalHistory = progressionHistory()
    const originalSnapshot = structuredClone(originalHistory)
    const repository = renderTrainingPage(trainingState(originalHistory))

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    await user.click(screen.getByRole('button', { name: 'Training bearbeiten' }))
    const benchEditor = screen.getByRole('group', {
      name: 'Bankdrücken bearbeiten',
    })
    await user.clear(screen.getByRole('textbox', { name: 'Trainingsname' }))
    await user.type(screen.getByRole('textbox', { name: 'Trainingsname' }), 'Oberkörper angepasst')

    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Zielsätze für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Zielsätze für Bankdrücken' }), '2')
    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Minimale Wiederholungen für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Minimale Wiederholungen für Bankdrücken' }), '6')
    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Maximale Wiederholungen für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Maximale Wiederholungen für Bankdrücken' }), '10')
    await user.clear(within(benchEditor).getByRole('textbox', { name: 'Griff für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('textbox', { name: 'Griff für Bankdrücken' }), 'Eng')
    const pullUpEditor = screen.getByRole('group', {
      name: 'Klimmzug bearbeiten',
    })
    await user.selectOptions(
      within(pullUpEditor).getByRole('combobox', { name: 'Belastungsmodus für Klimmzug' }),
      'added',
    )
    await user.clear(within(benchEditor).getByRole('textbox', { name: 'Notiz für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('textbox', { name: 'Notiz für Bankdrücken' }), 'Neue Notiz')
    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Gewicht' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Gewicht' }), '75.5')
    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Wiederholungen' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Wiederholungen' }), '10')
    await user.selectOptions(within(benchEditor).getByRole('combobox', { name: 'Satz 1 Bewertung' }), '8')
    await user.click(within(benchEditor).getByRole('checkbox', { name: 'Satz 1 abgeschlossen' }))
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }))

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    const savedState = vi.mocked(repository.save).mock.calls[0][1]
    const saved = savedState.completedWorkouts.find(({ id }) => id === 'workout-latest')
    expect(saved).toMatchObject({
      id: 'workout-latest',
      name: 'Oberkörper angepasst',
      startedAt: '2026-07-27T08:00:00.000Z',
      completedAt: '2026-07-27T09:00:00.000Z',
      exercises: [
        {
          id: 'entry-bench',
          targetSets: 2,
          repMin: 6,
          repMax: 10,
          grip: 'Eng',
          loadMode: 'external',
          note: 'Neue Notiz',
          sets: [
            {
              id: 'set-bench',
              weightKg: 75.5,
              reps: 10,
              rating: 8,
              completed: false,
            },
          ],
        },
        expect.objectContaining({
          id: 'entry-pull-up',
          loadMode: 'added',
        }),
      ],
    })
    expect(originalHistory).toEqual(originalSnapshot)
    expect(await screen.findByRole('heading', { name: 'Oberkörper angepasst' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Steigerung möglich' })).not.toBeInTheDocument()
  })

  it('blocks invalid numeric drafts without persisting them', async () => {
    const user = userEvent.setup()
    const repository = renderTrainingPage(trainingState(progressionHistory()))

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    await user.click(screen.getByRole('button', { name: 'Training bearbeiten' }))
    const benchEditor = screen.getByRole('group', {
      name: 'Bankdrücken bearbeiten',
    })
    const minimum = within(benchEditor).getByRole('spinbutton', {
      name: 'Minimale Wiederholungen für Bankdrücken',
    })
    const maximum = within(benchEditor).getByRole('spinbutton', {
      name: 'Maximale Wiederholungen für Bankdrücken',
    })
    await user.clear(minimum)
    await user.type(minimum, '13')
    await user.clear(maximum)
    await user.type(maximum, '12')
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bitte prüfe die markierten Trainingswerte.',
    )
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('blocks draft interaction until the completed-workout save is confirmed', async () => {
    const user = userEvent.setup()
    const saveGate = deferred<void>()
    const repository = renderTrainingPage(trainingState(progressionHistory()), undefined, {
      save: vi.fn(async () => saveGate.promise),
    })

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    await user.click(screen.getByRole('button', { name: 'Training bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))

    const benchEditor = screen.getByRole('group', {
      name: 'Bankdrücken bearbeiten',
    })
    expect(within(benchEditor).getByRole('textbox', { name: 'Notiz für Bankdrücken' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bearbeitung abbrechen' })).toBeDisabled()

    await act(async () => saveGate.resolve())
    expect(await screen.findByRole('heading', { name: 'Oberkörper schwer' })).toBeInTheDocument()
  })

  it('discards a deep edit draft on cancel', async () => {
    const user = userEvent.setup()
    const repository = renderTrainingPage(trainingState(progressionHistory()))

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    await user.click(screen.getByRole('button', { name: 'Training bearbeiten' }))
    const benchEditor = screen.getByRole('group', {
      name: 'Bankdrücken bearbeiten',
    })
    await user.clear(within(benchEditor).getByRole('textbox', { name: 'Notiz für Bankdrücken' }))
    await user.type(within(benchEditor).getByRole('textbox', { name: 'Notiz für Bankdrücken' }), 'Nicht speichern')
    await user.clear(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Gewicht' }))
    await user.type(within(benchEditor).getByRole('spinbutton', { name: 'Satz 1 Gewicht' }), '99')
    await user.click(screen.getByRole('button', { name: 'Bearbeitung abbrechen' }))

    const bench = screen.getByRole('region', { name: 'Bankdrücken' })
    expect(within(bench).getByText('Notiz: Kontrolliert absenken')).toBeInTheDocument()
    expect(within(bench).getByRole('cell', { name: '80 kg' })).toBeInTheDocument()
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('keeps the destructive dialog and workout open after deletion persistence fails', async () => {
    const user = userEvent.setup()
    const save = vi.fn(async () => {
      throw new Error('disk full')
    })
    renderTrainingPage(trainingState(progressionHistory()), undefined, { save })

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    await user.click(screen.getByRole('button', { name: 'Training löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Training wirklich löschen?' })
    expect(within(dialog).getByRole('button', { name: 'Endgültig löschen' })).toHaveClass(
      'button--danger',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Training konnte nicht gelöscht werden.',
    )
    expect(screen.getByRole('heading', { name: 'Oberkörper schwer' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Trainingsverlauf' })).not.toBeInTheDocument()
  })

  it('deletes only after confirmation and recalculates recommendations from the remaining history', async () => {
    const user = userEvent.setup()
    const repository = renderTrainingPage(trainingState(progressionHistory()))

    await screen.findByRole('heading', { name: 'Oberkörper schwer' })
    expect(screen.getAllByRole('heading', { name: 'Steigerung möglich' })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Training löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Training wirklich löschen?' })
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(repository.save).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Training löschen' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Training wirklich löschen?' })).getByRole(
        'button',
        { name: 'Endgültig löschen' },
      ),
    )

    expect(await screen.findByRole('heading', { name: 'Trainingsverlauf' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Oberkörper schwer/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Oberkörper zwei/ }))
    expect(await screen.findByRole('heading', { name: 'Oberkörper zwei' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Steigerung möglich' })).not.toBeInTheDocument()

    const savedState = vi.mocked(repository.save).mock.calls[0][1]
    expect(savedState.completedWorkouts.map(({ id }) => id)).toEqual([
      'workout-oldest',
      'workout-middle',
    ])
  })
})
