import type {
  ActiveWorkout,
  CompletedWorkout,
  ExerciseDefinition,
  TrainingState,
  Weekday,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from './trainingTypes'

export interface CreateWorkoutTemplateInput {
  name: string
  weekdays: Weekday[]
  exercises?: WorkoutTemplateExercise[]
  timestamp: string
}

export interface AddWorkoutExerciseInput {
  exerciseId: string
  targetSets?: number
  repMin?: number
  repMax?: number
  preferredGrip?: string
}

export type TemplateExerciseChanges = Partial<
  Pick<
    WorkoutTemplateExercise,
    'targetSets' | 'repMin' | 'repMax' | 'preferredGrip'
  >
>

export type WorkoutExerciseChanges = Partial<
  Pick<
    WorkoutExerciseEntry,
    'targetSets' | 'repMin' | 'repMax' | 'grip' | 'loadMode' | 'note'
  >
>

export type WorkoutSetChanges = Partial<
  Pick<WorkoutSetEntry, 'weightKg' | 'reps' | 'rating' | 'completed'>
>

function createEmptySet(): WorkoutSetEntry {
  return {
    id: crypto.randomUUID(),
    weightKg: null,
    reps: null,
    rating: null,
    completed: false,
  }
}

function clonePrefilledSet(set: WorkoutSetEntry): WorkoutSetEntry {
  return {
    id: crypto.randomUUID(),
    weightKg: set.weightKg,
    reps: set.reps,
    rating: set.rating,
    completed: false,
  }
}

function cloneWorkoutExercises(
  exercises: readonly WorkoutExerciseEntry[],
): WorkoutExerciseEntry[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }))
}

function normalizeOrder<T extends { order: number }>(
  entries: readonly T[],
): T[] {
  return entries.map((entry, order) => ({ ...entry, order }))
}

function reorderEntry<T extends { id: string; order: number }>(
  entries: readonly T[],
  entryId: string,
  toIndex: number,
): T[] {
  const fromIndex = entries.findIndex(({ id }) => id === entryId)
  if (fromIndex === -1) {
    return normalizeOrder(entries)
  }

  const reordered = [...entries]
  const [entry] = reordered.splice(fromIndex, 1)
  const boundedIndex = Math.max(0, Math.min(toIndex, reordered.length))
  reordered.splice(boundedIndex, 0, entry)
  return normalizeOrder(reordered)
}

function requireActiveWorkout(state: TrainingState): ActiveWorkout {
  if (!state.activeWorkout) {
    throw new Error('No active workout exists')
  }
  return state.activeWorkout
}

function updateActiveExercises(
  state: TrainingState,
  updatedAt: string,
  update: (
    exercises: readonly WorkoutExerciseEntry[],
  ) => WorkoutExerciseEntry[],
): TrainingState {
  const activeWorkout = requireActiveWorkout(state)
  return {
    ...state,
    activeWorkout: {
      ...activeWorkout,
      updatedAt,
      exercises: update(activeWorkout.exercises),
    },
  }
}

function createWorkoutExerciseEntry(
  exercise: {
    exerciseId: string
    order: number
    targetSets: number
    repMin: number
    repMax: number
    preferredGrip?: string
  },
  previousEntry: WorkoutExerciseEntry | undefined,
  definition: ExerciseDefinition | undefined,
): WorkoutExerciseEntry {
  const grip = previousEntry ? previousEntry.grip : exercise.preferredGrip
  const loadMode = definition?.supportsBodyweightModes
    ? previousEntry && previousEntry.loadMode !== 'external'
      ? previousEntry.loadMode
      : 'bodyweight'
    : definition
      ? 'external'
      : (previousEntry?.loadMode ?? 'external')
  return {
    id: crypto.randomUUID(),
    exerciseId: exercise.exerciseId,
    order: exercise.order,
    targetSets: exercise.targetSets,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    ...(grip === undefined ? {} : { grip }),
    loadMode,
    note: previousEntry?.note ?? '',
    sets: previousEntry
      ? previousEntry.sets.map(clonePrefilledSet)
      : Array.from({ length: exercise.targetSets }, createEmptySet),
  }
}

export function createTemplateExercise(
  exerciseId: string,
  order: number,
): WorkoutTemplateExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    order,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
  }
}

export function createWorkoutTemplate(
  {
    name,
    weekdays,
    exercises = [],
    timestamp,
  }: CreateWorkoutTemplateInput,
): WorkoutTemplate {
  return {
    id: crypto.randomUUID(),
    name,
    weekdays: [...weekdays],
    exercises: exercises.map((exercise) => ({ ...exercise })),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function addTemplateExercise(
  template: WorkoutTemplate,
  exerciseId: string,
  updatedAt: string,
): WorkoutTemplate {
  return {
    ...template,
    updatedAt,
    exercises: [
      ...template.exercises,
      createTemplateExercise(exerciseId, template.exercises.length),
    ],
  }
}

export function updateTemplateExercise(
  template: WorkoutTemplate,
  exerciseEntryId: string,
  changes: TemplateExerciseChanges,
  updatedAt: string,
): WorkoutTemplate {
  return {
    ...template,
    updatedAt,
    exercises: template.exercises.map((exercise) =>
      exercise.id === exerciseEntryId
        ? { ...exercise, ...changes }
        : exercise,
    ),
  }
}

export function reorderTemplateExercise(
  template: WorkoutTemplate,
  exerciseEntryId: string,
  toIndex: number,
  updatedAt: string,
): WorkoutTemplate {
  return {
    ...template,
    updatedAt,
    exercises: reorderEntry(
      template.exercises,
      exerciseEntryId,
      toIndex,
    ),
  }
}

export function removeTemplateExercise(
  template: WorkoutTemplate,
  exerciseEntryId: string,
  updatedAt: string,
): WorkoutTemplate {
  return {
    ...template,
    updatedAt,
    exercises: normalizeOrder(
      template.exercises.filter(({ id }) => id !== exerciseEntryId),
    ),
  }
}

export function findLastExerciseEntry(
  completedWorkouts: readonly CompletedWorkout[],
  exerciseId: string,
): WorkoutExerciseEntry | undefined {
  return completedWorkouts
    .flatMap((workout) =>
      workout.exercises
        .filter((exercise) => exercise.exerciseId === exerciseId)
        .map((entry) => ({ completedAt: workout.completedAt, entry })),
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    )[0]
    ?.entry
}

export function startWorkout(
  state: TrainingState,
  template: WorkoutTemplate,
  startedAt: string,
  catalog: readonly ExerciseDefinition[] = [],
): TrainingState {
  if (state.activeWorkout) {
    throw new Error('An active workout already exists')
  }

  const exercises = [...template.exercises]
    .sort((left, right) => left.order - right.order)
    .map((exercise, order) =>
      createWorkoutExerciseEntry(
        { ...exercise, order },
        findLastExerciseEntry(state.completedWorkouts, exercise.exerciseId),
        catalog.find(({ id }) => id === exercise.exerciseId),
      ),
    )

  return {
    ...state,
    activeWorkout: {
      id: crypto.randomUUID(),
      templateId: template.id,
      name: template.name,
      startedAt,
      updatedAt: startedAt,
      exercises,
    },
  }
}

export function addWorkoutExercise(
  state: TrainingState,
  input: AddWorkoutExerciseInput,
  updatedAt: string,
  catalog: readonly ExerciseDefinition[] = [],
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) => [
    ...exercises,
    createWorkoutExerciseEntry(
      {
        exerciseId: input.exerciseId,
        order: exercises.length,
        targetSets: input.targetSets ?? 3,
        repMin: input.repMin ?? 8,
        repMax: input.repMax ?? 12,
        preferredGrip: input.preferredGrip,
      },
      findLastExerciseEntry(state.completedWorkouts, input.exerciseId),
      catalog.find(({ id }) => id === input.exerciseId),
    ),
  ])
}

export function updateWorkoutExercise(
  state: TrainingState,
  exerciseEntryId: string,
  changes: WorkoutExerciseChanges,
  updatedAt: string,
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) =>
    exercises.map((exercise) =>
      exercise.id === exerciseEntryId
        ? { ...exercise, ...changes }
        : exercise,
    ),
  )
}

export function reorderWorkoutExercise(
  state: TrainingState,
  exerciseEntryId: string,
  toIndex: number,
  updatedAt: string,
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) =>
    reorderEntry(exercises, exerciseEntryId, toIndex),
  )
}

export function removeWorkoutExercise(
  state: TrainingState,
  exerciseEntryId: string,
  updatedAt: string,
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) =>
    normalizeOrder(
      exercises.filter(({ id }) => id !== exerciseEntryId),
    ),
  )
}

export function addWorkoutSet(
  state: TrainingState,
  exerciseEntryId: string,
  updatedAt: string,
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) =>
    exercises.map((exercise) =>
      exercise.id === exerciseEntryId
        ? { ...exercise, sets: [...exercise.sets, createEmptySet()] }
        : exercise,
    ),
  )
}

export function updateWorkoutSet(
  state: TrainingState,
  exerciseEntryId: string,
  setId: string,
  changes: WorkoutSetChanges,
  updatedAt: string,
): TrainingState {
  const validWeight =
    changes.weightKg === undefined ||
    changes.weightKg === null ||
    (Number.isFinite(changes.weightKg) && changes.weightKg >= 0)
  const validReps =
    changes.reps === undefined ||
    changes.reps === null ||
    (Number.isInteger(changes.reps) && changes.reps >= 0)
  const validRating =
    changes.rating === undefined ||
    changes.rating === null ||
    (Number.isInteger(changes.rating) &&
      changes.rating >= 1 &&
      changes.rating <= 10)
  if (!validWeight || !validReps || !validRating) return state

  return updateActiveExercises(state, updatedAt, (exercises) =>
    exercises.map((exercise) =>
      exercise.id === exerciseEntryId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setId ? { ...set, ...changes } : set,
            ),
          }
        : exercise,
    ),
  )
}

export function removeWorkoutSet(
  state: TrainingState,
  exerciseEntryId: string,
  setId: string,
  updatedAt: string,
): TrainingState {
  return updateActiveExercises(state, updatedAt, (exercises) =>
    exercises.map((exercise) =>
      exercise.id === exerciseEntryId
        ? {
            ...exercise,
            sets: exercise.sets.filter(({ id }) => id !== setId),
          }
        : exercise,
    ),
  )
}

export function completeWorkout(
  state: TrainingState,
  completedAt: string,
): TrainingState {
  const activeWorkout = requireActiveWorkout(state)
  const completedWorkout: CompletedWorkout = {
    id: activeWorkout.id,
    ...(activeWorkout.templateId === undefined
      ? {}
      : { templateId: activeWorkout.templateId }),
    name: activeWorkout.name,
    startedAt: activeWorkout.startedAt,
    completedAt,
    exercises: cloneWorkoutExercises(activeWorkout.exercises),
  }

  return {
    ...state,
    activeWorkout: null,
    completedWorkouts: [...state.completedWorkouts, completedWorkout],
  }
}

export function replaceCompletedWorkout(
  state: TrainingState,
  workoutId: string,
  replacement: CompletedWorkout,
): TrainingState {
  return {
    ...state,
    completedWorkouts: state.completedWorkouts.map((workout) => {
      if (workout.id !== workoutId) {
        return workout
      }

      return {
        ...workout,
        ...(replacement.templateId === undefined
          ? {}
          : { templateId: replacement.templateId }),
        name: replacement.name,
        id: workout.id,
        startedAt: workout.startedAt,
        completedAt: workout.completedAt,
        exercises: cloneWorkoutExercises(replacement.exercises),
      }
    }),
  }
}

export function deleteCompletedWorkout(
  state: TrainingState,
  workoutId: string,
): TrainingState {
  return {
    ...state,
    completedWorkouts: state.completedWorkouts.filter(
      ({ id }) => id !== workoutId,
    ),
  }
}
