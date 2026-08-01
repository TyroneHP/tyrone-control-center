import { describe, expect, it } from 'vitest'
import type { CompletedWorkout, ExerciseSnapshot } from '../model/trainingTypes'
import { getMuscleGroupAnalytics } from './muscleGroupAnalytics'
import {
  BALANCE_INSIGHT_THRESHOLDS,
  getBalanceInsights,
} from './balanceInsightAnalytics'

const RANGE = { startDate: '2026-07-01', endDate: '2026-07-31' }
const CHEST: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: [], unit: 'kg-reps', supportsBodyweightModes: false,
}

function chestWorkout(index: number, completedSets = 2): CompletedWorkout {
  return {
    id: `workout-${index}`,
    name: `Push ${index}`,
    startedAt: `2026-07-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
    completedAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    exercises: [{
      id: `entry-${index}`,
      exerciseId: CHEST.exerciseId,
      exerciseSnapshot: CHEST,
      order: 0,
      targetSets: 2,
      repMin: 8,
      repMax: 12,
      loadMode: 'external',
      note: '',
      sets: [0, 1].map((setIndex) => ({
        id: `set-${index}-${setIndex}`,
        weightKg: 80,
        reps: 10,
        rating: 7,
        completed: setIndex < completedSets,
      })),
    }],
  }
}

describe('balance insights', () => {
  it('keeps the qualification and ratio thresholds central', () => {
    expect(BALANCE_INSIGHT_THRESHOLDS).toEqual({
      minimumCompleteWorkouts: 5,
      comparisonMinimumWeightedSets: 8,
      smallerSideRatio: 0.5,
    })
  })

  it('requires five fully complete workouts and excludes incomplete sessions', () => {
    const fourComplete = [0, 1, 2, 3].map((index) => chestWorkout(index))
    const incomplete = chestWorkout(4, 1)
    expect(
      getBalanceInsights(
        [...fourComplete, incomplete],
        getMuscleGroupAnalytics([...fourComplete, incomplete], RANGE),
        [],
      ),
    ).toEqual([])

    const fiveComplete = [...fourComplete, chestWorkout(5)]
    expect(
      getBalanceInsights(
        fiveComplete,
        getMuscleGroupAnalytics(fiveComplete, RANGE),
        [],
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'back-versus-chest',
          smallerGroupLabel: 'Rücken',
          comparisonGroupLabel: 'Brust',
        }),
      ]),
    )
  })

  it('requires the comparison side to reach eight sets and the smaller side to stay below 50%', () => {
    const workouts = [0, 1, 2, 3, 4].map((index) => chestWorkout(index, index < 3 ? 1 : 2))
    const muscles = getMuscleGroupAnalytics(workouts, RANGE)
    expect(getBalanceInsights(workouts, muscles, [])).toEqual([])

    const qualifying = [0, 1, 2, 3, 4].map((index) => chestWorkout(index))
    expect(getBalanceInsights(qualifying, getMuscleGroupAnalytics(qualifying, RANGE), [])).not.toEqual([])
  })

  it('uses stable dismissible IDs and neutral non-medical wording', () => {
    const workouts = [0, 1, 2, 3, 4].map((index) => chestWorkout(index))
    const muscles = getMuscleGroupAnalytics(workouts, RANGE)
    const insights = getBalanceInsights(workouts, muscles, [])
    const backInsight = insights.find(({ id }) => id === 'back-versus-chest')!

    expect(backInsight.message).toContain('Orientierung')
    expect(backInsight.message).not.toMatch(/Verletzung|Diagnose|Therapie/i)
    expect(getBalanceInsights(workouts, muscles, ['back-versus-chest'])).not.toContainEqual(backInsight)
  })
})
