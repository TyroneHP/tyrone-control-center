import { describe, expect, it } from 'vitest'
import {
  createExerciseSnapshot,
  getExerciseDefinition,
} from './exerciseCatalog'
import type {
  CompletedWorkout,
  LoadMode,
  TrainingPreferences,
  WorkoutSetEntry,
} from './trainingTypes'
import { getProgressionRecommendation } from './progression'

const DEFAULT_PREFERENCES: TrainingPreferences = {
  showSetRating: true,
  progressionEnabled: true,
  successfulWorkoutCount: 3,
  maximumAverageRating: 8,
  defaultIncrementKg: 2.5,
}

interface OccurrenceOptions {
  id: string
  completedAt: string
  exerciseId?: string
  loadMode?: LoadMode
  repMax?: number
  sets?: WorkoutSetEntry[]
}

function makeOccurrence({
  id,
  completedAt,
  exerciseId = 'bench-press',
  loadMode = 'external',
  repMax = 12,
  sets = [
    {
      id: `${id}-set-1`,
      weightKg: 80,
      reps: 12,
      rating: 7,
      completed: true,
    },
    {
      id: `${id}-set-2`,
      weightKg: 80,
      reps: 12,
      rating: 8,
      completed: true,
    },
  ],
}: OccurrenceOptions): CompletedWorkout {
  const exercise = getExerciseDefinition(exerciseId)
  if (!exercise) throw new Error(`Missing test exercise: ${exerciseId}`)

  return {
    id,
    name: 'Push',
    startedAt: completedAt.replace('10:00', '09:00'),
    completedAt,
    exercises: [
      {
        id: `${id}-exercise`,
        exerciseId,
        exerciseSnapshot: createExerciseSnapshot(exercise),
        order: 0,
        targetSets: 2,
        repMin: 8,
        repMax,
        loadMode,
        note: '',
        sets,
      },
    ],
  }
}

describe('getProgressionRecommendation', () => {
  it('recommends an increment after the latest three exercise occurrences succeed', () => {
    const earliest = makeOccurrence({
      id: 'workout-1',
      completedAt: '2026-07-01T10:00:00.000Z',
    })
    const middle = makeOccurrence({
      id: 'workout-2',
      completedAt: '2026-07-03T10:00:00.000Z',
    })
    const unrelated = makeOccurrence({
      id: 'workout-row',
      completedAt: '2026-07-04T10:00:00.000Z',
      exerciseId: 'barbell-row',
    })
    const latest = makeOccurrence({
      id: 'workout-3',
      completedAt: '2026-07-05T10:00:00.000Z',
    })

    const recommendation = getProgressionRecommendation(
      'bench-press',
      [latest, earliest, unrelated, middle],
      DEFAULT_PREFERENCES,
    )

    expect(recommendation).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 3,
    })
  })

  it('counts distinct completed workouts instead of duplicate exercise entries', () => {
    const oneWorkout = makeOccurrence({
      id: 'one-session',
      completedAt: '2026-07-05T10:00:00.000Z',
    })
    const repeatedEntry = oneWorkout.exercises[0]
    const oneSessionWithThreeEntries: CompletedWorkout = {
      ...oneWorkout,
      exercises: [
        repeatedEntry,
        {
          ...repeatedEntry,
          id: 'one-session-exercise-2',
          sets: repeatedEntry.sets.map((set) => ({
            ...set,
            id: `${set.id}-copy-2`,
          })),
        },
        {
          ...repeatedEntry,
          id: 'one-session-exercise-3',
          sets: repeatedEntry.sets.map((set) => ({
            ...set,
            id: `${set.id}-copy-3`,
          })),
        },
      ],
    }
    const threeSessions = [
      oneWorkout,
      makeOccurrence({
        id: 'second-session',
        completedAt: '2026-07-06T10:00:00.000Z',
      }),
      makeOccurrence({
        id: 'third-session',
        completedAt: '2026-07-07T10:00:00.000Z',
      }),
    ]

    expect(
      getProgressionRecommendation(
        'bench-press',
        [oneSessionWithThreeEntries],
        DEFAULT_PREFERENCES,
      ),
    ).toBeNull()
    expect(
      getProgressionRecommendation(
        'bench-press',
        threeSessions,
        DEFAULT_PREFERENCES,
      ),
    ).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 3,
    })
  })

  it('requires every matching entry in a counted workout to succeed', () => {
    const workout = makeOccurrence({
      id: 'duplicate-entry-session',
      completedAt: '2026-07-05T10:00:00.000Z',
    })
    const successfulEntry = workout.exercises[0]
    const failedEntry = {
      ...successfulEntry,
      id: 'duplicate-entry-failed',
      sets: [
        {
          ...successfulEntry.sets[0],
          id: 'duplicate-entry-failed-set',
          reps: 11,
        },
      ],
    }

    expect(
      getProgressionRecommendation(
        'bench-press',
        [{ ...workout, exercises: [successfulEntry, failedEntry] }],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 1 },
      ),
    ).toBeNull()
  })

  it('uses chronological instants for the latest consecutive offset-timestamp occurrences', () => {
    const arrayFirstOlderFailure = makeOccurrence({
      id: 'array-first-older-failure',
      completedAt: '2026-07-24T12:00:00.000Z',
      sets: [
        {
          id: 'array-first-failed-set',
          weightKg: 80,
          reps: 11,
          rating: 7,
          completed: true,
        },
      ],
    })
    const chronologicallyLatest = makeOccurrence({
      id: 'chronologically-latest',
      completedAt: '2026-07-25T09:00:00.000-02:00',
    })
    const chronologicallySecond = makeOccurrence({
      id: 'chronologically-second',
      completedAt: '2026-07-25T10:45:00.000Z',
    })
    const lexicalIntruder = makeOccurrence({
      id: 'lexical-intruder',
      completedAt: '2026-07-25T10:30:00.000Z',
      sets: [
        {
          id: 'lexical-intruder-failed-set',
          weightKg: 80,
          reps: 11,
          rating: 7,
          completed: true,
        },
      ],
    })
    const completedWorkouts = [
      arrayFirstOlderFailure,
      chronologicallyLatest,
      chronologicallySecond,
      lexicalIntruder,
    ]

    const recommendation = getProgressionRecommendation(
      'bench-press',
      completedWorkouts,
      { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 2 },
    )

    expect(recommendation).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 2,
    })
    expect(completedWorkouts.map(({ id }) => id)).toEqual([
      'array-first-older-failure',
      'chronologically-latest',
      'chronologically-second',
      'lexical-intruder',
    ])
  })

  it('does not skip a recent failed occurrence to use an older success', () => {
    const olderSuccess = makeOccurrence({
      id: 'older-success',
      completedAt: '2026-07-01T10:00:00.000Z',
    })
    const thirdLatestSuccess = makeOccurrence({
      id: 'third-latest-success',
      completedAt: '2026-07-02T10:00:00.000Z',
    })
    const recentFailure = makeOccurrence({
      id: 'recent-failure',
      completedAt: '2026-07-03T10:00:00.000Z',
      sets: [
        {
          id: 'failed-set',
          weightKg: 80,
          reps: 11,
          rating: 7,
          completed: true,
        },
      ],
    })
    const latestSuccess = makeOccurrence({
      id: 'latest-success',
      completedAt: '2026-07-04T10:00:00.000Z',
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [
          olderSuccess,
          latestSuccess,
          thirdLatestSuccess,
          recentFailure,
        ],
        DEFAULT_PREFERENCES,
      ),
    ).toBeNull()
  })

  it('excludes incomplete sets and completed sets missing reps or required load', () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      successfulWorkoutCount: 1,
    }
    const workout = makeOccurrence({
      id: 'mixed-sets',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'counted-set',
          weightKg: 80,
          reps: 12,
          rating: 7,
          completed: true,
        },
        {
          id: 'incomplete-set',
          weightKg: 120,
          reps: 1,
          rating: 10,
          completed: false,
        },
        {
          id: 'missing-reps',
          weightKg: 120,
          reps: null,
          rating: 10,
          completed: true,
        },
        {
          id: 'missing-external-load',
          weightKg: null,
          reps: 12,
          rating: 10,
          completed: true,
        },
      ],
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        preferences,
      ),
    ).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 1,
    })
  })

  it('requires at least one eligible completed set in every occurrence', () => {
    const workout = makeOccurrence({
      id: 'no-eligible-sets',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'incomplete',
          weightKg: 80,
          reps: 12,
          rating: 7,
          completed: false,
        },
        {
          id: 'missing-reps',
          weightKg: 80,
          reps: null,
          rating: 7,
          completed: true,
        },
        {
          id: 'missing-load',
          weightKg: null,
          reps: 12,
          rating: 7,
          completed: true,
        },
      ],
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 1 },
      ),
    ).toBeNull()
  })

  it('uses the average rating across all counted sets when ratings are enabled', () => {
    const acceptableAverage = makeOccurrence({
      id: 'average-eight',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'hard-set',
          weightKg: 80,
          reps: 12,
          rating: 10,
          completed: true,
        },
        {
          id: 'easy-set',
          weightKg: 80,
          reps: 12,
          rating: 6,
          completed: true,
        },
      ],
    })
    const excessiveAverage = makeOccurrence({
      id: 'average-nine',
      completedAt: '2026-07-06T10:00:00.000Z',
      sets: [
        {
          id: 'hard-set-1',
          weightKg: 80,
          reps: 12,
          rating: 9,
          completed: true,
        },
        {
          id: 'hard-set-2',
          weightKg: 80,
          reps: 12,
          rating: 9,
          completed: true,
        },
      ],
    })
    const oneWorkoutPreferences = {
      ...DEFAULT_PREFERENCES,
      successfulWorkoutCount: 1,
    }

    expect(
      getProgressionRecommendation(
        'bench-press',
        [acceptableAverage],
        oneWorkoutPreferences,
      ),
    ).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 1,
    })
    expect(
      getProgressionRecommendation(
        'bench-press',
        [excessiveAverage],
        oneWorkoutPreferences,
      ),
    ).toBeNull()
  })

  it('requires a rating on every counted set when ratings are enabled', () => {
    const workout = makeOccurrence({
      id: 'missing-rating',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'unrated-set',
          weightKg: 80,
          reps: 12,
          rating: null,
          completed: true,
        },
      ],
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 1 },
      ),
    ).toBeNull()
  })

  it('skips the rating criterion when ratings are disabled', () => {
    const workout = makeOccurrence({
      id: 'ratings-hidden',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'unrated-set',
          weightKg: 80,
          reps: 12,
          rating: null,
          completed: true,
        },
        {
          id: 'rating-above-threshold',
          weightKg: 80,
          reps: 12,
          rating: 10,
          completed: true,
        },
      ],
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        {
          ...DEFAULT_PREFERENCES,
          showSetRating: false,
          successfulWorkoutCount: 1,
        },
      ),
    ).toEqual({
      exerciseId: 'bench-press',
      currentWeightKg: 80,
      suggestedWeightKg: 82.5,
      successfulWorkoutCount: 1,
    })
  })

  it('requires one load mode and one weight across all counted sets', () => {
    const mixedWeight = makeOccurrence({
      id: 'mixed-weight',
      completedAt: '2026-07-05T10:00:00.000Z',
      sets: [
        {
          id: 'set-80',
          weightKg: 80,
          reps: 12,
          rating: 7,
          completed: true,
        },
        {
          id: 'set-82-5',
          weightKg: 82.5,
          reps: 12,
          rating: 7,
          completed: true,
        },
      ],
    })
    const external = makeOccurrence({
      id: 'external',
      completedAt: '2026-07-05T10:00:00.000Z',
    })
    const added = makeOccurrence({
      id: 'added',
      completedAt: '2026-07-06T10:00:00.000Z',
      loadMode: 'added',
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [mixedWeight],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 1 },
      ),
    ).toBeNull()
    expect(
      getProgressionRecommendation(
        'bench-press',
        [external, added],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 2 },
      ),
    ).toBeNull()
  })

  it('reduces assisted weight and never suggests negative assistance', () => {
    const assistedTwenty = makeOccurrence({
      id: 'assisted-20',
      completedAt: '2026-07-05T10:00:00.000Z',
      exerciseId: 'pull-up',
      loadMode: 'assisted',
      sets: [
        {
          id: 'assisted-set-20',
          weightKg: 20,
          reps: 12,
          rating: 7,
          completed: true,
        },
      ],
    })
    const assistedOne = makeOccurrence({
      id: 'assisted-1',
      completedAt: '2026-07-06T10:00:00.000Z',
      exerciseId: 'pull-up',
      loadMode: 'assisted',
      sets: [
        {
          id: 'assisted-set-1',
          weightKg: 1,
          reps: 12,
          rating: 7,
          completed: true,
        },
      ],
    })
    const preferences = {
      ...DEFAULT_PREFERENCES,
      successfulWorkoutCount: 1,
    }

    expect(
      getProgressionRecommendation(
        'pull-up',
        [assistedTwenty],
        preferences,
      ),
    ).toEqual({
      exerciseId: 'pull-up',
      currentWeightKg: 20,
      suggestedWeightKg: 17.5,
      successfulWorkoutCount: 1,
    })
    expect(
      getProgressionRecommendation(
        'pull-up',
        [assistedOne],
        preferences,
      ),
    ).toEqual({
      exerciseId: 'pull-up',
      currentWeightKg: 1,
      suggestedWeightKg: 0,
      successfulWorkoutCount: 1,
    })
  })

  it('treats bodyweight as a zero-load occurrence', () => {
    const workout = makeOccurrence({
      id: 'bodyweight',
      completedAt: '2026-07-05T10:00:00.000Z',
      exerciseId: 'pull-up',
      loadMode: 'bodyweight',
      sets: [
        {
          id: 'bodyweight-set',
          weightKg: null,
          reps: 12,
          rating: 7,
          completed: true,
        },
      ],
    })

    expect(
      getProgressionRecommendation(
        'pull-up',
        [workout],
        { ...DEFAULT_PREFERENCES, successfulWorkoutCount: 1 },
      ),
    ).toEqual({
      exerciseId: 'pull-up',
      currentWeightKg: 0,
      suggestedWeightKg: 2.5,
      successfulWorkoutCount: 1,
    })
  })

  it('returns no recommendation when progression is disabled or history is insufficient', () => {
    const workout = makeOccurrence({
      id: 'single-workout',
      completedAt: '2026-07-05T10:00:00.000Z',
    })

    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        { ...DEFAULT_PREFERENCES, progressionEnabled: false },
      ),
    ).toBeNull()
    expect(
      getProgressionRecommendation(
        'bench-press',
        [workout],
        DEFAULT_PREFERENCES,
      ),
    ).toBeNull()
  })
})
