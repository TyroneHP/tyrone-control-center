import { describe, expect, it } from 'vitest'
import type {
  CompletedWorkout,
  ExerciseSnapshot,
  WorkoutExerciseEntry,
} from '../model/trainingTypes'
import { getMuscleGroupAnalytics } from './muscleGroupAnalytics'

const RANGE = { startDate: '2026-07-01', endDate: '2026-07-31' }

function exercise(
  id: string,
  snapshot: ExerciseSnapshot,
  weightKg: number | null,
  reps: number,
): WorkoutExerciseEntry {
  return {
    id,
    exerciseId: snapshot.exerciseId,
    exerciseSnapshot: snapshot,
    order: 0,
    targetSets: 2,
    repMin: 8,
    repMax: 12,
    loadMode: 'external',
    note: '',
    sets: [
      { id: `${id}-complete`, weightKg, reps, rating: 7, completed: true },
      { id: `${id}-open`, weightKg, reps, rating: 7, completed: false },
    ],
  }
}

describe('muscle-group analytics', () => {
  it('weights every primary muscle at 100% and every secondary muscle at 50%', () => {
    const bench = exercise(
      'bench-entry',
      {
        exerciseId: 'historic-bench',
        name: 'Historisches Drücken',
        primaryMuscles: ['Brust', 'Obere Brust'],
        secondaryMuscles: ['Trizeps', 'Vordere Schulter'],
        unit: 'kg-reps',
        supportsBodyweightModes: false,
      },
      100,
      8,
    )
    const result = getMuscleGroupAnalytics(
      [
        {
          id: 'workout-1',
          name: 'Push',
          startedAt: '2026-07-10T09:00:00.000Z',
          completedAt: '2026-07-10T10:00:00.000Z',
          exercises: [bench],
        },
      ],
      RANGE,
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ muscleGroup: 'Brust', weightedSets: 1, volume: 800 }),
        expect.objectContaining({ muscleGroup: 'Obere Brust', weightedSets: 1, volume: 800 }),
        expect.objectContaining({ muscleGroup: 'Trizeps', weightedSets: 0.5, volume: 400 }),
        expect.objectContaining({ muscleGroup: 'Vordere Schulter', weightedSets: 0.5, volume: 400 }),
      ]),
    )
    const chest = result.find(({ muscleGroup }) => muscleGroup === 'Brust')!
    expect(chest.contributions).toEqual([
      {
        exerciseId: 'historic-bench',
        exerciseName: 'Historisches Drücken',
        weightedSets: 1,
        volume: 800,
      },
    ])
    expect(chest.sessions).toEqual([
      { workoutId: 'workout-1', weightedSets: 1, volume: 800 },
    ])
  })

  it('counts weightless completed sets but contributes no volume', () => {
    const plank = exercise(
      'plank-entry',
      {
        exerciseId: 'deleted-custom-plank',
        name: 'Eigener Unterarmstütz',
        primaryMuscles: ['Rumpf'],
        secondaryMuscles: ['Seitliche Bauchmuskeln'],
        unit: 'seconds',
        supportsBodyweightModes: false,
      },
      null,
      60,
    )
    const workouts: CompletedWorkout[] = [{
      id: 'plank-workout',
      name: 'Core',
      startedAt: '2026-07-12T09:00:00.000Z',
      completedAt: '2026-07-12T10:00:00.000Z',
      exercises: [plank],
    }]

    expect(getMuscleGroupAnalytics(workouts, RANGE)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ muscleGroup: 'Rumpf', weightedSets: 1, volume: 0 }),
        expect.objectContaining({ muscleGroup: 'Seitliche Bauchmuskeln', weightedSets: 0.5, volume: 0 }),
      ]),
    )
  })

  it('reports percentages against weighted totals and filters the local period', () => {
    const snapshot: ExerciseSnapshot = {
      exerciseId: 'row',
      name: 'Rudern',
      primaryMuscles: ['Rücken'],
      secondaryMuscles: ['Bizeps'],
      unit: 'kg-reps',
      supportsBodyweightModes: false,
    }
    const inside = exercise('inside', snapshot, 50, 10)
    const outside = exercise('outside', snapshot, 100, 10)
    const result = getMuscleGroupAnalytics([
      { id: 'inside', name: 'Inside', startedAt: '2026-07-01T09:00:00Z', completedAt: '2026-07-01T10:00:00Z', exercises: [inside] },
      { id: 'outside', name: 'Outside', startedAt: '2026-06-01T09:00:00Z', completedAt: '2026-06-01T10:00:00Z', exercises: [outside] },
    ], RANGE)

    expect(result.find(({ muscleGroup }) => muscleGroup === 'Rücken')).toMatchObject({
      weightedSets: 1,
      volume: 500,
      setPercentage: 66.66666666666666,
      volumePercentage: 66.66666666666666,
    })
  })
})
