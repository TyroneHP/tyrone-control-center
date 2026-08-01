import type {
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from '../model/trainingTypes'

function isValidNonNegative(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0
}

function isValidRepetitionCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0
}

export function getSetLoadKg(
  exercise: WorkoutExerciseEntry,
  set: WorkoutSetEntry,
): number | undefined {
  if (!set.completed) return undefined

  if (!exercise.exerciseSnapshot.supportsBodyweightModes) {
    if (exercise.exerciseSnapshot.unit !== 'kg-reps') return undefined
    return isValidNonNegative(set.weightKg) ? set.weightKg : undefined
  }

  const bodyWeightKg = exercise.bodyWeightSnapshot?.weightKg
  if (bodyWeightKg === undefined || !isValidNonNegative(bodyWeightKg)) {
    return undefined
  }

  if (exercise.loadMode === 'bodyweight') return bodyWeightKg
  if (!isValidNonNegative(set.weightKg)) return undefined
  if (exercise.loadMode === 'added') return bodyWeightKg + set.weightKg
  if (exercise.loadMode === 'assisted') {
    return Math.max(0, bodyWeightKg - set.weightKg)
  }
  return undefined
}

export function getSetVolume(
  exercise: WorkoutExerciseEntry,
  set: WorkoutSetEntry,
): number | undefined {
  const loadKg = getSetLoadKg(exercise, set)
  if (loadKg === undefined || !isValidRepetitionCount(set.reps)) {
    return undefined
  }
  return loadKg * set.reps
}

export function estimateOneRepMax(
  exercise: WorkoutExerciseEntry,
  set: WorkoutSetEntry,
): number | undefined {
  const loadKg = getSetLoadKg(exercise, set)
  if (
    loadKg === undefined ||
    !isValidRepetitionCount(set.reps) ||
    set.reps > 12
  ) {
    return undefined
  }
  return loadKg * (1 + set.reps / 30)
}

export function roundAnalyticsValue(value: number, digits = 2) {
  if (!Number.isFinite(value)) return value
  const [coefficient, exponent = '0'] = value.toString().split('e')
  const shifted = Math.round(
    Number(`${coefficient}e${Number(exponent) + digits}`),
  )
  return Number(`${shifted}e${-digits}`)
}
