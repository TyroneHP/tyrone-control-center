import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
  WorkoutTemplate,
} from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { ActiveWorkoutPage } from './ActiveWorkoutPage'
import { TrainingHomePage } from './TrainingHomePage'

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

const PULLDOWN_TEMPLATE: WorkoutTemplate = {
  id: 'template-pulldown',
  name: 'Rückentraining',
  weekdays: [],
  exercises: [
    {
      id: 'template-entry-pulldown',
      exerciseId: 'lat-pulldown',
      order: 0,
      targetSets: 1,
      repMin: 8,
      repMax: 12,
      preferredGrip: 'Neutral',
    },
  ],
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
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

function renderTrainingFlow(repository: StatefulRepository) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/training']}>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <Routes>
            <Route path="/training" element={<TrainingHomePage />} />
            <Route path="/training/active" element={<ActiveWorkoutPage />} />
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

async function expectOneSemanticSave(
  repository: StatefulRepository,
  action: () => unknown | Promise<unknown>,
  assertion: (state: TrainingState) => void,
) {
  const save = vi.mocked(repository.save)
  const previousSaveCount = save.mock.calls.length
  await action()
  await waitFor(() => expect(save).toHaveBeenCalledTimes(previousSaveCount + 1))
  assertion(repository.read())
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

function installActiveSortableGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function getBoundingClientRect(this: HTMLElement) {
      const top =
        this instanceof HTMLLIElement &&
        this.textContent?.includes('Latziehen zur Brust')
          ? 100
          : 0
      return {
        bottom: top + 80,
        height: 80,
        left: 0,
        right: 320,
        toJSON: () => undefined,
        top,
        width: 320,
        x: 0,
        y: top,
      } as DOMRect
    },
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

  it('prefills the active page from completed history when the provider starts a template', async () => {
    const user = userEvent.setup()
    const historicalEntry: WorkoutExerciseEntry = {
      ...PULLDOWN_ENTRY,
      sets: [{ ...PULLDOWN_ENTRY.sets[0], completed: true }],
    }
    const repository = createRepository(
      trainingState({
        activeWorkout: null,
        completedWorkouts: [
          {
            id: 'workout-historical-pulldown',
            name: 'Historischer Rücken',
            startedAt: '2026-07-27T07:00:00.000Z',
            completedAt: '2026-07-27T08:00:00.000Z',
            exercises: [historicalEntry],
          },
        ],
        templates: [PULLDOWN_TEMPLATE],
      }),
    )
    renderTrainingFlow(repository)

    await screen.findByRole('heading', { name: 'Training' })
    await user.click(
      screen.getByRole('button', {
        name: 'Training starten: Rückentraining',
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Rückentraining' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Satz 1 Gewicht')).toHaveValue(65)
    expect(screen.getByLabelText('Satz 1 Wiederholungen')).toHaveValue(9)
    expect(screen.getByLabelText('Satz 1 Bewertung')).toHaveValue('7')
    expect(screen.getByLabelText('Griff für Latziehen zur Brust')).toHaveValue(
      'Breit',
    )
    expect(screen.getByLabelText('Notiz für Latziehen zur Brust')).toHaveValue(
      'Zur oberen Brust ziehen',
    )
    expect(repository.read().activeWorkout?.exercises[0].sets[0].id).not.toBe(
      'set-pulldown-1',
    )
  })

  it('persists note and grip across remounts and carries an explicit note clear forward', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          templateId: PULLDOWN_TEMPLATE.id,
          name: PULLDOWN_TEMPLATE.name,
          exercises: [{ ...PULLDOWN_ENTRY, order: 0 }],
        },
        templates: [PULLDOWN_TEMPLATE],
      }),
    )
    let page = renderActive(repository)

    await screen.findByRole('heading', { name: 'Rückentraining' })
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Notiz für Latziehen zur Brust'),
          { target: { value: 'Schulterblätter tief halten' } },
        ),
      (state) =>
        expect(state.activeWorkout?.exercises[0].note).toBe(
          'Schulterblätter tief halten',
        ),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Griff für Latziehen zur Brust'),
          { target: { value: 'Eng' } },
        ),
      (state) => expect(state.activeWorkout?.exercises[0].grip).toBe('Eng'),
    )

    page.unmount()
    page = renderActive(repository)
    expect(
      await screen.findByLabelText('Notiz für Latziehen zur Brust'),
    ).toHaveValue('Schulterblätter tief halten')
    expect(screen.getByLabelText('Griff für Latziehen zur Brust')).toHaveValue(
      'Eng',
    )

    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Notiz für Latziehen zur Brust'),
          { target: { value: '' } },
        ),
      (state) => expect(state.activeWorkout?.exercises[0].note).toBe(''),
    )
    page.unmount()
    page = renderActive(repository)
    expect(
      await screen.findByLabelText('Notiz für Latziehen zur Brust'),
    ).toHaveValue('')
    expect(screen.getByLabelText('Griff für Latziehen zur Brust')).toHaveValue(
      'Eng',
    )

    await user.click(screen.getByRole('button', { name: 'Training abschließen' }))
    const finishDialog = await screen.findByRole('dialog', {
      name: 'Training abschließen?',
    })
    await user.click(
      within(finishDialog).getByRole('button', {
        name: 'Training abschließen',
      }),
    )
    await screen.findByLabelText('Aktueller Pfad')
    expect(repository.read().completedWorkouts.at(-1)?.exercises[0]).toMatchObject(
      { grip: 'Eng', note: '' },
    )

    page.unmount()
    renderTrainingFlow(repository)
    await screen.findByRole('heading', { name: 'Training' })
    await user.click(
      screen.getByRole('button', {
        name: 'Training starten: Rückentraining',
      }),
    )

    expect(
      await screen.findByLabelText('Notiz für Latziehen zur Brust'),
    ).toHaveValue('')
    expect(screen.getByLabelText('Griff für Latziehen zur Brust')).toHaveValue(
      'Eng',
    )
  })

  it('writes once immediately for every semantic active-workout edit category', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [
            { ...PULLDOWN_ENTRY, order: 0 },
            { ...PULL_UP_ENTRY, order: 1 },
          ],
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Latziehen zur Brust' })
    const pulldownCard = screen
      .getByRole('heading', { name: 'Latziehen zur Brust' })
      .closest('.card') as HTMLElement
    const weight = within(pulldownCard).getByLabelText('Satz 1 Gewicht')
    const reps = within(pulldownCard).getByLabelText('Satz 1 Wiederholungen')
    expect(weight).toHaveAttribute('inputmode', 'decimal')
    expect(reps).toHaveAttribute('inputmode', 'numeric')

    await expectOneSemanticSave(
      repository,
      () => fireEvent.change(weight, { target: { value: '70.5' } }),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets[0].weightKg).toBe(70.5),
    )
    await expectOneSemanticSave(
      repository,
      () => fireEvent.change(reps, { target: { value: '12' } }),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets[0].reps).toBe(12),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          within(pulldownCard).getByLabelText('Satz 1 Bewertung'),
          { target: { value: '9' } },
        ),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets[0].rating).toBe(9),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.click(
          within(pulldownCard).getByLabelText('Satz 1 abgeschlossen'),
        ),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets[0].completed).toBe(true),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Notiz für Latziehen zur Brust'),
          { target: { value: 'Neue Notiz' } },
        ),
      (state) =>
        expect(state.activeWorkout?.exercises[0].note).toBe('Neue Notiz'),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Notiz für Latziehen zur Brust'),
          { target: { value: '' } },
        ),
      (state) => expect(state.activeWorkout?.exercises[0].note).toBe(''),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(
          screen.getByLabelText('Griff für Latziehen zur Brust'),
          { target: { value: 'Eng' } },
        ),
      (state) => expect(state.activeWorkout?.exercises[0].grip).toBe('Eng'),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        fireEvent.change(screen.getByLabelText('Belastungsmodus für Klimmzug'), {
          target: { value: 'added' },
        }),
      (state) => expect(state.activeWorkout?.exercises[1].loadMode).toBe('added'),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        user.click(
          screen.getByRole('button', {
            name: 'Satz hinzufügen: Latziehen zur Brust',
          }),
        ),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets).toHaveLength(2),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        user.click(within(pulldownCard).getByRole('button', { name: 'Satz 2 löschen' })),
      (state) =>
        expect(state.activeWorkout?.exercises[0].sets).toHaveLength(1),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        user.click(
          screen.getByRole('button', { name: 'Übung Klimmzug nach oben' }),
        ),
      (state) =>
        expect(
          state.activeWorkout?.exercises.map(({ exerciseId, order }) => [
            exerciseId,
            order,
          ]),
        ).toEqual([
          ['pull-up', 0],
          ['lat-pulldown', 1],
        ]),
    )
    await expectOneSemanticSave(
      repository,
      () =>
        user.click(
          screen.getByRole('button', { name: 'Übung entfernen: Klimmzug' }),
        ),
      (state) =>
        expect(state.activeWorkout?.exercises.map(({ exerciseId }) => exerciseId)).toEqual([
          'lat-pulldown',
        ]),
    )
    await expectOneSemanticSave(
      repository,
      () => addExercise(user, 'Klimmzug'),
      (state) =>
        expect(
          state.activeWorkout?.exercises.map(({ exerciseId, order }) => [
            exerciseId,
            order,
          ]),
        ).toEqual([
          ['lat-pulldown', 0],
          ['pull-up', 1],
        ]),
    )
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

  it('supports bodyweight, added, and assisted modes for Dips', async () => {
    const user = userEvent.setup()
    const repository = createRepository(
      trainingState({
        activeWorkout: {
          ...ACTIVE_WORKOUT,
          exercises: [
            {
              ...PULL_UP_ENTRY,
              id: 'entry-dip',
              exerciseId: 'dip',
              sets: [
                {
                  ...PULL_UP_ENTRY.sets[0],
                  id: 'set-dip-1',
                  weightKg: 20,
                },
              ],
            },
          ],
        },
      }),
    )
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Dip' })
    const mode = screen.getByLabelText('Belastungsmodus für Dip')
    expect(mode).toHaveValue('bodyweight')
    expect(screen.queryByLabelText('Satz 1 Gewicht')).not.toBeInTheDocument()

    await user.selectOptions(mode, 'added')
    expect(screen.getByLabelText('Satz 1 Gewicht').closest('label')).toHaveTextContent(
      'Zusatzgewicht',
    )
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
    expect(
      screen.getByRole('button', { name: 'Übung Bankdrücken nach oben' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Übung Latziehen zur Brust nach unten',
      }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Übung Latziehen zur Brust nach oben',
      }),
    )
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

  it('identifies each exercise in the always-present reorder button names', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    expect(
      screen.getByRole('button', { name: 'Übung Bankdrücken nach oben' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Übung Latziehen zur Brust nach unten',
      }),
    ).toBeDisabled()
    await user.click(
      screen.getByRole('button', {
        name: 'Übung Latziehen zur Brust nach oben',
      }),
    )

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
  })

  it('reorders active exercises with a real pointer drag and persists contiguous order', async () => {
    installActiveSortableGeometry()
    const repository = createRepository()
    renderActive(repository)

    await screen.findByRole('heading', { name: 'Oberkörper' })
    const handle = screen.getByRole('button', {
      name: 'Übung verschieben: Bankdrücken',
    })
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 20,
      clientY: 40,
      isPrimary: true,
      pointerId: 1,
    })
    fireEvent.pointerMove(document, {
      clientX: 20,
      clientY: 140,
      isPrimary: true,
      pointerId: 1,
    })
    fireEvent.pointerUp(document, {
      clientX: 20,
      clientY: 140,
      isPrimary: true,
      pointerId: 1,
    })

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
