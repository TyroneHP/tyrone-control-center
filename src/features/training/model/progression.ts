import type {
  CompletedWorkout,
  LoadMode,
  TrainingPreferences,
  WorkoutExerciseEntry,
  WorkoutSetEntry,
} from './trainingTypes'

export interface ProgressionRecommendation {
  exerciseId: string
  currentWeightKg: number
  suggestedWeightKg: number
  successfulWorkoutCount: number
}

interface ExerciseOccurrence {
  completedAt: string
  entry: WorkoutExerciseEntry
}

interface CountedSet {
  loadMode: LoadMode
  weightKg: number
  reps: number
  rating: number | null
  repMax: number
}

function requiresLoadValue(loadMode: LoadMode): boolean {
  return loadMode !== 'bodyweight'
}

function isEligibleSet(
  set: WorkoutSetEntry,
  loadMode: LoadMode,
): set is WorkoutSetEntry & { reps: number } {
  return (
    set.completed &&
    set.reps !== null &&
    (!requiresLoadValue(loadMode) || set.weightKg !== null)
  )
}

function getExerciseOccurrences(
  exerciseId: string,
  completedWorkouts: readonly CompletedWorkout[],
): ExerciseOccurrence[] {
  return completedWorkouts
    .flatMap((workout) =>
      workout.exercises
        .filter((entry) => entry.exerciseId === exerciseId)
        .map((entry) => ({ completedAt: workout.completedAt, entry })),
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    )
}

function getCountedSets(
  occurrences: readonly ExerciseOccurrence[],
): CountedSet[] | null {
  const countedSets: CountedSet[] = []

  for (const { entry } of occurrences) {
    const eligibleSets = entry.sets.filter((set) =>
      isEligibleSet(set, entry.loadMode),
    )
    if (eligibleSets.length === 0) {
      return null
    }

    countedSets.push(
      ...eligibleSets.map((set) => ({
        loadMode: entry.loadMode,
        weightKg:
          entry.loadMode === 'bodyweight' ? 0 : (set.weightKg as number),
        reps: set.reps,
        rating: set.rating,
        repMax: entry.repMax,
      })),
    )
  }

  return countedSets
}

export function getProgressionRecommendation(
  exerciseId: string,
  completedWorkouts: readonly CompletedWorkout[],
  preferences: TrainingPreferences,
): ProgressionRecommendation | null {
  if (!preferences.progressionEnabled) {
    return null
  }

  const occurrences = getExerciseOccurrences(
    exerciseId,
    completedWorkouts,
  ).slice(0, preferences.successfulWorkoutCount)
  if (occurrences.length < preferences.successfulWorkoutCount) {
    return null
  }

  const countedSets = getCountedSets(occurrences)
  if (!countedSets) {
    return null
  }

  if (countedSets.some(({ reps, repMax }) => reps < repMax)) {
    return null
  }

  if (preferences.showSetRating) {
    if (countedSets.some(({ rating }) => rating === null)) {
      return null
    }
    const averageRating =
      countedSets.reduce((total, { rating }) => total + (rating as number), 0) /
      countedSets.length
    if (averageRating > preferences.maximumAverageRating) {
      return null
    }
  }

  const loadModes = new Set(countedSets.map(({ loadMode }) => loadMode))
  const weights = new Set(countedSets.map(({ weightKg }) => weightKg))
  if (loadModes.size !== 1 || weights.size !== 1) {
    return null
  }

  const loadMode = countedSets[0].loadMode
  const currentWeightKg = countedSets[0].weightKg
  const suggestedWeightKg =
    loadMode === 'assisted'
      ? Math.max(0, currentWeightKg - preferences.defaultIncrementKg)
      : currentWeightKg + preferences.defaultIncrementKg

  return {
    exerciseId,
    currentWeightKg,
    suggestedWeightKg,
    successfulWorkoutCount: preferences.successfulWorkoutCount,
  }
}
