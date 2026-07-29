import { describe, expect, it } from 'vitest'
import type {
  BodyWeightSnapshot,
  ExerciseSnapshot,
  LoadMode,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import {
  estimateOneRepMax,
  getSetLoadKg,
  getSetVolume,
  roundAnalyticsValue,
} from './loadAnalytics'

const WEIGHTED_SNAPSHOT: ExerciseSnapshot = {
  exerciseId: 'bench-press',
  name: 'Bankdrücken',
  primaryMuscles: ['Brust'],
  secondaryMuscles: ['Trizeps'],
  unit: 'kg-reps',
  supportsBodyweightModes: false,
}

const BODYWEIGHT_SNAPSHOT: ExerciseSnapshot = {
  exerciseId: 'pull-up',
  name: 'Klimmzüge',
  primaryMuscles: ['Latissimus'],
  secondaryMuscles: ['Bizeps'],
  unit: 'reps',
  supportsBodyweightModes: true,
}

const BODY_WEIGHT: BodyWeightSnapshot = {
  weightKg: 80,
  sourceDate: '2026-07-20',
  capturedAt: '2026-07-29T10:00:00.000Z',
}

function exercise(
  exerciseSnapshot: ExerciseSnapshot,
  loadMode: LoadMode = 'external',
  bodyWeightSnapshot?: BodyWeightSnapshot,
): WorkoutExerciseEntry {
  return {
    id: 'entry-1',
    exerciseId: exerciseSnapshot.exerciseId,
    exerciseSnapshot,
    ...(bodyWeightSnapshot ? { bodyWeightSnapshot } : {}),
    order: 0,
    targetSets: 1,
    repMin: 8,
    repMax: 12,
    loadMode,
    note: '',
    sets: [],
  }
}

function completedSet(
  weightKg: number | null,
  reps: number | null,
  overrides: Partial<WorkoutSetEntry> = {},
): WorkoutSetEntry {
  return {
    id: 'set-1',
    weightKg,
    reps,
    rating: null,
    completed: true,
    ...overrides,
  }
}

describe('set load analytics', () => {
  it('uses entered kilograms for completed normal weighted exercises', () => {
    const bench = exercise(WEIGHTED_SNAPSHOT)

    expect(getSetLoadKg(bench, completedSet(100, 8))).toBe(100)
    expect(getSetVolume(bench, completedSet(100, 8))).toBe(800)
  })

  it.each([
    [completedSet(100, 8, { completed: false }), undefined],
    [completedSet(null, 8), undefined],
    [completedSet(Number.NaN, 8), undefined],
    [completedSet(-1, 8), undefined],
  ] as const)('rejects incomplete or invalid loads', (set, expected) => {
    expect(getSetLoadKg(exercise(WEIGHTED_SNAPSHOT), set)).toBe(expected)
  })

  it('does not calculate load or volume for weightless exercises', () => {
    const plank = exercise({
      ...WEIGHTED_SNAPSHOT,
      exerciseId: 'plank',
      name: 'Unterarmstütz',
      unit: 'seconds',
    })

    expect(getSetLoadKg(plank, completedSet(20, 60))).toBeUndefined()
    expect(getSetVolume(plank, completedSet(20, 60))).toBeUndefined()
  })

  it.each([
    ['bodyweight', null, 80],
    ['added', 15, 95],
    ['assisted', 25, 55],
    ['assisted', 90, 0],
  ] as const)(
    'calculates %s bodyweight load from an immutable snapshot',
    (loadMode, enteredKg, expected) => {
      const pullUp = exercise(BODYWEIGHT_SNAPSHOT, loadMode, BODY_WEIGHT)
      expect(getSetLoadKg(pullUp, completedSet(enteredKg, 8))).toBe(expected)
    },
  )

  it('does not calculate bodyweight load without a historical snapshot', () => {
    expect(
      getSetLoadKg(
        exercise(BODYWEIGHT_SNAPSHOT, 'added'),
        completedSet(15, 8),
      ),
    ).toBeUndefined()
  })

  it.each([
    [1, 103.33333333333334],
    [12, 140],
    [0, undefined],
    [13, undefined],
  ] as const)('applies Epley only for 1 through 12 repetitions', (reps, expected) => {
    expect(
      estimateOneRepMax(
        exercise(WEIGHTED_SNAPSHOT),
        completedSet(100, reps),
      ),
    ).toBe(expected)
  })

  it('rejects missing or invalid repetitions for volume and 1RM', () => {
    const bench = exercise(WEIGHTED_SNAPSHOT)

    expect(getSetVolume(bench, completedSet(100, null))).toBeUndefined()
    expect(getSetVolume(bench, completedSet(100, -1))).toBeUndefined()
    expect(estimateOneRepMax(bench, completedSet(100, null))).toBeUndefined()
  })

  it('retains raw precision and rounds only for presentation', () => {
    const raw = estimateOneRepMax(
      exercise(WEIGHTED_SNAPSHOT),
      completedSet(100, 1),
    )

    expect(raw).toBe(103.33333333333334)
    expect(roundAnalyticsValue(raw!, 1)).toBe(103.3)
    expect(roundAnalyticsValue(77.005, 2)).toBe(77.01)
  })
})
