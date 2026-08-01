import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRAINING_PREFERENCES,
  EMPTY_TRAINING_STATE,
} from './trainingDefaults'
import {
  activeWorkoutSchema,
  trainingStateSchema,
  workoutExerciseEntrySchema,
  workoutSetEntrySchema,
  workoutTemplateExerciseSchema,
  workoutTemplateSchema,
} from './trainingSchemas'
import type {
  ActiveWorkout,
  CompletedWorkout,
  TrainingState,
  WorkoutExerciseEntry,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from './trainingTypes'

function makeValidSet() {
  return {
    id: 'set-1',
    weightKg: 50,
    reps: 10,
    rating: 7,
    completed: true,
  }
}

function makeValidWorkoutExercise(): WorkoutExerciseEntry {
  return {
    id: 'workout-exercise-1',
    exerciseId: 'custom-exercise-1',
    order: 0,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    grip: 'neutral',
    loadMode: 'external',
    note: 'Keep the tempo controlled.',
    exerciseSnapshot: {
      exerciseId: 'custom-exercise-1',
      name: 'Cable Row',
      primaryMuscles: ['back'],
      secondaryMuscles: ['biceps'],
      unit: 'kg-reps',
      supportsBodyweightModes: false,
    },
    sets: [makeValidSet()],
  }
}

function makeValidTemplateExercise(): WorkoutTemplateExercise {
  return {
    id: 'template-exercise-1',
    exerciseId: 'custom-exercise-1',
    order: 0,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    preferredGrip: 'neutral',
  }
}

function makeValidTemplate(): WorkoutTemplate {
  return {
    id: 'template-1',
    name: 'Full Body',
    weekdays: [1, 3, 5],
    exercises: [makeValidTemplateExercise()],
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
  }
}

function makeValidActiveWorkout(): ActiveWorkout {
  return {
    id: 'active-workout-1',
    templateId: 'template-1',
    name: 'Full Body',
    startedAt: '2026-07-26T09:00:00.000Z',
    updatedAt: '2026-07-26T09:30:00.000Z',
    exercises: [makeValidWorkoutExercise()],
  }
}

function makeValidCompletedWorkout(): CompletedWorkout {
  return {
    id: 'completed-workout-1',
    templateId: 'template-1',
    name: 'Full Body',
    startedAt: '2026-07-25T09:00:00.000Z',
    completedAt: '2026-07-25T10:00:00.000Z',
    exercises: [makeValidWorkoutExercise()],
  }
}

function makeValidTrainingState(): TrainingState {
  return {
    schemaVersion: 2,
    customExercises: [
      {
        id: 'custom-exercise-1',
        source: 'custom',
        name: 'Cable Row',
        primaryMuscles: ['back'],
        secondaryMuscles: ['biceps'],
        equipment: ['cable'],
        unit: 'kg-reps',
        description: 'Pull the handle toward the torso.',
        gripOptions: ['neutral'],
        supportsBodyweightModes: false,
        customImageId: 'image-1',
      },
    ],
    favoriteExerciseIds: ['custom-exercise-1'],
    templates: [makeValidTemplate()],
    activeWorkout: makeValidActiveWorkout(),
    completedWorkouts: [makeValidCompletedWorkout()],
    bodyWeightEntries: [
      {
        id: 'weight-1',
        date: '2026-07-25',
        weightKg: 82.5,
        note: 'Morgens',
        createdAt: '2026-07-25T06:00:00.000Z',
        updatedAt: '2026-07-25T06:00:00.000Z',
      },
    ],
    analyticsPreferences: {
      range: { preset: '30d' },
      exerciseMetric: 'weight',
      muscleMetric: 'sets',
      dismissedBalanceInsightIds: [],
    },
    preferences: {
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg: 2.5,
    },
  }
}

describe('training schemas', () => {
  it('accepts ratings at 1 and 10 and rejects values outside that range', () => {
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), rating: 1 })
        .success,
    ).toBe(true)
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), rating: 10 })
        .success,
    ).toBe(true)
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), rating: 0 })
        .success,
    ).toBe(false)
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), rating: 11 })
        .success,
    ).toBe(false)
  })

  it('rejects inverted and non-positive target repetition ranges', () => {
    expect(
      workoutTemplateExerciseSchema.safeParse({
        ...makeValidTemplateExercise(),
        repMin: 8,
        repMax: 8,
      }).success,
    ).toBe(true)
    expect(
      workoutTemplateExerciseSchema.safeParse({
        ...makeValidTemplateExercise(),
        repMin: 13,
        repMax: 12,
      }).success,
    ).toBe(false)
    expect(
      workoutTemplateExerciseSchema.safeParse({
        ...makeValidTemplateExercise(),
        repMin: 0,
      }).success,
    ).toBe(false)
    expect(
      workoutExerciseEntrySchema.safeParse({
        ...makeValidWorkoutExercise(),
        repMin: 13,
        repMax: 12,
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate IDs in persisted collections', () => {
    const duplicateCustomExercises = makeValidTrainingState()
    duplicateCustomExercises.customExercises.push({
      ...duplicateCustomExercises.customExercises[0],
      name: 'Duplicate Cable Row',
    })

    const duplicateFavorites = makeValidTrainingState()
    duplicateFavorites.favoriteExerciseIds.push('custom-exercise-1')

    const duplicateTemplates = makeValidTrainingState()
    duplicateTemplates.templates.push({
      ...duplicateTemplates.templates[0],
      name: 'Duplicate Full Body',
    })

    const duplicateCompletedWorkouts = makeValidTrainingState()
    duplicateCompletedWorkouts.completedWorkouts.push({
      ...duplicateCompletedWorkouts.completedWorkouts[0],
      name: 'Duplicate Completed Workout',
    })

    for (const state of [
      duplicateCustomExercises,
      duplicateFavorites,
      duplicateTemplates,
      duplicateCompletedWorkouts,
    ]) {
      expect(trainingStateSchema.safeParse(state).success).toBe(false)
    }

    const duplicateTemplateExercises = makeValidTemplate()
    duplicateTemplateExercises.exercises.push({
      ...duplicateTemplateExercises.exercises[0],
      exerciseId: 'another-exercise',
    })
    expect(
      workoutTemplateSchema.safeParse(duplicateTemplateExercises).success,
    ).toBe(false)

    const duplicateWorkoutExercises = makeValidActiveWorkout()
    duplicateWorkoutExercises.exercises.push({
      ...duplicateWorkoutExercises.exercises[0],
      exerciseId: 'another-exercise',
    })
    expect(
      activeWorkoutSchema.safeParse(duplicateWorkoutExercises).success,
    ).toBe(false)

    const duplicateSets = makeValidWorkoutExercise()
    duplicateSets.sets.push({ ...duplicateSets.sets[0], reps: 9 })
    expect(workoutExerciseEntrySchema.safeParse(duplicateSets).success).toBe(
      false,
    )
  })

  it('accepts weekdays 1 through 7 and rejects other or repeated values', () => {
    expect(
      workoutTemplateSchema.safeParse({
        ...makeValidTemplate(),
        weekdays: [1, 7],
      }).success,
    ).toBe(true)

    for (const weekdays of [[0], [8], [1.5], [1, 1]]) {
      expect(
        workoutTemplateSchema.safeParse({
          ...makeValidTemplate(),
          weekdays,
        }).success,
      ).toBe(false)
    }
  })

  it('accepts only the four supported load modes', () => {
    for (const loadMode of [
      'external',
      'bodyweight',
      'added',
      'assisted',
    ]) {
      expect(
        workoutExerciseEntrySchema.safeParse({
          ...makeValidWorkoutExercise(),
          loadMode,
        }).success,
      ).toBe(true)
    }

    expect(
      workoutExerciseEntrySchema.safeParse({
        ...makeValidWorkoutExercise(),
        loadMode: 'machine',
      }).success,
    ).toBe(false)
  })

  it('accepts zero or null weight and rejects negative weight', () => {
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), weightKg: 0 })
        .success,
    ).toBe(true)
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), weightKg: null })
        .success,
    ).toBe(true)
    expect(
      workoutSetEntrySchema.safeParse({ ...makeValidSet(), weightKg: -0.5 })
        .success,
    ).toBe(false)
  })

  it('requires schema version two', () => {
    expect(trainingStateSchema.safeParse(makeValidTrainingState()).success).toBe(
      true,
    )
    expect(
      trainingStateSchema.safeParse({
        ...makeValidTrainingState(),
        schemaVersion: 1,
      }).success,
    ).toBe(false)
  })

  it('requires historical exercise snapshots', () => {
    const { exerciseSnapshot: _snapshot, ...withoutSnapshot } =
      makeValidWorkoutExercise()
    void _snapshot

    expect(workoutExerciseEntrySchema.safeParse(withoutSnapshot).success).toBe(
      false,
    )
    expect(
      workoutExerciseEntrySchema.safeParse({
        ...makeValidWorkoutExercise(),
        bodyWeightSnapshot: {
          weightKg: 82.5,
          sourceDate: '2026-07-25',
          capturedAt: '2026-07-25T10:00:00.000Z',
        },
      }).success,
    ).toBe(true)
  })

  it('validates unique plausible body-weight entries and custom ranges', () => {
    const duplicateDate = makeValidTrainingState()
    duplicateDate.bodyWeightEntries.push({
      ...duplicateDate.bodyWeightEntries[0],
      id: 'weight-2',
    })
    expect(trainingStateSchema.safeParse(duplicateDate).success).toBe(false)

    for (const weightKg of [19.99, 500.01, 82.555]) {
      const invalid = makeValidTrainingState()
      invalid.bodyWeightEntries[0].weightKg = weightKg
      expect(trainingStateSchema.safeParse(invalid).success).toBe(false)
    }

    const customRange = makeValidTrainingState()
    customRange.analyticsPreferences.range = {
      preset: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-07-29',
    }
    expect(trainingStateSchema.safeParse(customRange).success).toBe(true)
  })

  it('rejects unknown keys instead of stripping them', () => {
    expect(
      workoutSetEntrySchema.safeParse({
        ...makeValidSet(),
        unexpected: true,
      }).success,
    ).toBe(false)
    expect(
      trainingStateSchema.safeParse({
        ...makeValidTrainingState(),
        unexpected: true,
      }).success,
    ).toBe(false)
  })

  it('exports the exact valid default state', () => {
    expect(DEFAULT_TRAINING_PREFERENCES).toEqual({
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg: 2.5,
    })
    expect(EMPTY_TRAINING_STATE).toEqual({
      schemaVersion: 2,
      customExercises: [],
      favoriteExerciseIds: [],
      templates: [],
      activeWorkout: null,
      completedWorkouts: [],
      bodyWeightEntries: [],
      analyticsPreferences: {
        range: { preset: '30d' },
        exerciseMetric: 'weight',
        muscleMetric: 'sets',
        dismissedBalanceInsightIds: [],
      },
      preferences: {
        showSetRating: true,
        progressionEnabled: true,
        successfulWorkoutCount: 3,
        maximumAverageRating: 8,
        defaultIncrementKg: 2.5,
      },
    })
    expect(trainingStateSchema.parse(EMPTY_TRAINING_STATE)).toEqual(
      EMPTY_TRAINING_STATE,
    )
  })
})
