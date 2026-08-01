import { z } from 'zod'
import type {
  ActiveWorkout,
  AnalyticsPreferences,
  AnalyticsRangeSelection,
  BodyWeightEntry,
  BodyWeightSnapshot,
  CompletedWorkout,
  ExerciseDefinition,
  ExerciseMetric,
  ExerciseSnapshot,
  ExerciseSource,
  ExerciseUnit,
  LoadMode,
  MuscleMetric,
  TrainingPreferences,
  TrainingState,
  Weekday,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from './trainingTypes'

const idSchema = z.string().min(1)
const textSchema = z.string()
const nonEmptyTextSchema = z.string().min(1)
const orderSchema = z.number().int().nonnegative()
const targetSetsSchema = z.number().int().positive()
const targetRepsSchema = z.number().int().positive()
const localDateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  }, 'Invalid local calendar date')
const bodyWeightKgSchema = z.number().min(20).max(500).multipleOf(0.01)

function haveUniqueIds(values: readonly { id: string }[]) {
  return new Set(values.map(({ id }) => id)).size === values.length
}

function haveUniqueValues(values: readonly (number | string)[]) {
  return new Set(values).size === values.length
}

function hasValidRepRange(value: { repMin: number; repMax: number }) {
  return value.repMin <= value.repMax
}

export const weekdaySchema: z.ZodType<Weekday> = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
])

export const exerciseSourceSchema: z.ZodType<ExerciseSource> = z.enum([
  'standard',
  'custom',
])

export const loadModeSchema: z.ZodType<LoadMode> = z.enum([
  'external',
  'bodyweight',
  'added',
  'assisted',
])

export const exerciseUnitSchema: z.ZodType<ExerciseUnit> = z.enum([
  'kg-reps',
  'reps',
  'seconds',
])

export const exerciseDefinitionSchema: z.ZodType<ExerciseDefinition> = z
  .object({
    id: idSchema,
    source: exerciseSourceSchema,
    name: nonEmptyTextSchema,
    primaryMuscles: z.array(nonEmptyTextSchema),
    secondaryMuscles: z.array(nonEmptyTextSchema),
    equipment: z.array(nonEmptyTextSchema),
    unit: exerciseUnitSchema,
    description: textSchema,
    gripOptions: z.array(nonEmptyTextSchema),
    supportsBodyweightModes: z.boolean(),
    illustrationPath: nonEmptyTextSchema.optional(),
    customImageId: idSchema.optional(),
  })
  .strict()

export const exerciseSnapshotSchema: z.ZodType<ExerciseSnapshot> = z
  .object({
    exerciseId: idSchema,
    name: nonEmptyTextSchema,
    primaryMuscles: z.array(nonEmptyTextSchema),
    secondaryMuscles: z.array(nonEmptyTextSchema),
    unit: exerciseUnitSchema,
    supportsBodyweightModes: z.boolean(),
  })
  .strict()

export const bodyWeightSnapshotSchema: z.ZodType<BodyWeightSnapshot> = z
  .object({
    weightKg: bodyWeightKgSchema,
    sourceDate: localDateKeySchema,
    capturedAt: nonEmptyTextSchema,
  })
  .strict()

export const bodyWeightEntrySchema: z.ZodType<BodyWeightEntry> = z
  .object({
    id: idSchema,
    date: localDateKeySchema,
    weightKg: bodyWeightKgSchema,
    note: textSchema,
    createdAt: nonEmptyTextSchema,
    updatedAt: nonEmptyTextSchema,
  })
  .strict()

const analyticsRangePresetSchema = z.enum([
  '7d',
  '30d',
  '3m',
  '6m',
  '1y',
  'all',
])

export const analyticsRangeSelectionSchema: z.ZodType<AnalyticsRangeSelection> =
  z.discriminatedUnion('preset', [
    z.object({ preset: analyticsRangePresetSchema }).strict(),
    z
      .object({
        preset: z.literal('custom'),
        startDate: localDateKeySchema,
        endDate: localDateKeySchema,
      })
      .strict(),
  ])

const exerciseMetricSchema: z.ZodType<ExerciseMetric> = z.enum([
  'weight',
  'reps',
  'volume',
  'oneRepMax',
])
const muscleMetricSchema: z.ZodType<MuscleMetric> = z.enum([
  'sets',
  'volume',
])

export const analyticsPreferencesSchema: z.ZodType<AnalyticsPreferences> = z
  .object({
    range: analyticsRangeSelectionSchema,
    exerciseMetric: exerciseMetricSchema,
    muscleMetric: muscleMetricSchema,
    dismissedBalanceInsightIds: z.array(idSchema).refine(haveUniqueValues, {
      message: 'Dismissed balance insight IDs must be unique',
    }),
  })
  .strict()

export const workoutTemplateExerciseSchema: z.ZodType<WorkoutTemplateExercise> =
  z
    .object({
      id: idSchema,
      exerciseId: idSchema,
      order: orderSchema,
      targetSets: targetSetsSchema,
      repMin: targetRepsSchema,
      repMax: targetRepsSchema,
      preferredGrip: nonEmptyTextSchema.optional(),
    })
    .strict()
    .refine(hasValidRepRange, {
      message: 'repMax must be greater than or equal to repMin',
      path: ['repMax'],
    })

export const workoutTemplateSchema: z.ZodType<WorkoutTemplate> = z
  .object({
    id: idSchema,
    name: nonEmptyTextSchema,
    weekdays: z.array(weekdaySchema).refine(haveUniqueValues, {
      message: 'Weekdays must be unique',
    }),
    exercises: z.array(workoutTemplateExerciseSchema).refine(haveUniqueIds, {
      message: 'Workout template exercise IDs must be unique',
    }),
    createdAt: nonEmptyTextSchema,
    updatedAt: nonEmptyTextSchema,
  })
  .strict()

export const workoutSetEntrySchema: z.ZodType<WorkoutSetEntry> = z
  .object({
    id: idSchema,
    weightKg: z.number().nonnegative().nullable(),
    reps: z.number().int().nonnegative().nullable(),
    rating: z.number().int().min(1).max(10).nullable(),
    completed: z.boolean(),
  })
  .strict()

export const workoutExerciseEntrySchema: z.ZodType<WorkoutExerciseEntry> = z
  .object({
    id: idSchema,
    exerciseId: idSchema,
    order: orderSchema,
    targetSets: targetSetsSchema,
    repMin: targetRepsSchema,
    repMax: targetRepsSchema,
    grip: nonEmptyTextSchema.optional(),
    loadMode: loadModeSchema,
    note: textSchema,
    exerciseSnapshot: exerciseSnapshotSchema,
    bodyWeightSnapshot: bodyWeightSnapshotSchema.optional(),
    sets: z.array(workoutSetEntrySchema).refine(haveUniqueIds, {
      message: 'Workout set IDs must be unique',
    }),
  })
  .strict()
  .refine(hasValidRepRange, {
    message: 'repMax must be greater than or equal to repMin',
    path: ['repMax'],
  })

const workoutExercisesSchema = z
  .array(workoutExerciseEntrySchema)
  .refine(haveUniqueIds, {
    message: 'Workout exercise IDs must be unique',
  })

export const activeWorkoutSchema: z.ZodType<ActiveWorkout> = z
  .object({
    id: idSchema,
    templateId: idSchema.optional(),
    name: nonEmptyTextSchema,
    startedAt: nonEmptyTextSchema,
    updatedAt: nonEmptyTextSchema,
    exercises: workoutExercisesSchema,
  })
  .strict()

export const completedWorkoutSchema: z.ZodType<CompletedWorkout> = z
  .object({
    id: idSchema,
    templateId: idSchema.optional(),
    name: nonEmptyTextSchema,
    startedAt: nonEmptyTextSchema,
    completedAt: nonEmptyTextSchema,
    exercises: workoutExercisesSchema,
  })
  .strict()

export const trainingPreferencesSchema: z.ZodType<TrainingPreferences> = z
  .object({
    showSetRating: z.boolean(),
    progressionEnabled: z.boolean(),
    successfulWorkoutCount: z.number().int().positive(),
    maximumAverageRating: z.number().min(1).max(10),
    defaultIncrementKg: z.number().positive(),
  })
  .strict()

export const trainingStateSchema: z.ZodType<TrainingState> = z
  .object({
    schemaVersion: z.literal(2),
    customExercises: z.array(exerciseDefinitionSchema).refine(haveUniqueIds, {
      message: 'Custom exercise IDs must be unique',
    }),
    favoriteExerciseIds: z.array(idSchema).refine(haveUniqueValues, {
      message: 'Favorite exercise IDs must be unique',
    }),
    templates: z.array(workoutTemplateSchema).refine(haveUniqueIds, {
      message: 'Workout template IDs must be unique',
    }),
    activeWorkout: activeWorkoutSchema.nullable(),
    completedWorkouts: z.array(completedWorkoutSchema).refine(haveUniqueIds, {
      message: 'Completed workout IDs must be unique',
    }),
    bodyWeightEntries: z
      .array(bodyWeightEntrySchema)
      .refine(haveUniqueIds, {
        message: 'Body-weight entry IDs must be unique',
      })
      .refine((entries) => haveUniqueValues(entries.map(({ date }) => date)), {
        message: 'Body-weight entry dates must be unique',
      }),
    analyticsPreferences: analyticsPreferencesSchema,
    preferences: trainingPreferencesSchema,
  })
  .strict()
