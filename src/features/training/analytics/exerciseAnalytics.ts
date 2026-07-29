import type {
  CompletedWorkout,
  ExerciseMetric,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'
import {
  estimateOneRepMax,
  getSetLoadKg,
  getSetVolume,
} from './loadAnalytics'
import {
  isDateKeyInRange,
  toLocalDateKey,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'

export interface ExerciseSetDetail {
  exerciseEntryId: string
  setId: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  rating: number | null
  completed: boolean
  loadKg?: number
  volume?: number
  oneRepMax?: number
}

export interface ExerciseDataPoint {
  workoutId: string
  workoutName: string
  completedAt: string
  date: string
  exerciseId: string
  exerciseName: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  exerciseEntryIds: string[]
  grips: string[]
  value: number
  sets: ExerciseSetDetail[]
}

export function sortCompletedWorkouts(
  workouts: readonly CompletedWorkout[],
) {
  return workouts
    .map((workout, index) => ({ workout, index }))
    .sort((left, right) => {
      const timeDifference =
        Date.parse(left.workout.completedAt) -
        Date.parse(right.workout.completedAt)
      return timeDifference || left.index - right.index
    })
    .map(({ workout }) => workout)
}

function getSetDetail(
  entry: WorkoutExerciseEntry,
  set: WorkoutSetEntry,
  setNumber: number,
): ExerciseSetDetail {
  return {
    exerciseEntryId: entry.id,
    setId: set.id,
    setNumber,
    weightKg: set.weightKg,
    reps: set.reps,
    rating: set.rating,
    completed: set.completed,
    loadKg: getSetLoadKg(entry, set),
    volume: getSetVolume(entry, set),
    oneRepMax: estimateOneRepMax(entry, set),
  }
}

function validCompletedReps(set: WorkoutSetEntry) {
  return set.completed &&
    set.reps !== null &&
    Number.isInteger(set.reps) &&
    set.reps > 0
    ? set.reps
    : undefined
}

function aggregateMetric(
  entries: readonly WorkoutExerciseEntry[],
  metric: ExerciseMetric,
) {
  const candidates = entries.flatMap((entry) =>
    entry.sets.map((set) => {
      if (metric === 'weight') return getSetLoadKg(entry, set)
      if (metric === 'reps') return validCompletedReps(set)
      if (metric === 'volume') return getSetVolume(entry, set)
      return estimateOneRepMax(entry, set)
    }),
  ).filter((value): value is number => value !== undefined)

  if (candidates.length === 0) return undefined
  return metric === 'volume'
    ? candidates.reduce((total, value) => total + value, 0)
    : Math.max(...candidates)
}

export function getExerciseSeries(
  workouts: readonly CompletedWorkout[],
  exerciseId: string,
  metric: ExerciseMetric,
  range: AnalyticsDateRange,
): ExerciseDataPoint[] {
  return sortCompletedWorkouts(workouts).flatMap((workout) => {
    let date: string
    try {
      date = toLocalDateKey(workout.completedAt)
    } catch {
      return []
    }
    if (!isDateKeyInRange(date, range)) return []

    const entries = workout.exercises.filter(
      (entry) => entry.exerciseId === exerciseId,
    )
    if (entries.length === 0) return []
    const value = aggregateMetric(entries, metric)
    if (value === undefined) return []
    const snapshot = entries[0].exerciseSnapshot

    return [{
      workoutId: workout.id,
      workoutName: workout.name,
      completedAt: workout.completedAt,
      date,
      exerciseId,
      exerciseName: snapshot.name,
      primaryMuscles: [...snapshot.primaryMuscles],
      secondaryMuscles: [...snapshot.secondaryMuscles],
      exerciseEntryIds: entries.map(({ id }) => id),
      grips: [
        ...new Set(
          entries.flatMap(({ grip }) => (grip === undefined ? [] : [grip])),
        ),
      ],
      value,
      sets: entries.flatMap((entry) =>
        entry.sets.map((set, index) => getSetDetail(entry, set, index + 1)),
      ),
    }]
  })
}
