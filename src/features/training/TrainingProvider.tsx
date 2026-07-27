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
const EXPORT_ERROR_MESSAGE = 'Trainingsdaten konnten nicht exportiert werden.'
const RESET_ERROR_MESSAGE = 'Trainingsbereich konnte nicht zurückgesetzt werden.'
let browserTrainingRepository: TrainingRepository | undefined
const repositorySaveQueues = new WeakMap<
  TrainingRepository,
  Map<string, Promise<void>>
>()

function getBrowserTrainingRepository() {
  browserTrainingRepository ??= new IndexedDbTrainingRepository()
  return browserTrainingRepository
}

function getRepositorySaveQueues(repository: TrainingRepository) {
  let queues = repositorySaveQueues.get(repository)
  if (!queues) {
    queues = new Map()
    repositorySaveQueues.set(repository, queues)
  }
  return queues
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

export function TrainingProvider({
  children,
  profileId,
  repository,
}: TrainingProviderProps) {
  const toast = useToast()
  const trainingRepository = repository ?? getBrowserTrainingRepository()
  const saveQueues = getRepositorySaveQueues(trainingRepository)
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
        loadedProfileRef.current = profileId
        stateRef.current = loadedState
        setView({
          loading: false,
          profileId,
          recoveryError: null,
          state: loadedState,
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
  }, [profileId, saveQueues, toast, trainingRepository])

  const updateState = useCallback(
    (mutation: (current: TrainingState) => TrainingState) => {
      if (loadedProfileRef.current !== profileId) return

      const nextState = mutation(stateRef.current)
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
      const queuedSave = previousSave
        .then(() => trainingRepository.save(savedProfileId, nextState))
        .catch((cause: unknown) => {
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
                  recoveryError: new Error(SAVE_ERROR_MESSAGE, { cause }),
                }
              : current,
          )
          toast.show({ message: SAVE_ERROR_MESSAGE, variant: 'error' })
        })
      saveQueues.set(savedProfileId, queuedSave)
    },
    [profileId, saveQueues, toast, trainingRepository],
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
    (exercise: ExerciseDefinition) => {
      updateState((current) => ({
        ...current,
        customExercises: current.customExercises.some(
          ({ id }) => id === exercise.id,
        )
          ? current.customExercises.map((candidate) =>
              candidate.id === exercise.id ? exercise : candidate,
            )
          : [...current.customExercises, exercise],
      }))
    },
    [updateState],
  )

  const saveImage = useCallback(
    async (imageId: string, blob: Blob) => {
      const operationProfileId = profileId
      const operationGeneration = generationRef.current
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
      const customImageId = stateRef.current.customExercises.find(
        ({ id }) => id === exerciseId,
      )?.customImageId
      if (customImageId) await deleteImage(customImageId)
      if (loadedProfileRef.current !== profileId) return

      updateState((current) => ({
        ...current,
        customExercises: current.customExercises.filter(
          ({ id }) => id !== exerciseId,
        ),
        favoriteExerciseIds: current.favoriteExerciseIds.filter(
          (id) => id !== exerciseId,
        ),
      }))
    },
    [deleteImage, profileId, updateState],
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
    saveQueues.set(
      operationProfileId,
      resetOperation.then(
        () => undefined,
        () => undefined,
      ),
    )

    try {
      const loadedState = await resetOperation
      if (generationRef.current !== operationGeneration) return
      loadedProfileRef.current = operationProfileId
      stateRef.current = loadedState
      setView({
        loading: false,
        profileId: operationProfileId,
        recoveryError: null,
        state: loadedState,
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
  }, [operationError, profileId, saveQueues, trainingRepository])

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
        startWorkoutModel(current, template, startedAt),
      )
    },
    [updateState],
  )

  const discardWorkout = useCallback(() => {
    updateState((current) => ({ ...current, activeWorkout: null }))
  }, [updateState])

  const addWorkoutExercise = useCallback(
    (input: AddWorkoutExerciseInput, updatedAt: string) => {
      updateState((current) =>
        addWorkoutExerciseModel(current, input, updatedAt),
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
    (completedAt: string) => {
      updateState((current) => completeWorkoutModel(current, completedAt))
    },
    [updateState],
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
