import { describe, expect, it } from 'vitest'
import type {
  CompletedWorkout,
  ExerciseSnapshot,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import { getExerciseSeries } from './exerciseAnalytics'

const BENCH: ExerciseSnapshot = {
  exerciseId: 'bench-press',
  name: 'Historisches Bankdrücken',
  primaryMuscles: ['Brust'],
  secondaryMuscles: ['Trizeps'],
  unit: 'kg-reps',
  supportsBodyweightModes: false,
}

function set(
  id: string,
  weightKg: number | null,
  reps: number | null,
  completed = true,
): WorkoutSetEntry {
  return { id, weightKg, reps, rating: 7, completed }
}

function exerciseEntry(
  id: string,
  sets: WorkoutSetEntry[],
  snapshot = BENCH,
): WorkoutExerciseEntry {
  return {
    id,
    exerciseId: snapshot.exerciseId,
    exerciseSnapshot: snapshot,
    order: 0,
    targetSets: sets.length,
    repMin: 8,
    repMax: 12,
    grip: 'Normal',
    loadMode: 'external',
    note: 'Historische Notiz',
    sets,
  }
}

function workout(
  id: string,
  completedAt: string,
  exercises: WorkoutExerciseEntry[],
): CompletedWorkout {
  return {
    id,
    name: `Training ${id}`,
    startedAt: completedAt,
    completedAt,
    exercises,
  }
}

const RANGE = { startDate: '2026-07-01', endDate: '2026-07-31' }

describe('exercise analytics series', () => {
  const workouts = [
    workout('later', '2026-07-20T09:00:00.000Z', [
      exerciseEntry('later-entry', [
        set('later-1', 82.5, 8),
        set('later-2', 80, 12),
        set('later-incomplete', 100, 20, false),
      ]),
    ]),
    workout('outside', '2026-06-20T09:00:00.000Z', [
      exerciseEntry('outside-entry', [set('outside-1', 200, 12)]),
    ]),
    workout('earlier', '2026-07-10T09:00:00.000Z', [
      exerciseEntry('earlier-entry', [set('earlier-1', 80, 10)]),
    ]),
  ]

  it.each([
    ['weight', [80, 82.5]],
    ['reps', [10, 12]],
    ['volume', [800, 1620]],
    ['oneRepMax', [106.66666666666666, 112]],
  ] as const)('aggregates %s once per workout in chronological order', (metric, values) => {
    expect(
      getExerciseSeries(workouts, 'bench-press', metric, RANGE).map(
        ({ workoutId, value }) => ({ workoutId, value }),
      ),
    ).toEqual([
      { workoutId: 'earlier', value: values[0] },
      { workoutId: 'later', value: values[1] },
    ])
  })

  it('retains historical snapshot and raw set details for deleted or changed exercises', () => {
    const [point] = getExerciseSeries(
      workouts,
      'bench-press',
      'weight',
      RANGE,
    )

    expect(point).toMatchObject({
      workoutId: 'earlier',
      workoutName: 'Training earlier',
      date: '2026-07-10',
      exerciseId: 'bench-press',
      exerciseName: 'Historisches Bankdrücken',
      primaryMuscles: ['Brust'],
      secondaryMuscles: ['Trizeps'],
      grips: ['Normal'],
      exerciseEntryIds: ['earlier-entry'],
      sets: [
        {
          exerciseEntryId: 'earlier-entry',
          setId: 'earlier-1',
          setNumber: 1,
          weightKg: 80,
          reps: 10,
          rating: 7,
          completed: true,
          loadKg: 80,
          volume: 800,
          oneRepMax: 106.66666666666666,
        },
      ],
    })
  })

  it('combines repeated exercise entries in one workout and keeps stable input order for ties', () => {
    const repeated = workout('repeated', '2026-07-15T09:00:00.000Z', [
      exerciseEntry('entry-a', [set('a', 50, 10)]),
      exerciseEntry('entry-b', [set('b', 60, 10)]),
    ])
    const sameInstant = workout('same-instant', '2026-07-15T09:00:00.000Z', [
      exerciseEntry('entry-c', [set('c', 55, 10)]),
    ])

    const points = getExerciseSeries(
      [repeated, sameInstant],
      'bench-press',
      'volume',
      RANGE,
    )
    expect(points.map(({ workoutId, value }) => ({ workoutId, value }))).toEqual([
      { workoutId: 'repeated', value: 1100 },
      { workoutId: 'same-instant', value: 550 },
    ])
    expect(points[0].exerciseEntryIds).toEqual(['entry-a', 'entry-b'])
  })

  it('omits points when the requested metric has no valid completed values', () => {
    const timeExercise = exerciseEntry(
      'plank-entry',
      [set('plank-set', null, 60)],
      { ...BENCH, exerciseId: 'plank', name: 'Unterarmstütz', unit: 'seconds' },
    )
    const session = workout('plank', '2026-07-10T09:00:00.000Z', [timeExercise])

    expect(getExerciseSeries([session], 'plank', 'weight', RANGE)).toEqual([])
    expect(getExerciseSeries([session], 'plank', 'reps', RANGE)).toHaveLength(1)
  })
})
