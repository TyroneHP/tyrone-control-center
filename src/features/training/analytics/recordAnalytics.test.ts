import { describe, expect, it } from 'vitest'
import type {
  CompletedWorkout,
  ExerciseSnapshot,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import {
  getExerciseRecordHistory,
  getExerciseRecords,
} from './recordAnalytics'

const BENCH: ExerciseSnapshot = {
  exerciseId: 'bench-press',
  name: 'Bankdrücken',
  primaryMuscles: ['Brust'],
  secondaryMuscles: ['Trizeps'],
  unit: 'kg-reps',
  supportsBodyweightModes: false,
}

function workout(
  id: string,
  completedAt: string,
  weightKg: number,
  reps: number,
): CompletedWorkout {
  const set: WorkoutSetEntry = {
    id: `${id}-set`,
    weightKg,
    reps,
    rating: 7,
    completed: true,
  }
  const exercise: WorkoutExerciseEntry = {
    id: `${id}-entry`,
    exerciseId: BENCH.exerciseId,
    exerciseSnapshot: BENCH,
    order: 0,
    targetSets: 1,
    repMin: 8,
    repMax: 12,
    loadMode: 'external',
    note: '',
    sets: [set],
  }
  return {
    id,
    name: `Training ${id}`,
    startedAt: completedAt,
    completedAt,
    exercises: [exercise],
  }
}

const FIRST = workout('first', '2026-07-01T10:00:00.000Z', 80, 10)
const TIE = workout('tie', '2026-07-03T10:00:00.000Z', 80, 10)
const HEAVIER = workout('heavier', '2026-07-05T10:00:00.000Z', 85, 8)
const MORE_REPS = workout('more-reps', '2026-07-07T10:00:00.000Z', 82.5, 12)

describe('exercise records', () => {
  it('creates the first records, appends only strict improvements and ignores ties', () => {
    const history = getExerciseRecordHistory(
      [MORE_REPS, TIE, FIRST, HEAVIER],
      'bench-press',
    )

    expect(history.map(({ recordType, value, previousValue, workoutId }) => ({
      recordType,
      value,
      previousValue,
      workoutId,
    }))).toEqual([
      { recordType: 'weight', value: 80, previousValue: undefined, workoutId: 'first' },
      { recordType: 'setVolume', value: 800, previousValue: undefined, workoutId: 'first' },
      { recordType: 'reps', value: 10, previousValue: undefined, workoutId: 'first' },
      { recordType: 'weight', value: 85, previousValue: 80, workoutId: 'heavier' },
      { recordType: 'setVolume', value: 990, previousValue: 800, workoutId: 'more-reps' },
      { recordType: 'reps', value: 12, previousValue: 10, workoutId: 'more-reps' },
    ])
  })

  it('retains complete record references and returns current records per type', () => {
    const records = getExerciseRecords([FIRST, HEAVIER, MORE_REPS])

    expect(records).toEqual([
      expect.objectContaining({
        exerciseId: 'bench-press',
        exerciseName: 'Bankdrücken',
        recordType: 'weight',
        value: 85,
        workoutId: 'heavier',
        workoutName: 'Training heavier',
        exerciseEntryId: 'heavier-entry',
        setId: 'heavier-set',
        setNumber: 1,
        date: '2026-07-05',
      }),
      expect.objectContaining({
        exerciseId: 'bench-press',
        recordType: 'setVolume',
        value: 990,
        workoutId: 'more-reps',
      }),
      expect.objectContaining({
        exerciseId: 'bench-press',
        recordType: 'reps',
        value: 12,
        workoutId: 'more-reps',
      }),
    ])
  })

  it('rebuilds records after historical editing and promotes the next best after deletion', () => {
    const editedFirst = workout('first', '2026-07-01T10:00:00.000Z', 90, 10)
    expect(
      getExerciseRecords([editedFirst, HEAVIER]).find(
        ({ recordType }) => recordType === 'weight',
      ),
    ).toMatchObject({ value: 90, workoutId: 'first' })

    expect(
      getExerciseRecords([FIRST, MORE_REPS]).find(
        ({ recordType }) => recordType === 'weight',
      ),
    ).toMatchObject({ value: 82.5, workoutId: 'more-reps' })
  })

  it('applies an optional local date range', () => {
    const records = getExerciseRecords([FIRST, HEAVIER], {
      startDate: '2026-07-05',
      endDate: '2026-07-05',
    })
    const weightRecord = records.find(
      ({ recordType }) => recordType === 'weight',
    )
    expect(weightRecord).toMatchObject({ value: 85 })
    expect(weightRecord?.previousValue).toBeUndefined()
  })

  it('uses total bodyweight load for pull-up records', () => {
    const pullUp = workout('pull-up', '2026-07-10T10:00:00.000Z', 15, 8)
    pullUp.exercises[0] = {
      ...pullUp.exercises[0],
      exerciseId: 'pull-up',
      exerciseSnapshot: {
        ...BENCH,
        exerciseId: 'pull-up',
        name: 'Klimmzüge',
        unit: 'reps',
        supportsBodyweightModes: true,
      },
      bodyWeightSnapshot: {
        weightKg: 80,
        sourceDate: '2026-07-10',
        capturedAt: '2026-07-10T10:00:00.000Z',
      },
      loadMode: 'added',
    }

    expect(getExerciseRecords([pullUp])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exerciseId: 'pull-up',
          recordType: 'weight',
          value: 95,
        }),
        expect.objectContaining({
          exerciseId: 'pull-up',
          recordType: 'setVolume',
          value: 760,
        }),
      ]),
    )
  })
})
