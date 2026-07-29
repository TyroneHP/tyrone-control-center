import { describe, expect, it } from 'vitest'
import type { CompletedWorkout, ExerciseSnapshot } from '../model/trainingTypes'
import { getTrainingHeatmap } from './heatmapAnalytics'

const SNAPSHOT: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: [], unit: 'kg-reps', supportsBodyweightModes: false,
}

function workout(id: string, completedAt: string, completedSets: number, targetSets = 2): CompletedWorkout {
  return {
    id,
    name: `Training ${id}`,
    startedAt: new Date(Date.parse(completedAt) - 60 * 60 * 1000).toISOString(),
    completedAt,
    exercises: [{
      id: `${id}-entry`, exerciseId: 'bench', exerciseSnapshot: SNAPSHOT,
      order: 0, targetSets, repMin: 8, repMax: 12, loadMode: 'external', note: '',
      sets: Array.from({ length: targetSets }, (_, index) => ({
        id: `${id}-set-${index}`, weightKg: 80, reps: 10, rating: 7,
        completed: index < completedSets,
      })),
    }],
  }
}

describe('training heatmap', () => {
  it('groups multiple workouts per local day and retains complete and incomplete references', () => {
    const complete = workout('complete', '2026-07-10T10:00:00.000Z', 2)
    const incomplete = workout('incomplete', '2026-07-10T18:00:00.000Z', 1)
    const result = getTrainingHeatmap([complete, incomplete], {
      startDate: '2026-07-01', endDate: '2026-07-31',
    })

    expect(result).toHaveLength(31)
    expect(result.find(({ date }) => date === '2026-07-10')).toEqual({
      date: '2026-07-10',
      completedSetCount: 3,
      hasCompleteWorkout: true,
      hasIncompleteWorkout: true,
      workouts: [
        { workoutId: 'complete', workoutName: 'Training complete', durationMinutes: 60, exerciseCount: 1, completedSetCount: 2, status: 'complete' },
        { workoutId: 'incomplete', workoutName: 'Training incomplete', durationMinutes: 60, exerciseCount: 1, completedSetCount: 1, status: 'incomplete' },
      ],
    })
  })

  it('filters by local date and orders days chronologically', () => {
    const result = getTrainingHeatmap([
      workout('later', '2026-07-12T10:00:00.000Z', 2),
      workout('outside', '2026-06-30T10:00:00.000Z', 2),
      workout('earlier', '2026-07-02T10:00:00.000Z', 2),
    ], { startDate: '2026-07-01', endDate: '2026-07-31' })
    expect(result).toHaveLength(31)
    expect(result[0].date).toBe('2026-07-01')
    expect(result.at(-1)?.date).toBe('2026-07-31')
    expect(result.find(({ date }) => date === '2026-07-03')).toMatchObject({
      completedSetCount: 0,
      workouts: [],
    })
  })
})
