import { act, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../design-system'
import type {
  ExerciseDefinition,
  TrainingState,
  WorkoutTemplate,
} from './model/trainingTypes'
import type { TrainingRepository } from './persistence/trainingRepository'
import { TrainingDataCorruptionError } from './persistence/trainingMigrations'
import { TrainingProvider } from './TrainingProvider'
import {
  useTraining,
  type TrainingContextValue,
} from './useTraining'

const CUSTOM_EXERCISE: ExerciseDefinition = {
  id: 'custom:row',
  source: 'custom',
  name: 'Kurzhantelrudern Spezial',
  primaryMuscles: ['Latissimus'],
  secondaryMuscles: ['Bizeps'],
  equipment: ['Kurzhantel'],
  unit: 'kg-reps',
  description: 'Einarmig zur Hüfte ziehen.',
  gripOptions: ['Neutralgriff'],
  supportsBodyweightModes: false,
}

const CUSTOM_EXERCISE_WITH_IMAGE: ExerciseDefinition = {
  ...CUSTOM_EXERCISE,
  id: 'custom:photo-row',
  name: 'Rudern mit eigenem Bild',
  customImageId: 'image-row',
}

const WORKOUT_TEMPLATE: WorkoutTemplate = {
  id: 'template-upper',
  name: 'Oberkörper',
  weekdays: [1, 4],
  exercises: [
    {
      id: 'template-exercise-bench',
      exerciseId: 'bench-press',
      order: 0,
      targetSets: 1,
      repMin: 8,
      repMax: 12,
    },
  ],
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
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

function trainingState(
  overrides: Partial<TrainingState> = {},
): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
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
  overrides: Partial<TrainingRepository> = {},
): TrainingRepository {
  return {
    load: vi.fn(async () => trainingState()),
    save: vi.fn(async () => undefined),
    saveImage: vi.fn(async () => undefined),
    loadImage: vi.fn(async () => undefined),
    deleteImage: vi.fn(async () => undefined),
    exportRaw: vi.fn(async () => 'null'),
    reset: vi.fn(async () => undefined),
    ...overrides,
  }
}

function TrainingProbe({
  capture,
}: {
  capture?: (value: TrainingContextValue) => void
}) {
  const training = useTraining()

  useEffect(() => capture?.(training), [capture, training])

  return (
    <section aria-label="Trainingsstatus">
      <p>{training.loading ? 'Trainingsdaten werden geladen' : 'Trainingsdaten bereit'}</p>
      <p>Favoriten: {training.state.favoriteExerciseIds.join(', ') || 'keine'}</p>
      <p>Katalog: {training.catalog.map(({ name }) => name).join(', ')}</p>
      <p>Aktiv: {training.state.activeWorkout?.name ?? 'keines'}</p>
      <p>Fehler: {training.recoveryError?.message ?? 'keiner'}</p>
    </section>
  )
}

function TrainingTree({
  capture,
  profileId,
  repository,
}: {
  capture?: (value: TrainingContextValue) => void
  profileId: string
  repository: TrainingRepository
}) {
  return (
    <ToastProvider>
      <TrainingProvider profileId={profileId} repository={repository}>
        <TrainingProbe capture={capture} />
      </TrainingProvider>
    </ToastProvider>
  )
}

function KeyedTrainingTree({
  capture,
  profileId,
  repository,
}: {
  capture?: (value: TrainingContextValue) => void
  profileId: string
  repository: TrainingRepository
}) {
  return (
    <ToastProvider>
      <TrainingProvider
        key={profileId}
        profileId={profileId}
        repository={repository}
      >
        <TrainingProbe capture={capture} />
      </TrainingProvider>
    </ToastProvider>
  )
}

function renderTraining(
  repository: TrainingRepository,
  profileId = 'profile-a',
  capture?: (value: TrainingContextValue) => void,
) {
  return render(
    <TrainingTree
      capture={capture}
      profileId={profileId}
      repository={repository}
    />,
  )
}

describe('TrainingProvider', () => {
  it('loads the current profile without saving the initial snapshot', async () => {
    const loadedState = trainingState({
      customExercises: [CUSTOM_EXERCISE],
      favoriteExerciseIds: ['bench-press'],
    })
    const load = vi.fn(async (profileId: string) => {
      if (profileId !== 'profile-a') return trainingState()
      return loadedState
    })
    const save = vi.fn(async () => undefined)
    const repository = createRepository({ load, save })

    renderTraining(repository)

    expect(screen.getByText('Trainingsdaten werden geladen')).toBeInTheDocument()
    expect(await screen.findByText('Trainingsdaten bereit')).toBeInTheDocument()
    expect(screen.getByText('Favoriten: bench-press')).toBeInTheDocument()
    expect(screen.getByText(/Katalog: .*Bankdrücken/)).toBeInTheDocument()
    expect(screen.getByText(/Kurzhantelrudern Spezial/)).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith('profile-a')
    await waitFor(() => expect(save).not.toHaveBeenCalled())
  })

  it('autosaves each immutable mutation from the latest in-memory snapshot', async () => {
    const savedStates: TrainingState[] = []
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
      }),
    })
    let training: TrainingContextValue | undefined

    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() => {
      training?.toggleFavoriteExercise('bench-press')
      training?.updatePreferences({ showSetRating: false })
    })

    expect(await screen.findByText('Favoriten: bench-press')).toBeInTheDocument()
    await waitFor(() => expect(savedStates).toHaveLength(2))
    expect(savedStates[0]).toMatchObject({
      favoriteExerciseIds: ['bench-press'],
      preferences: { showSetRating: true },
    })
    expect(savedStates[1]).toMatchObject({
      favoriteExerciseIds: ['bench-press'],
      preferences: { showSetRating: false },
    })
    expect(savedStates[0]).not.toBe(savedStates[1])
  })

  it('waits for an older save before writing its newer snapshot', async () => {
    const firstSave = deferred<void>()
    const secondSave = deferred<void>()
    const startedSnapshots: TrainingState[] = []
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        startedSnapshots.push(state)
        return startedSnapshots.length === 1
          ? firstSave.promise
          : secondSave.promise
      }),
    })
    let training: TrainingContextValue | undefined

    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() => {
      training?.toggleFavoriteExercise('bench-press')
      training?.updatePreferences({ defaultIncrementKg: 5 })
    })

    await waitFor(() => expect(startedSnapshots).toHaveLength(1))
    expect(startedSnapshots[0]).toMatchObject({
      favoriteExerciseIds: ['bench-press'],
      preferences: { defaultIncrementKg: 2.5 },
    })

    await act(async () => firstSave.resolve())
    await waitFor(() => expect(startedSnapshots).toHaveLength(2))
    expect(startedSnapshots[1]).toMatchObject({
      favoriteExerciseIds: ['bench-press'],
      preferences: { defaultIncrementKg: 5 },
    })
    await act(async () => secondSave.resolve())
  })

  it('uses the domain rule to reject a second active workout', async () => {
    const savedStates: TrainingState[] = []
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
      }),
    })
    let training: TrainingContextValue | undefined
    let secondStartError: unknown

    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() => {
      training?.startWorkout(WORKOUT_TEMPLATE, '2026-07-27T06:00:00.000Z')
      try {
        training?.startWorkout(WORKOUT_TEMPLATE, '2026-07-27T07:00:00.000Z')
      } catch (error) {
        secondStartError = error
      }
    })

    expect(await screen.findByText('Aktiv: Oberkörper')).toBeInTheDocument()
    expect(secondStartError).toEqual(
      expect.objectContaining({ message: 'An active workout already exists' }),
    )
    await waitFor(() => expect(savedStates).toHaveLength(1))
    expect(savedStates[0].activeWorkout).toMatchObject({
      name: 'Oberkörper',
      startedAt: '2026-07-27T06:00:00.000Z',
    })
  })

  it('keeps a failed mutation in memory and surfaces a German persistence error', async () => {
    const repository = createRepository({
      save: vi.fn(async () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }),
    })
    let training: TrainingContextValue | undefined

    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() => training?.toggleFavoriteExercise('bench-press'))

    expect(await screen.findByText('Favoriten: bench-press')).toBeInTheDocument()
    expect(
      await screen.findByRole('alert', {
        name: 'Fehler: Trainingsdaten konnten nicht gespeichert werden.',
      }),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Trainingsstatus' }),
      ).getByText('Fehler: Trainingsdaten konnten nicht gespeichert werden.'),
    ).toBeInTheDocument()
  })

  it('waits for pending profile saves before reloading that profile', async () => {
    const firstProfileSave = deferred<void>()
    const storedStates = new Map<string, TrainingState>()
    let saveStarted = false
    let training: TrainingContextValue | undefined
    const repository = createRepository({
      load: vi.fn(async (profileId) =>
        storedStates.get(profileId) ?? trainingState(),
      ),
      save: vi.fn(async (profileId, state) => {
        if (profileId === 'profile-a' && !saveStarted) {
          saveStarted = true
          await firstProfileSave.promise
        }
        storedStates.set(profileId, state)
      }),
    })
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = render(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-a"
        repository={repository}
      />,
    )
    await screen.findByText('Trainingsdaten bereit')

    act(() => training?.toggleFavoriteExercise('bench-press'))
    await waitFor(() => expect(saveStarted).toBe(true))

    page.rerender(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    await waitFor(() =>
      expect(repository.load).toHaveBeenCalledWith('profile-b'),
    )
    await screen.findByText('Trainingsdaten bereit')

    page.rerender(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-a"
        repository={repository}
      />,
    )
    await act(async () => Promise.resolve())
    expect(screen.getByText('Trainingsdaten werden geladen')).toBeInTheDocument()
    expect(screen.queryByText('Trainingsdaten bereit')).not.toBeInTheDocument()

    await act(async () => firstProfileSave.resolve())
    expect(await screen.findByText('Favoriten: bench-press')).toBeInTheDocument()
  })

  it('surfaces a corrupt load and blocks mutations from overwriting it', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const save = vi.fn(async () => undefined)
    const repository = createRepository({
      load: vi.fn(async () => {
        throw corruption
      }),
      save,
    })
    let training: TrainingContextValue | undefined

    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })

    expect(
      await screen.findByRole('alert', {
        name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
      }),
    ).toBeInTheDocument()
    expect(training?.loading).toBe(false)
    expect(training?.recoveryError).toBe(corruption)

    act(() => training?.toggleFavoriteExercise('bench-press'))

    expect(screen.getByText('Favoriten: keine')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('rejects image mutations until the current profile has loaded successfully', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const saveImage = vi.fn(async () => undefined)
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () => {
        throw corruption
      }),
      saveImage,
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByRole('alert', {
      name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
    })

    const image = new Blob(['processed image'], { type: 'image/webp' })
    const saveResult = await training!
      .saveImage('image-row', image)
      .catch((error: unknown) => error)
    const deleteResult = await training!
      .deleteImage('image-row')
      .catch((error: unknown) => error)

    expect(saveResult).toEqual(
      expect.objectContaining({
        message:
          'Trainingsbilder können erst nach erfolgreichem Laden geändert werden.',
      }),
    )
    expect(deleteResult).toEqual(
      expect.objectContaining({
        message:
          'Trainingsbilder können erst nach erfolgreichem Laden geändert werden.',
      }),
    )
    expect(saveImage).not.toHaveBeenCalled()
    expect(deleteImage).not.toHaveBeenCalled()
    expect(training?.recoveryError).toBe(corruption)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('resets immediately on profile switch and ignores the previous late load', async () => {
    const firstLoad = deferred<TrainingState>()
    const secondLoad = deferred<TrainingState>()
    const repository = createRepository({
      load: vi.fn((profileId) =>
        profileId === 'profile-a' ? firstLoad.promise : secondLoad.promise,
      ),
    })
    const page = renderTraining(repository, 'profile-a')

    page.rerender(
      <TrainingTree profileId="profile-b" repository={repository} />,
    )
    expect(screen.getByText('Favoriten: keine')).toBeInTheDocument()
    expect(screen.getByText('Trainingsdaten werden geladen')).toBeInTheDocument()

    await act(async () =>
      secondLoad.resolve(trainingState({ favoriteExerciseIds: ['squat'] })),
    )
    expect(await screen.findByText('Favoriten: squat')).toBeInTheDocument()

    await act(async () =>
      firstLoad.resolve(
        trainingState({
          customExercises: [CUSTOM_EXERCISE],
          favoriteExerciseIds: ['bench-press'],
        }),
      ),
    )
    expect(screen.getByText('Favoriten: squat')).toBeInTheDocument()
    expect(screen.queryByText(/Kurzhantelrudern Spezial/)).not.toBeInTheDocument()
  })

  it('does not let a late profile save failure affect the next profile', async () => {
    const firstSave = deferred<void>()
    const startedProfiles: string[] = []
    let training: TrainingContextValue | undefined
    const repository = createRepository({
      save: vi.fn(async (profileId) => {
        startedProfiles.push(profileId)
        if (profileId === 'profile-a') await firstSave.promise
      }),
    })
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = renderTraining(repository, 'profile-a', capture)
    await screen.findByText('Trainingsdaten bereit')
    act(() => training?.toggleFavoriteExercise('bench-press'))
    await waitFor(() => expect(startedProfiles).toEqual(['profile-a']))

    page.rerender(
      <TrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    await waitFor(() =>
      expect(repository.load).toHaveBeenCalledWith('profile-b'),
    )
    await screen.findByText('Trainingsdaten bereit')
    act(() => training?.toggleFavoriteExercise('squat'))
    await waitFor(() =>
      expect(startedProfiles).toEqual(['profile-a', 'profile-b']),
    )

    await act(async () => firstSave.reject(new Error('profile A disk error')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Fehler: keiner')).toBeInTheDocument()
    expect(screen.getByText('Favoriten: squat')).toBeInTheDocument()
  })

  it('ignores a save failure from a keyed provider that has unmounted', async () => {
    const firstSave = deferred<void>()
    let training: TrainingContextValue | undefined
    const repository = createRepository({
      save: vi.fn(async (profileId) => {
        if (profileId === 'profile-a') await firstSave.promise
      }),
    })
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = render(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-a"
        repository={repository}
      />,
    )
    await screen.findByText('Trainingsdaten bereit')
    act(() => training?.toggleFavoriteExercise('bench-press'))
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(
        'profile-a',
        expect.objectContaining({ favoriteExerciseIds: ['bench-press'] }),
      ),
    )

    page.rerender(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    await screen.findByText('Trainingsdaten bereit')
    await act(async () => firstSave.reject(new Error('profile A disk error')))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Fehler: keiner')).toBeInTheDocument()
  })

  it('restores an autosaved active workout after the provider remounts', async () => {
    const storedStates = new Map<string, TrainingState>()
    const save = vi.fn(async (profileId: string, state: TrainingState) => {
      storedStates.set(profileId, state)
    })
    const repository = createRepository({
      load: vi.fn(async (profileId) =>
        storedStates.get(profileId) ?? trainingState(),
      ),
      save,
    })
    let training: TrainingContextValue | undefined
    const firstPage = renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() =>
      training?.startWorkout(WORKOUT_TEMPLATE, '2026-07-27T06:00:00.000Z'),
    )
    await waitFor(() =>
      expect(storedStates.get('profile-a')?.activeWorkout?.name).toBe(
        'Oberkörper',
      ),
    )
    firstPage.unmount()

    renderTraining(repository, 'profile-a')

    expect(await screen.findByText('Aktiv: Oberkörper')).toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('autosaves active-workout edits and completion through the domain model', async () => {
    const savedStates: TrainingState[] = []
    let training: TrainingContextValue | undefined
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
      }),
    })
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() =>
      training?.startWorkout(WORKOUT_TEMPLATE, '2026-07-27T06:00:00.000Z'),
    )
    await screen.findByText('Aktiv: Oberkörper')
    const exercise = training?.state.activeWorkout?.exercises[0]
    const set = exercise?.sets[0]
    expect(exercise).toBeDefined()
    expect(set).toBeDefined()

    act(() =>
      training?.updateWorkoutSet(
        exercise!.id,
        set!.id,
        { completed: true, reps: 10, weightKg: 80 },
        '2026-07-27T06:05:00.000Z',
      ),
    )
    await waitFor(() =>
      expect(training?.state.activeWorkout?.exercises[0].sets[0]).toMatchObject({
        completed: true,
        reps: 10,
        weightKg: 80,
      }),
    )

    act(() => training?.completeWorkout('2026-07-27T07:00:00.000Z'))

    await waitFor(() => expect(training?.state.activeWorkout).toBeNull())
    expect(training?.state.completedWorkouts).toHaveLength(1)
    expect(
      training?.state.completedWorkouts[0].exercises[0].sets[0],
    ).toMatchObject({ completed: true, reps: 10, weightKg: 80 })
    await waitFor(() => expect(savedStates).toHaveLength(3))
  })

  it('binds image save, load, and delete operations to the current profile', async () => {
    const image = new Blob(['processed image'], { type: 'image/webp' })
    const saveImage = vi.fn(async () => undefined)
    const loadImage = vi.fn(async () => image)
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({ deleteImage, loadImage, saveImage })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let loadedImage: Blob | undefined
    await act(async () => {
      await training!.saveImage('image-row', image)
      loadedImage = await training!.loadImage('image-row')
      await training!.deleteImage('image-row')
    })

    expect(loadedImage).toBe(image)
    expect(saveImage).toHaveBeenCalledWith('profile-a', 'image-row', image)
    expect(loadImage).toHaveBeenCalledWith('profile-a', 'image-row')
    expect(deleteImage).toHaveBeenCalledWith('profile-a', 'image-row')
  })

  it.each([
    {
      configure: (repository: TrainingRepository, failure: Error) =>
        vi.mocked(repository.saveImage).mockRejectedValueOnce(failure),
      invoke: (training: TrainingContextValue) =>
        training.saveImage(
          'image-row',
          new Blob(['processed image'], { type: 'image/webp' }),
        ),
      message: 'Trainingsbild konnte nicht gespeichert werden.',
      operation: 'saving',
    },
    {
      configure: (repository: TrainingRepository, failure: Error) =>
        vi.mocked(repository.loadImage).mockRejectedValueOnce(failure),
      invoke: (training: TrainingContextValue) =>
        training.loadImage('image-row'),
      message: 'Trainingsbild konnte nicht geladen werden.',
      operation: 'loading',
    },
    {
      configure: (repository: TrainingRepository, failure: Error) =>
        vi.mocked(repository.deleteImage).mockRejectedValueOnce(failure),
      invoke: (training: TrainingContextValue) =>
        training.deleteImage('image-row'),
      message: 'Trainingsbild konnte nicht gelöscht werden.',
      operation: 'deleting',
    },
  ])(
    'propagates a German error when $operation an image fails',
    async ({ configure, invoke, message }) => {
      const failure = new Error('image storage unavailable')
      const repository = createRepository()
      configure(repository, failure)
      let training: TrainingContextValue | undefined
      renderTraining(repository, 'profile-a', (value) => {
        training = value
      })
      await screen.findByText('Trainingsdaten bereit')

      let caught: unknown
      await act(async () => {
        caught = await invoke(training!).catch((error: unknown) => error)
      })

      expect(caught).toEqual(expect.objectContaining({ message, cause: failure }))
      expect(training?.recoveryError).toEqual(
        expect.objectContaining({ message, cause: failure }),
      )
      expect(
        screen.getByRole('alert', { name: `Fehler: ${message}` }),
      ).toBeInTheDocument()
    },
  )

  it('does not surface a late image failure after switching profiles', async () => {
    const imageSave = deferred<void>()
    const saveImage = vi.fn(async () => imageSave.promise)
    const repository = createRepository({ saveImage })
    let training: TrainingContextValue | undefined
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = renderTraining(repository, 'profile-a', capture)
    await screen.findByText('Trainingsdaten bereit')
    const result = training!
      .saveImage(
        'image-row',
        new Blob(['processed image'], { type: 'image/webp' }),
      )
      .catch((error: unknown) => error)

    page.rerender(
      <TrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    await waitFor(() =>
      expect(repository.load).toHaveBeenCalledWith('profile-b'),
    )
    await screen.findByText('Trainingsdaten bereit')

    const failure = new Error('profile A image failure')
    await act(async () => imageSave.reject(failure))

    expect(await result).toEqual(
      expect.objectContaining({
        message: 'Trainingsbild konnte nicht gespeichert werden.',
        cause: failure,
      }),
    )
    expect(saveImage).toHaveBeenCalledWith(
      'profile-a',
      'image-row',
      expect.any(Blob),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Fehler: keiner')).toBeInTheDocument()
  })

  it('persists custom exercise removal before delayed image cleanup survives a profile switch', async () => {
    const imageDeletion = deferred<void>()
    const operations: string[] = []
    const profileAState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    const profileBState = trainingState({ favoriteExerciseIds: ['squat'] })
    const storedStates = new Map<string, TrainingState>([
      ['profile-a', profileAState],
      ['profile-b', profileBState],
    ])
    const repository = createRepository({
      load: vi.fn(async (profileId) => storedStates.get(profileId)!),
      deleteImage: vi.fn(async (profileId, imageId) => {
        operations.push(`delete:${profileId}:${imageId}`)
        await imageDeletion.promise
      }),
      save: vi.fn(async (profileId, state) => {
        operations.push(`save:${profileId}`)
        storedStates.set(profileId, state)
      }),
    })
    let training: TrainingContextValue | undefined
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = render(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-a"
        repository={repository}
      />,
    )
    await screen.findByText('Trainingsdaten bereit')

    const deletion = training!.deleteCustomExercise(
      CUSTOM_EXERCISE_WITH_IMAGE.id,
    )
    await waitFor(() =>
      expect(repository.deleteImage).toHaveBeenCalledWith(
        'profile-a',
        'image-row',
      ),
    )

    page.rerender(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    expect(await screen.findByText('Favoriten: squat')).toBeInTheDocument()

    await act(async () => imageDeletion.resolve())
    await act(async () => deletion)

    expect(operations).toEqual([
      'save:profile-a',
      'delete:profile-a:image-row',
    ])
    expect(storedStates.get('profile-a')?.customExercises).toEqual([])
    expect(storedStates.get('profile-a')?.favoriteExerciseIds).toEqual([])
    expect(storedStates.get('profile-b')).toBe(profileBState)
    expect(repository.save).not.toHaveBeenCalledWith(
      'profile-b',
      expect.anything(),
    )
    expect(screen.getByText('Favoriten: squat')).toBeInTheDocument()
    expect(screen.queryByText(/Rudern mit eigenem Bild/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Fehler: keiner')).toBeInTheDocument()
  })

  it('awaits custom metadata and rebases a failed save without losing a concurrent preference update', async () => {
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let saveCount = 0
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let settled = false
    const customSave = Promise.resolve(
      training!.saveCustomExercise(CUSTOM_EXERCISE),
    ).then(
      () => 'resolved' as const,
      (error: unknown) => error,
    ).finally(() => {
      settled = true
    })
    act(() => training!.updatePreferences({ showSetRating: false }))
    await waitFor(() => expect(savedStates).toHaveLength(1))
    await act(async () => Promise.resolve())
    const wasPendingWithMetadata = !settled

    await act(async () => firstSave.reject(new Error('metadata unavailable')))
    const result = await customSave
    await waitFor(() => expect(savedStates).toHaveLength(3))

    expect(wasPendingWithMetadata).toBe(true)
    expect(result).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
    )
    expect(training!.state.customExercises).toEqual([])
    expect(training!.state.preferences.showSetRating).toBe(false)
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [],
      preferences: { showSetRating: false },
    })
  })

  it('rolls back only a failed custom save while preserving an unrelated exercise added concurrently', async () => {
    const otherExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:press',
      name: 'Eigene Brustpresse',
      primaryMuscles: ['Brust'],
    }
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let saveCount = 0
    const repository = createRepository({
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let failedSave!: Promise<unknown>
    let otherSave!: Promise<void>
    act(() => {
      failedSave = training!
        .saveCustomExercise(CUSTOM_EXERCISE)
        .catch((error: unknown) => error)
      otherSave = training!.saveCustomExercise(otherExercise)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    let result: unknown
    await act(async () => {
      firstSave.reject(new Error('metadata unavailable'))
      result = await failedSave
      await otherSave
    })
    await waitFor(() => expect(savedStates).toHaveLength(3))

    expect(result).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
    )
    expect(training!.state.customExercises).toEqual([otherExercise])
    expect(savedStates.at(-1)?.customExercises).toEqual([otherExercise])
  })

  it('does not roll back over a newer save of the same custom exercise', async () => {
    const failedExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      name: 'Fehlgeschlagene Bearbeitung',
    }
    const newerExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      description: 'Diese spätere Bearbeitung muss erhalten bleiben.',
      name: 'Neuere Bearbeitung',
    }
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE],
    })
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let saveCount = 0
    const repository = createRepository({
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let failedSave!: Promise<unknown>
    let newerSave!: Promise<void>
    act(() => {
      failedSave = training!
        .saveCustomExercise(failedExercise)
        .catch((error: unknown) => error)
      newerSave = training!.saveCustomExercise(newerExercise)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    await act(async () => {
      firstSave.reject(new Error('metadata unavailable'))
      await failedSave
      await newerSave
    })

    expect(training!.state.customExercises).toEqual([newerExercise])
    expect(savedStates.at(-1)?.customExercises).toEqual([newerExercise])
  })

  it('rolls two failed same-exercise saves back to the genuinely persisted exercise', async () => {
    const otherExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:press',
      name: 'Eigene Brustpresse',
      primaryMuscles: ['Brust'],
    }
    const firstFailedExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      description: 'Erste nicht persistierte Bearbeitung.',
      name: 'Erste fehlgeschlagene Bearbeitung',
    }
    const secondFailedExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      description: 'Zweite nicht persistierte Bearbeitung.',
      name: 'Zweite fehlgeschlagene Bearbeitung',
    }
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE.id, otherExercise.id],
    })
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let storedState = initialState
    let saveCount = 0
    const repository = createRepository({
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
        if (saveCount === 2) throw new Error('second metadata save unavailable')
        storedState = state
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let firstResult!: Promise<unknown>
    let secondResult!: Promise<unknown>
    act(() => {
      firstResult = training!
        .saveCustomExercise(firstFailedExercise)
        .catch((error: unknown) => error)
      secondResult = training!
        .saveCustomExercise(secondFailedExercise)
        .catch((error: unknown) => error)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    let results: unknown[] = []
    await act(async () => {
      firstSave.reject(new Error('first metadata save unavailable'))
      results = await Promise.all([firstResult, secondResult])
    })

    expect(results).toEqual([
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
    ])
    expect(training!.state.customExercises).toEqual([
      CUSTOM_EXERCISE,
      otherExercise,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE.id,
      otherExercise.id,
    ])
    expect(storedState).toMatchObject({
      customExercises: [CUSTOM_EXERCISE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE.id, otherExercise.id],
    })
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [CUSTOM_EXERCISE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE.id, otherExercise.id],
    })
  })

  it('retries only the captured image cleanup after custom metadata deletion succeeded', async () => {
    const cleanupFailure = new Error('image cleanup unavailable')
    const storedStates: TrainingState[] = []
    const deleteImage = vi
      .fn<TrainingRepository['deleteImage']>()
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () =>
        trainingState({
          customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
          favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
        }),
      ),
      save: vi.fn(async (_profileId, state) => {
        storedStates.push(state)
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let firstResult: unknown
    await act(async () => {
      firstResult = await training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
    })

    expect(firstResult).toEqual(
      expect.objectContaining({
        message: 'Trainingsbild konnte nicht gelöscht werden.',
      }),
    )
    expect(training!.state.customExercises).toEqual([])
    expect(training!.state.favoriteExerciseIds).toEqual([])

    await act(async () => {
      await training!.deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
    })

    expect(repository.save).toHaveBeenCalledTimes(1)
    expect(deleteImage).toHaveBeenNthCalledWith(1, 'profile-a', 'image-row')
    expect(deleteImage).toHaveBeenNthCalledWith(2, 'profile-a', 'image-row')
    expect(storedStates.at(-1)?.customExercises).toEqual([])
  })

  it('restores the latest persisted favorite after a successful toggle then failed delete', async () => {
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [],
    })
    const savedStates: TrainingState[] = []
    let storedState = initialState
    let saveCount = 0
    const save = vi.fn(async (_profileId: string, state: TrainingState) => {
      savedStates.push(state)
      saveCount += 1
      if (saveCount === 2) throw new Error('metadata delete unavailable')
      storedState = state
    })
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () => initialState),
      save,
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    act(() => {
      training!.toggleFavoriteExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
    })
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
      expect(storedState.favoriteExerciseIds).toEqual([
        CUSTOM_EXERCISE_WITH_IMAGE.id,
      ])
    })

    let result: unknown
    await act(async () => {
      result = await training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
    })

    expect(result).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gelöscht werden.' }),
    )
    expect(training!.state.customExercises).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE.id,
    ])
    expect(storedState).toMatchObject({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    expect(deleteImage).not.toHaveBeenCalled()
  })

  it('restores a failed edit at its persisted index after an earlier exercise was deleted', async () => {
    const remainingExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:press',
      name: 'Persistierte Brustpresse',
      primaryMuscles: ['Brust'],
    }
    const trailingExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:curl',
      name: 'Persistierter Curl',
      primaryMuscles: ['Bizeps'],
    }
    const failedEdit: ExerciseDefinition = {
      ...remainingExercise,
      description: 'Diese Bearbeitung wurde nicht persistiert.',
      name: 'Nicht persistierte Brustpresse',
    }
    const initialState = trainingState({
      customExercises: [
        CUSTOM_EXERCISE,
        remainingExercise,
        trailingExercise,
      ],
      favoriteExerciseIds: [remainingExercise.id, trailingExercise.id],
    })
    const savedStates: TrainingState[] = []
    let storedState = initialState
    let saveCount = 0
    const repository = createRepository({
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 2) throw new Error('metadata edit unavailable')
        storedState = state
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    await act(async () => {
      await training!.deleteCustomExercise(CUSTOM_EXERCISE.id)
    })
    expect(storedState.customExercises).toEqual([
      remainingExercise,
      trailingExercise,
    ])

    let result: unknown
    await act(async () => {
      result = await training!
        .saveCustomExercise(failedEdit)
        .catch((error: unknown) => error)
    })

    expect(result).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
    )
    expect(training!.state.customExercises).toEqual([
      remainingExercise,
      trailingExercise,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      remainingExercise.id,
      trailingExercise.id,
    ])
    expect(storedState).toMatchObject({
      customExercises: [remainingExercise, trailingExercise],
      favoriteExerciseIds: [remainingExercise.id, trailingExercise.id],
    })
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [remainingExercise, trailingExercise],
      favoriteExerciseIds: [remainingExercise.id, trailingExercise.id],
    })
  })

  it('restores custom metadata after a failed delete save and retries the whole deletion', async () => {
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    let storedState = initialState
    const saveFailure = new Error('metadata delete unavailable')
    const save = vi
      .fn<TrainingRepository['save']>()
      .mockRejectedValueOnce(saveFailure)
      .mockImplementation(async (_profileId, state) => {
        storedState = state
      })
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () => initialState),
      save,
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let firstResult: unknown
    await act(async () => {
      firstResult = await training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
    })

    expect(firstResult).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gelöscht werden.' }),
    )
    expect(training!.state.customExercises).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE.id,
    ])
    expect(storedState.customExercises).toEqual([CUSTOM_EXERCISE_WITH_IMAGE])
    expect(deleteImage).not.toHaveBeenCalled()

    await act(async () => {
      await training!.deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
    })

    expect(save).toHaveBeenCalledTimes(3)
    expect(storedState.customExercises).toEqual([])
    expect(storedState.favoriteExerciseIds).toEqual([])
    expect(deleteImage).toHaveBeenCalledWith('profile-a', 'image-row')
  })

  it('restores only a failed delete target while preserving an unrelated exercise edit', async () => {
    const otherExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:press',
      name: 'Eigene Brustpresse',
      primaryMuscles: ['Brust'],
    }
    const editedOtherExercise: ExerciseDefinition = {
      ...otherExercise,
      description: 'Mit kontrolliertem Tempo drücken.',
      name: 'Eigene Brustpresse aktualisiert',
    }
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let saveCount = 0
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let failedDelete!: Promise<unknown>
    let otherSave!: Promise<void>
    act(() => {
      failedDelete = training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
      otherSave = training!.saveCustomExercise(editedOtherExercise)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    let result: unknown
    await act(async () => {
      firstSave.reject(new Error('metadata unavailable'))
      result = await failedDelete
      await otherSave
    })
    await waitFor(() => expect(savedStates).toHaveLength(3))

    expect(result).toEqual(
      expect.objectContaining({ message: 'Übung konnte nicht gelöscht werden.' }),
    )
    expect(training!.state.customExercises).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE,
      editedOtherExercise,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE.id,
    ])
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE, editedOtherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    expect(deleteImage).not.toHaveBeenCalled()
  })

  it('does not restore deleted metadata over a newer save of the same exercise', async () => {
    const newerExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE_WITH_IMAGE,
      customImageId: 'image-row-newer',
      description: 'Diese spätere Bearbeitung muss erhalten bleiben.',
      name: 'Neuere Bearbeitung mit Bild',
    }
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let saveCount = 0
    const repository = createRepository({
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let failedDelete!: Promise<unknown>
    let newerSave!: Promise<void>
    act(() => {
      failedDelete = training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
      newerSave = training!.saveCustomExercise(newerExercise)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    await act(async () => {
      firstSave.reject(new Error('metadata unavailable'))
      await failedDelete
      await newerSave
    })

    expect(training!.state.customExercises).toEqual([newerExercise])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE.id,
    ])
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [newerExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id],
    })
  })

  it('restores the persisted exercise and favorite after delete and save both fail', async () => {
    const otherExercise: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      id: 'custom:press',
      name: 'Eigene Brustpresse',
      primaryMuscles: ['Brust'],
    }
    const failedReplacement: ExerciseDefinition = {
      ...CUSTOM_EXERCISE_WITH_IMAGE,
      customImageId: 'image-row-stale',
      description: 'Diese Bearbeitung wurde nicht persistiert.',
      name: 'Nicht persistierte Bildbearbeitung',
    }
    const initialState = trainingState({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id, otherExercise.id],
    })
    const firstSave = deferred<void>()
    const savedStates: TrainingState[] = []
    let storedState = initialState
    let saveCount = 0
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository({
      deleteImage,
      load: vi.fn(async () => initialState),
      save: vi.fn(async (_profileId, state) => {
        savedStates.push(state)
        saveCount += 1
        if (saveCount === 1) await firstSave.promise
        if (saveCount === 2) throw new Error('replacement save unavailable')
        storedState = state
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByText('Trainingsdaten bereit')

    let deleteResult!: Promise<unknown>
    let saveResult!: Promise<unknown>
    act(() => {
      deleteResult = training!
        .deleteCustomExercise(CUSTOM_EXERCISE_WITH_IMAGE.id)
        .catch((error: unknown) => error)
      saveResult = training!
        .saveCustomExercise(failedReplacement)
        .catch((error: unknown) => error)
    })
    await waitFor(() => expect(savedStates).toHaveLength(1))

    let results: unknown[] = []
    await act(async () => {
      firstSave.reject(new Error('delete save unavailable'))
      results = await Promise.all([deleteResult, saveResult])
    })

    expect(results).toEqual([
      expect.objectContaining({ message: 'Übung konnte nicht gelöscht werden.' }),
      expect.objectContaining({ message: 'Übung konnte nicht gespeichert werden.' }),
    ])
    expect(training!.state.customExercises).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE,
      otherExercise,
    ])
    expect(training!.state.favoriteExerciseIds).toEqual([
      CUSTOM_EXERCISE_WITH_IMAGE.id,
      otherExercise.id,
    ])
    expect(storedState).toMatchObject({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id, otherExercise.id],
    })
    expect(savedStates.at(-1)).toMatchObject({
      customExercises: [CUSTOM_EXERCISE_WITH_IMAGE, otherExercise],
      favoriteExerciseIds: [CUSTOM_EXERCISE_WITH_IMAGE.id, otherExercise.id],
    })
    expect(deleteImage).not.toHaveBeenCalled()
  })

  it('exports untouched raw data for the current profile during recovery', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const raw = '{"schemaVersion":1,"broken":"untouched"}'
    const exportRaw = vi.fn(async () => raw)
    const repository = createRepository({
      exportRaw,
      load: vi.fn(async () => {
        throw corruption
      }),
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByRole('alert', {
      name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
    })

    await expect(training!.exportRaw()).resolves.toBe(raw)
    expect(exportRaw).toHaveBeenCalledWith('profile-a')
    expect(training?.recoveryError).toBe(corruption)
  })

  it('resets and reloads the current profile before clearing recovery state', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const load = vi
      .fn<TrainingRepository['load']>()
      .mockRejectedValueOnce(corruption)
      .mockResolvedValueOnce(trainingState())
    const reset = vi.fn(async () => undefined)
    const repository = createRepository({ load, reset })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByRole('alert', {
      name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
    })

    await act(async () => training!.reset())

    expect(reset).toHaveBeenCalledWith('profile-a')
    expect(load).toHaveBeenNthCalledWith(2, 'profile-a')
    expect(training?.loading).toBe(false)
    expect(training?.recoveryError).toBeNull()
    expect(training?.state).toEqual(trainingState())
  })

  it('preserves recovery state and propagates a German reset failure', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const failure = new Error('reset transaction failed')
    const reset = vi.fn(async () => {
      throw failure
    })
    const repository = createRepository({
      load: vi.fn(async () => {
        throw corruption
      }),
      reset,
    })
    let training: TrainingContextValue | undefined
    renderTraining(repository, 'profile-a', (value) => {
      training = value
    })
    await screen.findByRole('alert', {
      name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
    })

    let caught: unknown
    await act(async () => {
      caught = await training!.reset().catch((error: unknown) => error)
    })

    expect(caught).toEqual(
      expect.objectContaining({
        message: 'Trainingsbereich konnte nicht zurückgesetzt werden.',
        cause: failure,
      }),
    )
    expect(reset).toHaveBeenCalledWith('profile-a')
    expect(training?.recoveryError).toBe(corruption)
    expect(
      screen.getByRole('alert', {
        name: 'Fehler: Trainingsbereich konnte nicht zurückgesetzt werden.',
      }),
    ).toBeInTheDocument()
  })

  it('ignores a late reset failure after a keyed provider unmounts', async () => {
    const corruption = new TrainingDataCorruptionError(
      'Die gespeicherten Trainingsdaten sind beschädigt.',
    )
    const resetOperation = deferred<void>()
    const repository = createRepository({
      load: vi.fn(async (profileId) => {
        if (profileId === 'profile-a') throw corruption
        return trainingState()
      }),
      reset: vi.fn(async () => resetOperation.promise),
    })
    let training: TrainingContextValue | undefined
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const page = render(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-a"
        repository={repository}
      />,
    )
    await screen.findByRole('alert', {
      name: 'Fehler: Trainingsdaten konnten nicht geladen werden.',
    })
    const result = training!.reset().catch((error: unknown) => error)

    page.rerender(
      <KeyedTrainingTree
        capture={capture}
        profileId="profile-b"
        repository={repository}
      />,
    )
    await screen.findByText('Trainingsdaten bereit')
    const failure = new Error('profile A reset failure')
    await act(async () => resetOperation.reject(failure))

    expect(await result).toEqual(
      expect.objectContaining({
        message: 'Trainingsbereich konnte nicht zurückgesetzt werden.',
        cause: failure,
      }),
    )
    expect(
      screen.queryByRole('alert', {
        name: 'Fehler: Trainingsbereich konnte nicht zurückgesetzt werden.',
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Fehler: keiner')).toBeInTheDocument()
  })
})
