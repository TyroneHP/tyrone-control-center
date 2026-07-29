import type {
  CompletedWorkout,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import {
  isDateKeyInRange,
  toLocalDateKey,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'
import { sortCompletedWorkouts } from './exerciseAnalytics'
import { getSetLoadKg, getSetVolume } from './loadAnalytics'

export type ExerciseRecordType = 'weight' | 'setVolume' | 'reps'

export interface RecordHistoryEntry {
  recordType: ExerciseRecordType
  value: number
  previousValue?: number
  date: string
  completedAt: string
  exerciseId: string
  exerciseName: string
  primaryMuscles: string[]
  workoutId: string
  workoutName: string
  exerciseEntryId: string
  setId: string
  setNumber: number
  grip?: string
  weightKg: number | null
  reps: number | null
  rating: number | null
}

export type ExerciseRecordSummary = RecordHistoryEntry

const RECORD_TYPES: ExerciseRecordType[] = ['weight', 'setVolume', 'reps']

function getCandidate(
  type: ExerciseRecordType,
  exercise: WorkoutExerciseEntry,
  set: WorkoutSetEntry,
) {
  if (type === 'weight') return getSetLoadKg(exercise, set)
  if (type === 'setVolume') return getSetVolume(exercise, set)
  return set.completed &&
    set.reps !== null &&
    Number.isInteger(set.reps) &&
    set.reps > 0
    ? set.reps
    : undefined
}

function inOptionalRange(date: string, range?: AnalyticsDateRange) {
  return range === undefined || isDateKeyInRange(date, range)
}

function buildHistory(
  workouts: readonly CompletedWorkout[],
  range?: AnalyticsDateRange,
) {
  const current = new Map<string, number>()
  const history: RecordHistoryEntry[] = []

  for (const workout of sortCompletedWorkouts(workouts)) {
    let date: string
    try {
      date = toLocalDateKey(workout.completedAt)
    } catch {
      continue
    }
    if (!inOptionalRange(date, range)) continue

    for (const exercise of workout.exercises) {
      for (const [setIndex, set] of exercise.sets.entries()) {
        for (const recordType of RECORD_TYPES) {
          const value = getCandidate(recordType, exercise, set)
          if (value === undefined) continue
          const key = `${exercise.exerciseId}:${recordType}`
          const previousValue = current.get(key)
          if (previousValue !== undefined && value <= previousValue) continue
          current.set(key, value)
          history.push({
            recordType,
            value,
            ...(previousValue === undefined ? {} : { previousValue }),
            date,
            completedAt: workout.completedAt,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseSnapshot.name,
            primaryMuscles: [...exercise.exerciseSnapshot.primaryMuscles],
            workoutId: workout.id,
            workoutName: workout.name,
            exerciseEntryId: exercise.id,
            setId: set.id,
            setNumber: setIndex + 1,
            ...(exercise.grip === undefined ? {} : { grip: exercise.grip }),
            weightKg: set.weightKg,
            reps: set.reps,
            rating: set.rating,
          })
        }
      }
    }
  }
  return history
}

export function getAllExerciseRecordHistory(
  workouts: readonly CompletedWorkout[],
) {
  return buildHistory(workouts)
}

export function getExerciseRecordHistory(
  workouts: readonly CompletedWorkout[],
  exerciseId: string,
  range?: AnalyticsDateRange,
) {
  return buildHistory(workouts, range).filter(
    (entry) => entry.exerciseId === exerciseId,
  )
}

export function getExerciseRecords(
  workouts: readonly CompletedWorkout[],
  range?: AnalyticsDateRange,
): ExerciseRecordSummary[] {
  const currentRecords = new Map<string, RecordHistoryEntry>()
  for (const entry of buildHistory(workouts, range)) {
    currentRecords.set(`${entry.exerciseId}:${entry.recordType}`, entry)
  }

  return [...currentRecords.values()].sort((left, right) => {
    const nameOrder = left.exerciseName.localeCompare(right.exerciseName, 'de')
    if (nameOrder !== 0) return nameOrder
    return RECORD_TYPES.indexOf(left.recordType) - RECORD_TYPES.indexOf(right.recordType)
  })
}
