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

function enumerateDateKeys(range: AnalyticsDateRange) {
  const parse = (key: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
    if (!match) return undefined
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  const current = parse(range.startDate)
  const end = parse(range.endDate)
  if (!current || !end || current > end) return []
  const keys: string[] = []
  const pad = (value: number) => String(value).padStart(2, '0')
  while (current <= end) {
    keys.push(`${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`)
    current.setDate(current.getDate() + 1)
  }
  return keys
}

export function getTrainingHeatmap(
  workouts: readonly CompletedWorkout[],
  range: AnalyticsDateRange,
): HeatmapDay[] {
  const days = new Map<string, HeatmapDay>(
    enumerateDateKeys(range).map((date) => [date, {
      date,
      completedSetCount: 0,
      hasCompleteWorkout: false,
      hasIncompleteWorkout: false,
      workouts: [],
    }]),
  )
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
