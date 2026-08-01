import type { CompletedWorkout } from '../model/trainingTypes'

export function isWorkoutFullyComplete(workout: CompletedWorkout) {
  return (
    workout.exercises.length > 0 &&
    workout.exercises.every(
      (exercise) =>
        exercise.sets.filter(({ completed }) => completed).length >=
        exercise.targetSets,
    )
  )
}

export function getCompletedSetCount(workout: CompletedWorkout) {
  return workout.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter(({ completed }) => completed).length,
    0,
  )
}

export function getWorkoutDurationMinutes(workout: CompletedWorkout) {
  const startedAt = Date.parse(workout.startedAt)
  const completedAt = Date.parse(workout.completedAt)
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt
  ) {
    return undefined
  }
  return Math.round((completedAt - startedAt) / 60_000)
}
