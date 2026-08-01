import { describe, expect, it } from 'vitest'
import type { BodyWeightEntry, CompletedWorkout, ExerciseSnapshot } from '../model/trainingTypes'
import { getDashboardMetrics } from './dashboardAnalytics'

const SNAPSHOT: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: [], unit: 'kg-reps', supportsBodyweightModes: false,
}
const RANGE = { startDate: '2026-07-01', endDate: '2026-07-14' }

function workout(id: string, date: string, weightKg: number): CompletedWorkout {
  return {
    id, name: id, startedAt: `${date}T09:00:00.000Z`, completedAt: `${date}T10:00:00.000Z`,
    exercises: [{
      id: `${id}-entry`, exerciseId: 'bench', exerciseSnapshot: SNAPSHOT,
      order: 0, targetSets: 1, repMin: 8, repMax: 12, loadMode: 'external', note: '',
      sets: [{ id: `${id}-set`, weightKg, reps: 8, rating: 7, completed: true }],
    }],
  }
}

function weight(id: string, date: string, weightKg: number): BodyWeightEntry {
  return { id, date, weightKg, note: '', createdAt: `${date}T06:00:00Z`, updatedAt: `${date}T06:00:00Z` }
}

describe('dashboard metrics', () => {
  it('calculates sessions, sets, records, duration, frequency and body-weight change', () => {
    const historical = workout('outside', '2026-06-20', 40)
    historical.exercises[0].sets[0].reps = 4
    const result = getDashboardMetrics(
      [workout('one', '2026-07-01', 50), workout('two', '2026-07-08', 55), historical],
      [weight('first', '2026-07-01', 80), weight('last', '2026-07-12', 78)],
      RANGE,
    )

    expect(result).toEqual({
      workoutCount: 2,
      completedSetCount: 2,
      newRecordCount: 5,
      bodyWeightChangeKg: -2,
      workoutDays: 2,
      workoutsPerWeek: 1,
      totalDurationMinutes: 120,
    })
  })

  it('uses undefined for unavailable body weight or unreliable duration', () => {
    const invalidDuration = workout('invalid', '2026-07-01', 50)
    invalidDuration.startedAt = 'invalid'
    expect(getDashboardMetrics([invalidDuration], [], RANGE)).toMatchObject({
      bodyWeightChangeKg: undefined,
      totalDurationMinutes: undefined,
    })
  })

  it('returns truthful empty metrics without invented body-weight values', () => {
    expect(getDashboardMetrics([], [], RANGE)).toEqual({
      workoutCount: 0,
      completedSetCount: 0,
      newRecordCount: 0,
      bodyWeightChangeKg: undefined,
      workoutDays: 0,
      workoutsPerWeek: 0,
      totalDurationMinutes: 0,
    })
  })
})
