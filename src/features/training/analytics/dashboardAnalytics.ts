import type {
  BodyWeightEntry,
  CompletedWorkout,
} from '../model/trainingTypes'
import { getBodyWeightSummary } from './bodyWeightAnalytics'
import {
  isDateKeyInRange,
  toLocalDateKey,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'
import { roundAnalyticsValue } from './loadAnalytics'
import { getAllExerciseRecordHistory } from './recordAnalytics'
import {
  getCompletedSetCount,
  getWorkoutDurationMinutes,
} from './workoutCompletion'

export interface DashboardMetrics {
  workoutCount: number
  completedSetCount: number
  newRecordCount: number
  bodyWeightChangeKg?: number
  workoutDays: number
  workoutsPerWeek: number
  totalDurationMinutes?: number
}

function getInclusiveDays(range: AnalyticsDateRange) {
  const toOrdinal = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  }
  return toOrdinal(range.endDate) - toOrdinal(range.startDate) + 1
}

export function getDashboardMetrics(
  workouts: readonly CompletedWorkout[],
  bodyWeights: readonly BodyWeightEntry[],
  range: AnalyticsDateRange,
): DashboardMetrics {
  const selected = workouts.filter((workout) => {
    try {
      return isDateKeyInRange(toLocalDateKey(workout.completedAt), range)
    } catch {
      return false
    }
  })
  const workoutDays = new Set(
    selected.map(({ completedAt }) => toLocalDateKey(completedAt)),
  ).size
  const durations = selected.map(getWorkoutDurationMinutes)
  const durationReliable = durations.every(
    (duration): duration is number => duration !== undefined,
  )
  const bodyWeightSummary = getBodyWeightSummary(bodyWeights, range)
  const newRecordCount = getAllExerciseRecordHistory(workouts).filter(
    ({ date }) => isDateKeyInRange(date, range),
  ).length
  const weeks = Math.max(1, getInclusiveDays(range) / 7)

  return {
    workoutCount: selected.length,
    completedSetCount: selected.reduce(
      (total, workout) => total + getCompletedSetCount(workout),
      0,
    ),
    newRecordCount,
    bodyWeightChangeKg: bodyWeightSummary.changeInRangeKg,
    workoutDays,
    workoutsPerWeek: roundAnalyticsValue(selected.length / weeks, 2),
    totalDurationMinutes: durationReliable
      ? durations.reduce((total, duration) => total + duration, 0)
      : undefined,
  }
}
