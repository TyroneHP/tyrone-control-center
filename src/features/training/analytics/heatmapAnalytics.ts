import type { CompletedWorkout } from '../model/trainingTypes'
import {
  isDateKeyInRange,
  toLocalDateKey,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'
import { sortCompletedWorkouts } from './exerciseAnalytics'
import {
  getCompletedSetCount,
  getWorkoutDurationMinutes,
  isWorkoutFullyComplete,
} from './workoutCompletion'

export interface HeatmapWorkoutReference {
  workoutId: string
  workoutName: string
  durationMinutes?: number
  exerciseCount: number
  completedSetCount: number
  status: 'complete' | 'incomplete'
}

export interface HeatmapDay {
  date: string
  completedSetCount: number
  hasCompleteWorkout: boolean
  hasIncompleteWorkout: boolean
  workouts: HeatmapWorkoutReference[]
}

export function getTrainingHeatmap(
  workouts: readonly CompletedWorkout[],
  range: AnalyticsDateRange,
): HeatmapDay[] {
  const days = new Map<string, HeatmapDay>()
  for (const workout of sortCompletedWorkouts(workouts)) {
    let date: string
    try {
      date = toLocalDateKey(workout.completedAt)
    } catch {
      continue
    }
    if (!isDateKeyInRange(date, range)) continue

    const complete = isWorkoutFullyComplete(workout)
    const completedSetCount = getCompletedSetCount(workout)
    const day = days.get(date) ?? {
      date,
      completedSetCount: 0,
      hasCompleteWorkout: false,
      hasIncompleteWorkout: false,
      workouts: [],
    }
    day.completedSetCount += completedSetCount
    day.hasCompleteWorkout ||= complete
    day.hasIncompleteWorkout ||= !complete
    day.workouts.push({
      workoutId: workout.id,
      workoutName: workout.name,
      durationMinutes: getWorkoutDurationMinutes(workout),
      exerciseCount: workout.exercises.length,
      completedSetCount,
      status: complete ? 'complete' : 'incomplete',
    })
    days.set(date, day)
  }
  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date))
}
