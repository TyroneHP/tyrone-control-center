import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useToast } from '../../design-system'
import { EMPTY_TRAINING_STATE } from './model/trainingDefaults'
import { STANDARD_EXERCISES } from './model/exerciseCatalog'
import type {
  CompletedWorkout,
  ExerciseDefinition,
  TrainingPreferences,
  TrainingState,
  WorkoutTemplate,
} from './model/trainingTypes'
import {
  addWorkoutExercise as addWorkoutExerciseModel,
  addWorkoutSet as addWorkoutSetModel,
  completeWorkout as completeWorkoutModel,
  deleteCompletedWorkout as deleteCompletedWorkoutModel,
  removeWorkoutExercise as removeWorkoutExerciseModel,
  removeWorkoutSet as removeWorkoutSetModel,
  reorderWorkoutExercise as reorderWorkoutExerciseModel,
  replaceCompletedWorkout as replaceCompletedWorkoutModel,
  startWorkout as startWorkoutModel,
  updateWorkoutExercise as updateWorkoutExerciseModel,
  updateWorkoutSet as updateWorkoutSetModel,
  type AddWorkoutExerciseInput,
  type WorkoutExerciseChanges,
  type WorkoutSetChanges,
} from './model/workoutModel'
import { IndexedDbTrainingRepository } from './persistence/indexedDbTrainingRepository'
import type { TrainingRepository } from './persistence/trainingRepository'
import { TrainingContext } from './trainingContext'

const SAVE_ERROR_MESSAGE = 'Trainingsdaten konnten nicht gespeichert werden.'
const LOAD_ERROR_MESSAGE = 'Trainingsdaten konnten nicht geladen werden.'
const IMAGE_SAVE_ERROR_MESSAGE = 'Trainingsbild konnte nicht gespeichert werden.'
const IMAGE_LOAD_ERROR_MESSAGE = 'Trainingsbild konnte nicht geladen werden.'
const IMAGE_DELETE_ERROR_MESSAGE = 'Trainingsbild konnte nicht gelöscht werden.'
const CUSTOM_EXERCISE_SAVE_ERROR_MESSAGE =
  'Übung konnte nicht gespeichert werden.'
const CUSTOM_EXERCISE_DELETE_ERROR_MESSAGE =
  'Übung konnte nicht gelöscht werden.'
const IMAGE_MUTATION_BLOCKED_MESSAGE =
  'Trainingsbilder können erst nach erfolgreichem Laden geändert werden.'
const EXPORT_ERROR_MESSAGE = 'Trainingsdaten konnten nicht exportiert werden.'
const RESET_ERROR_MESSAGE = 'Trainingsbereich konnte nicht zurückgesetzt werden.'
let browserTrainingRepository: TrainingRepository | undefined
const repositorySaveQueues = new WeakMap<
  TrainingRepository,
  Map<string, Promise<void>>
>()
const repositoryLatestQueuedStates = new WeakMap<
  TrainingRepository,
  Map<string, TrainingState>
>()
const repositoryPendingImageCleanup = new WeakMap<
  TrainingRepository,
  Map<string, string>
>()
interface PersistedExerciseBaseline {
  exercise?: ExerciseDefinition
  favorite: boolean
  favoriteIndex?: number
  index?: number
}
const repositoryPersistedExerciseBaselines = new WeakMap<
  TrainingRepository,
  Map<string, Map<string, PersistedExerciseBaseline>>
>()

function getBrowserTrainingRepository() {
  browserTrainingRepository ??= new IndexedDbTrainingRepository()
  return browserTrainingRepository
}

function getExerciseCatalog(state: TrainingState) {
  return [...STANDARD_EXERCISES, ...state.customExercises]
}

function getRepositorySaveQueues(repository: TrainingRepository) {
  let queues = repositorySaveQueues.get(repository)
  if (!queues) {
    queues = new Map()
    repositorySaveQueues.set(repository, queues)
  }
  return queues
}

function getLatestQueuedStates(repository: TrainingRepository) {
  let states = repositoryLatestQueuedStates.get(repository)
  if (!states) {
    states = new Map()
    repositoryLatestQueuedStates.set(repository, states)
  }
  return states
}

function getPendingImageCleanup(repository: TrainingRepository) {
  let cleanup = repositoryPendingImageCleanup.get(repository)
  if (!cleanup) {
    cleanup = new Map()
    repositoryPendingImageCleanup.set(repository, cleanup)
  }
  return cleanup
}

function getPersistedExerciseBaselines(repository: TrainingRepository) {
  let baselines = repositoryPersistedExerciseBaselines.get(repository)
  if (!baselines) {
    baselines = new Map()
    repositoryPersistedExerciseBaselines.set(repository, baselines)
  }
  return baselines
}

function replaceProfileExerciseBaselines(
  baselines: Map<string, Map<string, PersistedExerciseBaseline>>,
  profileId: string,
  state: TrainingState,
) {
  baselines.set(
    profileId,
    new Map(
      state.customExercises.map((exercise, index) => [
        exercise.id,
        {
          exercise,
          favorite: state.favoriteExerciseIds.includes(exercise.id),
          favoriteIndex: state.favoriteExerciseIds.indexOf(exercise.id),
          index,
        },
      ]),
    ),
  )
}

function readExerciseBaseline(
  baselines: Map<string, Map<string, PersistedExerciseBaseline>>,
  profileId: string,
  exerciseId: string,
) {
  return (
    baselines.get(profileId)?.get(exerciseId) ?? {
      exercise: undefined,
      favorite: false,
    }
  )
}

function imageCleanupKey(profileId: string, exerciseId: string) {
  return `${profileId}\u0000${exerciseId}`
}

export interface TrainingProviderProps {
  children: ReactNode
  profileId: string
  repository?: TrainingRepository
}

interface TrainingView {
  loading: boolean
  profileId: string
  recoveryError: Error | null
  state: TrainingState
}

interface UpdateStateOptions {
  requireCurrentGenerationOnSuccess?: boolean
  rollbackOnFailure?: (
    currentState: TrainingState,
    previousState: TrainingState,
    failedState: TrainingState,
  ) => TrainingState
}

export function TrainingProvider({
  children,
  profileId,
  repository,
}: TrainingProviderProps) {
  const toast = useToast()
  const trainingRepository = repository ?? getBrowserTrainingRepository()
  const saveQueues = getRepositorySaveQueues(trainingRepository)
  const latestQueuedStates = getLatestQueuedStates(trainingRepository)
  const pendingImageCleanup = getPendingImageCleanup(trainingRepository)
  const persistedExerciseBaselines =
    getPersistedExerciseBaselines(trainingRepository)
  const [view, setView] = useState<TrainingView>(() => ({
    loading: true,
    profileId,
    recoveryError: null,
    state: EMPTY_TRAINING_STATE,
  }))
  const stateRef = useRef(view.state)
  const loadedProfileRef = useRef<string | null>(null)
  const generationRef = useRef(0)

  const operationError = useCallback(
    (
      message: string,
      cause: unknown,
      operationProfileId: string,
      operationGeneration: number,
      preserveRecoveryError = false,
    ) => {
      const error = new Error(message, { cause })
      if (generationRef.current === operationGeneration) {
        if (!preserveRecoveryError) {
          setView((current) =>
            current.profileId === operationProfileId
              ? { ...current, recoveryError: error }
              : current,
          )
        }
        toast.show({ message, variant: 'error' })
      }
      return error
    },
    [toast],
  )

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    let current = true
    loadedProfileRef.current = null
    stateRef.current = EMPTY_TRAINING_STATE

    const pendingSave = saveQueues.get(profileId) ?? Promise.resolve()
    void pendingSave
      .then(() => trainingRepository.load(profileId))
      .then((loadedState) => {
        if (!current || generationRef.current !== generation) return
        const latestQueuedState = latestQueuedStates.get(profileId)
        const visibleState = latestQueuedState ?? loadedState
        replaceProfileExerciseBaselines(
          persistedExerciseBaselines,
          profileId,
          loadedState,
        )
        loadedProfileRef.current = profileId
        stateRef.current = visibleState
        setView({
          loading: false,
          profileId,
          recoveryError: null,
          state: visibleState,
        })
      })
      .catch((cause: unknown) => {
        if (!current || generationRef.current !== generation) return
        const error =
          cause instanceof Error
            ? cause
            : new Error(LOAD_ERROR_MESSAGE, { cause })
        setView({
          loading: false,
          profileId,
          recoveryError: error,
          state: EMPTY_TRAINING_STATE,
        })
        toast.show({ message: LOAD_ERROR_MESSAGE, variant: 'error' })
      })

    return () => {
      current = false
      if (generationRef.current === generation) {
        generationRef.current = generation + 1
        loadedProfileRef.current = null
      }
    }
  }, [
    persistedExerciseBaselines,
    latestQueuedStates,
    profileId,
    saveQueues,
    toast,
    trainingRepository,
  ])

  const updateState = useCallback(
    (
      mutation: (current: TrainingState) => TrainingState,
      afterSave?: (savedState: TrainingState) => void,
      options: UpdateStateOptions = {},
    ) => {
      if (loadedProfileRef.current !== profileId) return Promise.resolve(false)

      const previousState = stateRef.current
      const nextState = mutation(previousState)
      latestQueuedStates.set(profileId, nextState)
      stateRef.current = nextState
      setView((current) => ({
        loading: false,
        profileId,
        recoveryError:
          current.profileId === profileId ? current.recoveryError : null,
        state: nextState,
      }))

      const savedProfileId = profileId
      const savedGeneration = generationRef.current
      const previousSave = saveQueues.get(savedProfileId) ?? Promise.resolve()
      const saveResult = previousSave
        .then(() => trainingRepository.save(savedProfileId, nextState))
        .then(() => {
          afterSave?.(nextState)
          replaceProfileExerciseBaselines(
            persistedExerciseBaselines,
            savedProfileId,
            nextState,
          )
          if (
            latestQueuedStates.get(savedProfileId) === nextState &&
            saveQueues.get(savedProfileId) === saveQueueTail
          ) {
            latestQueuedStates.delete(savedProfileId)
          }
          return (
            !options.requireCurrentGenerationOnSuccess ||
            (generationRef.current === savedGeneration &&
              loadedProfileRef.current === savedProfileId)
          )
        })
        .catch((cause: unknown) => {
          const isCurrentOrigin =
            generationRef.current === savedGeneration &&
            loadedProfileRef.current === savedProfileId
          const currentState =
            latestQueuedStates.get(savedProfileId) ?? nextState
          const rollbackState = options.rollbackOnFailure?.(
            currentState,
            previousState,
            nextState,
          )
          const shouldRollback =
            rollbackState !== undefined && rollbackState !== currentState
          if (shouldRollback) latestQueuedStates.set(savedProfileId, rollbackState)
          if (isCurrentOrigin) {
            const recoveryError = new Error(SAVE_ERROR_MESSAGE, { cause })
            if (shouldRollback && stateRef.current === currentState) {
              stateRef.current = rollbackState
            }
            setView((current) =>
              current.profileId === savedProfileId
                ? {
                    ...current,
                    recoveryError,
                    state:
                      shouldRollback && current.state === currentState
                        ? rollbackState
                        : current.state,
                  }
                : current,
            )
            toast.show({ message: SAVE_ERROR_MESSAGE, variant: 'error' })
          }
          if (shouldRollback && currentState !== nextState) {
            const compensationState = rollbackState
            const queuedSaves =
              saveQueues.get(savedProfileId) ?? Promise.resolve()
            if (queuedSaves !== saveQueueTail) {
              const compensation = queuedSaves
                .then(() =>
                  trainingRepository.save(savedProfileId, compensationState),
                )
                .then(() => {
                  replaceProfileExerciseBaselines(
                    persistedExerciseBaselines,
                    savedProfileId,
                    compensationState,
                  )
                  if (
                    latestQueuedStates.get(savedProfileId) ===
                      compensationState &&
                    saveQueues.get(savedProfileId) === compensationQueueTail
                  ) {
                    latestQueuedStates.delete(savedProfileId)
                  }
                })
                .catch((compensationCause: unknown) => {
                  if (
                    generationRef.current !== savedGeneration ||
                    loadedProfileRef.current !== savedProfileId
                  ) {
                    return
                  }
                  setView((current) =>
                    current.profileId === savedProfileId
                      ? {
                          ...current,
                          recoveryError: new Error(SAVE_ERROR_MESSAGE, {
                            cause: compensationCause,
                          }),
                        }
                      : current,
                  )
                  toast.show({ message: SAVE_ERROR_MESSAGE, variant: 'error' })
                })
              const compensationQueueTail = compensation.then(() => undefined)
              saveQueues.set(savedProfileId, compensationQueueTail)
            }
          }
          return false
        })
      const saveQueueTail = saveResult.then(() => undefined)
      saveQueues.set(savedProfileId, saveQueueTail)
      return saveResult
    },
    [
      latestQueuedStates,
      persistedExerciseBaselines,
      profileId,
      saveQueues,
      toast,
      trainingRepository,
    ],
  )

  const toggleFavoriteExercise = useCallback(
    (exerciseId: string) => {
      updateState((current) => ({
        ...current,
        favoriteExerciseIds: current.favoriteExerciseIds.includes(exerciseId)
          ? current.favoriteExerciseIds.filter((id) => id !== exerciseId)
          : [...current.favoriteExerciseIds, exerciseId],
      }))
    },
    [updateState],
  )

  const saveCustomExercise = useCallback(
    async (exercise: ExerciseDefinition) => {
      const operationProfileId = profileId
      const saved = await updateState((current) => ({
        ...current,
        customExercises: current.customExercises.some(
          ({ id }) => id === exercise.id,
        )
          ? current.customExercises.map((candidate) =>
              candidate.id === exercise.id ? exercise : candidate,
            )
          : [...current.customExercises, exercise],
      }))
      if (saved) return

      const baseline = readExerciseBaseline(
        persistedExerciseBaselines,
        operationProfileId,
        exercise.id,
      )
      if (
        stateRef.current.customExercises.find(({ id }) => id === exercise.id) ===
        exercise
      ) {
        await updateState((current) => {
          if (
            current.customExercises.find(({ id }) => id === exercise.id) !==
            exercise
          ) {
            return current
          }
          const withoutTarget = current.customExercises.filter(
            ({ id }) => id !== exercise.id,
          )
          const restoreIndex = Math.min(
            baseline.index ?? withoutTarget.length,
            withoutTarget.length,
          )
          return {
            ...current,
            customExercises: baseline.exercise
              ? [
                  ...withoutTarget.slice(0, restoreIndex),
                  baseline.exercise,
                  ...withoutTarget.slice(restoreIndex),
                ]
              : withoutTarget,
          }
        })
      }

      throw new Error(CUSTOM_EXERCISE_SAVE_ERROR_MESSAGE)
    },
    [persistedExerciseBaselines, profileId, updateState],
  )

  const saveImage = useCallback(
    async (imageId: string, blob: Blob) => {
      const operationProfileId = profileId
      const operationGeneration = generationRef.current
      if (loadedProfileRef.current !== operationProfileId) {
        throw new Error(IMAGE_MUTATION_BLOCKED_MESSAGE)
      }
      try {
        await trainingRepository.saveImage(operationProfileId, imageId, blob)
      } catch (cause) {
        throw operationError(
          IMAGE_SAVE_ERROR_MESSAGE,
          cause,
          operationProfileId,
          operationGeneration,
        )
      }
    },
    [operationError, profileId, trainingRepository],
  )

  const loadImage = useCallback(
    async (imageId: string) => {
      const operationProfileId = profileId
      const operationGeneration = generationRef.current
      try {
        return await trainingRepository.loadImage(operationProfileId, imageId)
      } catch (cause) {
        throw operationError(
          IMAGE_LOAD_ERROR_MESSAGE,
          cause,
          operationProfileId,
          operationGeneration,
        )
      }
    },
    [operationError, profileId, trainingRepository],
  )

  const deleteImage = useCallback(
    async (imageId: string) => {
      const operationProfileId = profileId
      const operationGeneration = generationRef.current
      if (loadedProfileRef.current !== operationProfileId) {
        throw new Error(IMAGE_MUTATION_BLOCKED_MESSAGE)
      }
      try {
        await trainingRepository.deleteImage(operationProfileId, imageId)
      } catch (cause) {
        throw operationError(
          IMAGE_DELETE_ERROR_MESSAGE,
          cause,
          operationProfileId,
          operationGeneration,
        )
      }
    },
    [operationError, profileId, trainingRepository],
  )

  const deleteCustomExercise = useCallback(
    async (exerciseId: string) => {
      if (loadedProfileRef.current !== profileId) return
      const operationProfileId = profileId
      const operationGeneration = generationRef.current
      const cleanupKey = imageCleanupKey(operationProfileId, exerciseId)
      const pendingImageId = pendingImageCleanup.get(cleanupKey)
      if (pendingImageId) {
        try {
          await trainingRepository.deleteImage(operationProfileId, pendingImageId)
          pendingImageCleanup.delete(cleanupKey)
          return
        } catch (cause) {
          throw operationError(
            IMAGE_DELETE_ERROR_MESSAGE,
            cause,
            operationProfileId,
            operationGeneration,
          )
        }
      }

      let customImageId: string | undefined
      const saved = await updateState(
        (current) => ({
          ...current,
          customExercises: current.customExercises.filter(
            ({ id }) => id !== exerciseId,
          ),
          favoriteExerciseIds: current.favoriteExerciseIds.filter(
            (id) => id !== exerciseId,
          ),
        }),
        () => {
          const baseline = readExerciseBaseline(
            persistedExerciseBaselines,
            operationProfileId,
            exerciseId,
          )
          customImageId = baseline.exercise?.customImageId
        },
      )
      if (!saved) {
        const baseline = readExerciseBaseline(
          persistedExerciseBaselines,
          operationProfileId,
          exerciseId,
        )
        const shouldRestoreExercise =
          baseline.exercise !== undefined &&
          !stateRef.current.customExercises.some(({ id }) => id === exerciseId)
        const shouldRestoreFavorite =
          baseline.favorite &&
          !stateRef.current.favoriteExerciseIds.includes(exerciseId)
        if (shouldRestoreExercise || shouldRestoreFavorite) {
          await updateState((current) => {
            const restoreExercise =
              baseline.exercise !== undefined &&
              !current.customExercises.some(({ id }) => id === exerciseId)
            const restoreFavorite =
              baseline.favorite &&
              !current.favoriteExerciseIds.includes(exerciseId)
            if (!restoreExercise && !restoreFavorite) return current

            const customExercises = restoreExercise
              ? (() => {
                  const restoreIndex = Math.min(
                    baseline.index ?? current.customExercises.length,
                    current.customExercises.length,
                  )
                  return [
                    ...current.customExercises.slice(0, restoreIndex),
                    baseline.exercise!,
                    ...current.customExercises.slice(restoreIndex),
                  ]
                })()
              : current.customExercises
            return {
              ...current,
              customExercises,
              favoriteExerciseIds: restoreFavorite
                ? (() => {
                    const restoreIndex = Math.min(
                      baseline.favoriteIndex ??
                        current.favoriteExerciseIds.length,
                      current.favoriteExerciseIds.length,
                    )
                    return [
                      ...current.favoriteExerciseIds.slice(0, restoreIndex),
                      exerciseId,
                      ...current.favoriteExerciseIds.slice(restoreIndex),
                    ]
                  })()
                : current.favoriteExerciseIds,
            }
          })
        }
        throw new Error(CUSTOM_EXERCISE_DELETE_ERROR_MESSAGE)
      }
      if (!customImageId) return

      pendingImageCleanup.set(cleanupKey, customImageId)
      try {
        await trainingRepository.deleteImage(operationProfileId, customImageId)
        pendingImageCleanup.delete(cleanupKey)
      } catch (cause) {
        throw operationError(
          IMAGE_DELETE_ERROR_MESSAGE,
          cause,
          operationProfileId,
          operationGeneration,
        )
      }
    },
    [
      operationError,
      pendingImageCleanup,
      persistedExerciseBaselines,
      profileId,
      trainingRepository,
      updateState,
    ],
  )

  const exportRaw = useCallback(async () => {
    const operationProfileId = profileId
    const operationGeneration = generationRef.current
    try {
      return await trainingRepository.exportRaw(operationProfileId)
    } catch (cause) {
      throw operationError(
        EXPORT_ERROR_MESSAGE,
        cause,
        operationProfileId,
        operationGeneration,
        true,
      )
    }
  }, [operationError, profileId, trainingRepository])

  const reset = useCallback(async () => {
    const operationProfileId = profileId
    const operationGeneration = generationRef.current
    const previousOperation =
      saveQueues.get(operationProfileId) ?? Promise.resolve()
    const resetOperation = previousOperation.then(async () => {
      await trainingRepository.reset(operationProfileId)
      return trainingRepository.load(operationProfileId)
    })
    const resetQueueTail = resetOperation.then(
      () => undefined,
      () => undefined,
    )
    saveQueues.set(operationProfileId, resetQueueTail)

    try {
      const loadedState = await resetOperation
      if (generationRef.current !== operationGeneration) return
      const hasLaterQueuedOperation =
        saveQueues.get(operationProfileId) !== resetQueueTail
      if (!hasLaterQueuedOperation) {
        latestQueuedStates.delete(operationProfileId)
      }
      const visibleState =
        latestQueuedStates.get(operationProfileId) ?? loadedState
      replaceProfileExerciseBaselines(
        persistedExerciseBaselines,
        operationProfileId,
        loadedState,
      )
      loadedProfileRef.current = operationProfileId
      stateRef.current = visibleState
      setView({
        loading: false,
        profileId: operationProfileId,
        recoveryError: null,
        state: visibleState,
      })
    } catch (cause) {
      throw operationError(
        RESET_ERROR_MESSAGE,
        cause,
        operationProfileId,
        operationGeneration,
        true,
      )
    }
  }, [
    latestQueuedStates,
    operationError,
    persistedExerciseBaselines,
    profileId,
    saveQueues,
    trainingRepository,
  ])

  const saveWorkoutTemplate = useCallback(
    (template: WorkoutTemplate) => {
      updateState((current) => ({
        ...current,
        templates: current.templates.some(({ id }) => id === template.id)
          ? current.templates.map((candidate) =>
              candidate.id === template.id ? template : candidate,
            )
          : [...current.templates, template],
      }))
    },
    [updateState],
  )

  const deleteWorkoutTemplate = useCallback(
    (templateId: string) => {
      updateState((current) => ({
        ...current,
        templates: current.templates.filter(({ id }) => id !== templateId),
      }))
    },
    [updateState],
  )

  const startWorkout = useCallback(
    (template: WorkoutTemplate, startedAt: string) => {
      updateState((current) =>
        startWorkoutModel(
          current,
          template,
          startedAt,
          getExerciseCatalog(current),
        ),
      )
    },
    [updateState],
  )

  const workoutResolutionOptions: UpdateStateOptions = useMemo(
    () => ({
      requireCurrentGenerationOnSuccess: true,
      rollbackOnFailure: (current, previous, failed) => {
        if (current === failed) return previous

        const activeWorkout =
          current.activeWorkout === failed.activeWorkout
            ? previous.activeWorkout
            : current.activeWorkout
        const failedCompletedWorkouts = failed.completedWorkouts.filter(
          (workout) => !previous.completedWorkouts.includes(workout),
        )
        const completedWorkouts = current.completedWorkouts.filter(
          (workout) => !failedCompletedWorkouts.includes(workout),
        )
        if (
          activeWorkout === current.activeWorkout &&
          completedWorkouts.length === current.completedWorkouts.length
        ) {
          return current
        }
        return { ...current, activeWorkout, completedWorkouts }
      },
    }),
    [],
  )

  const discardWorkout = useCallback(
    () =>
      updateState(
        (current) => ({ ...current, activeWorkout: null }),
        undefined,
        workoutResolutionOptions,
      ),
    [updateState, workoutResolutionOptions],
  )

  const resolveActiveWorkoutAndStart = useCallback(
    (
      template: WorkoutTemplate,
      startedAt: string,
      resolution: 'complete' | 'discard',
    ) =>
      updateState(
        (current) => {
          if (!current.activeWorkout) {
            throw new Error('No active workout exists')
          }
          const resolvedState =
            resolution === 'complete'
              ? completeWorkoutModel(
                  current,
                  startedAt,
                  getExerciseCatalog(current),
                )
              : { ...current, activeWorkout: null }
          return startWorkoutModel(
            resolvedState,
            template,
            startedAt,
            getExerciseCatalog(resolvedState),
          )
        },
        undefined,
        workoutResolutionOptions,
      ),
    [updateState, workoutResolutionOptions],
  )

  const addWorkoutExercise = useCallback(
    (input: AddWorkoutExerciseInput, updatedAt: string) => {
      updateState((current) =>
        addWorkoutExerciseModel(
          current,
          input,
          updatedAt,
          getExerciseCatalog(current),
        ),
      )
    },
    [updateState],
  )

  const updateWorkoutExercise = useCallback(
    (
      exerciseEntryId: string,
      changes: WorkoutExerciseChanges,
      updatedAt: string,
    ) => {
      updateState((current) =>
        updateWorkoutExerciseModel(
          current,
          exerciseEntryId,
          changes,
          updatedAt,
        ),
      )
    },
    [updateState],
  )

  const reorderWorkoutExercise = useCallback(
    (exerciseEntryId: string, toIndex: number, updatedAt: string) => {
      updateState((current) =>
        reorderWorkoutExerciseModel(
          current,
          exerciseEntryId,
          toIndex,
          updatedAt,
        ),
      )
    },
    [updateState],
  )

  const removeWorkoutExercise = useCallback(
    (exerciseEntryId: string, updatedAt: string) => {
      updateState((current) =>
        removeWorkoutExerciseModel(current, exerciseEntryId, updatedAt),
      )
    },
    [updateState],
  )

  const addWorkoutSet = useCallback(
    (exerciseEntryId: string, updatedAt: string) => {
      updateState((current) =>
        addWorkoutSetModel(current, exerciseEntryId, updatedAt),
      )
    },
    [updateState],
  )

  const updateWorkoutSet = useCallback(
    (
      exerciseEntryId: string,
      setId: string,
      changes: WorkoutSetChanges,
      updatedAt: string,
    ) => {
      updateState((current) =>
        updateWorkoutSetModel(
          current,
          exerciseEntryId,
          setId,
          changes,
          updatedAt,
        ),
      )
    },
    [updateState],
  )

  const removeWorkoutSet = useCallback(
    (exerciseEntryId: string, setId: string, updatedAt: string) => {
      updateState((current) =>
        removeWorkoutSetModel(current, exerciseEntryId, setId, updatedAt),
      )
    },
    [updateState],
  )

  const completeWorkout = useCallback(
    (completedAt: string) =>
      updateState(
        (current) =>
          completeWorkoutModel(
            current,
            completedAt,
            getExerciseCatalog(current),
          ),
        undefined,
        workoutResolutionOptions,
      ),
    [updateState, workoutResolutionOptions],
  )

  const replaceCompletedWorkout = useCallback(
    (workoutId: string, replacement: CompletedWorkout) => {
      updateState((current) =>
        replaceCompletedWorkoutModel(current, workoutId, replacement),
      )
    },
    [updateState],
  )

  const deleteCompletedWorkout = useCallback(
    (workoutId: string) => {
      updateState((current) =>
        deleteCompletedWorkoutModel(current, workoutId),
      )
    },
    [updateState],
  )

  const updatePreferences = useCallback(
    (changes: Partial<TrainingPreferences>) => {
      updateState((current) => ({
        ...current,
        preferences: { ...current.preferences, ...changes },
      }))
    },
    [updateState],
  )

  const visibleView =
    view.profileId === profileId
      ? view
      : {
          loading: true,
          profileId,
          recoveryError: null,
          state: EMPTY_TRAINING_STATE,
        }
  const catalog = useMemo(
    () => [...STANDARD_EXERCISES, ...visibleView.state.customExercises],
    [visibleView.state.customExercises],
  )

  return (
    <TrainingContext.Provider
      value={{
        addWorkoutExercise,
        addWorkoutSet,
        catalog,
        completeWorkout,
        deleteCompletedWorkout,
        deleteCustomExercise,
        deleteImage,
        deleteWorkoutTemplate,
        discardWorkout,
        exportRaw,
        loadImage,
        loading: visibleView.loading,
        removeWorkoutExercise,
        removeWorkoutSet,
        reorderWorkoutExercise,
        replaceCompletedWorkout,
        recoveryError: visibleView.recoveryError,
        reset,
        resolveActiveWorkoutAndStart,
        saveCustomExercise,
        saveImage,
        saveWorkoutTemplate,
        startWorkout,
        state: visibleView.state,
        toggleFavoriteExercise,
        updatePreferences,
        updateWorkoutExercise,
        updateWorkoutSet,
      }}
    >
      {children}
    </TrainingContext.Provider>
  )
}
