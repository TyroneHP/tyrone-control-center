import { z } from 'zod'
import type {
  ActiveWorkout,
  CompletedWorkout,
  ExerciseDefinition,
  ExerciseSource,
  ExerciseUnit,
  LoadMode,
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
    schemaVersion: z.literal(1),
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
    preferences: trainingPreferencesSchema,
  })
  .strict()
