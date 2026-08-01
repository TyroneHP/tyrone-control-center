import {
  createExerciseSnapshot,
  createMissingExerciseSnapshot,
  STANDARD_EXERCISES,
} from '../model/exerciseCatalog'
import { DEFAULT_ANALYTICS_PREFERENCES } from '../model/trainingDefaults'
import {
  analyticsPreferencesSchema,
  exerciseDefinitionSchema,
  exerciseSnapshotSchema,
  trainingStateSchema,
} from '../model/trainingSchemas'
import type {
  ExerciseDefinition,
  ExerciseSnapshot,
  TrainingState,
} from '../model/trainingTypes'

export class TrainingDataCorruptionError extends Error {
  override readonly name = 'TrainingDataCorruptionError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cloneAnalyticsDefaults() {
  return {
    ...DEFAULT_ANALYTICS_PREFERENCES,
    range: { ...DEFAULT_ANALYTICS_PREFERENCES.range },
    dismissedBalanceInsightIds: [
      ...DEFAULT_ANALYTICS_PREFERENCES.dismissedBalanceInsightIds,
    ],
  }
}

function getExerciseLookup(record: Record<string, unknown>) {
  const definitions = new Map<string, ExerciseDefinition>(
    STANDARD_EXERCISES.map((exercise) => [exercise.id, exercise]),
  )
  if (!Array.isArray(record.customExercises)) return definitions

  for (const value of record.customExercises) {
    const parsed = exerciseDefinitionSchema.safeParse(value)
    if (parsed.success) definitions.set(parsed.data.id, parsed.data)
  }
  return definitions
}

function getSnapshot(
  entry: Record<string, unknown>,
  definitions: ReadonlyMap<string, ExerciseDefinition>,
): ExerciseSnapshot {
  const existing = exerciseSnapshotSchema.safeParse(entry.exerciseSnapshot)
  if (existing.success) return existing.data

  const exerciseId = typeof entry.exerciseId === 'string' ? entry.exerciseId : ''
  const definition = definitions.get(exerciseId)
  return definition
    ? createExerciseSnapshot(definition)
    : createMissingExerciseSnapshot(exerciseId || 'unknown')
}

function migrateExercises(
  value: unknown,
  definitions: ReadonlyMap<string, ExerciseDefinition>,
) {
  if (!Array.isArray(value)) return value
  return value.map((candidate) => {
    if (!isRecord(candidate)) return candidate
    return {
      ...candidate,
      exerciseSnapshot: getSnapshot(candidate, definitions),
    }
  })
}

function migrateWorkout(
  value: unknown,
  definitions: ReadonlyMap<string, ExerciseDefinition>,
) {
  if (!isRecord(value)) return value
  return {
    ...value,
    exercises: migrateExercises(value.exercises, definitions),
  }
}

function migrateLegacyToV2(record: Record<string, unknown>): TrainingState {
  const definitions = getExerciseLookup(record)
  const completedWorkouts = Array.isArray(record.completedWorkouts)
    ? record.completedWorkouts.map((workout) =>
        migrateWorkout(workout, definitions),
      )
    : record.completedWorkouts

  return trainingStateSchema.parse({
    ...record,
    schemaVersion: 2,
    activeWorkout:
      record.activeWorkout === null
        ? null
        : migrateWorkout(record.activeWorkout, definitions),
    completedWorkouts,
    bodyWeightEntries: [],
    analyticsPreferences: cloneAnalyticsDefaults(),
  })
}

export function migrateTrainingState(value: unknown): TrainingState {
  if (!isRecord(value)) {
    throw new TrainingDataCorruptionError('Unbekannte Trainingsdaten-Version.')
  }
  if (value.schemaVersion === 2) {
    const analyticsPreferences = analyticsPreferencesSchema.safeParse(
      value.analyticsPreferences,
    )
    return trainingStateSchema.parse({
      ...value,
      analyticsPreferences: analyticsPreferences.success
        ? analyticsPreferences.data
        : cloneAnalyticsDefaults(),
    })
  }
  if (value.schemaVersion === 1 || value.schemaVersion === 0) {
    return migrateLegacyToV2(value)
  }
  throw new TrainingDataCorruptionError('Unbekannte Trainingsdaten-Version.')
}
