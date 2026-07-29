import type { CompletedWorkout } from '../model/trainingTypes'
import {
  isDateKeyInRange,
  toLocalDateKey,
  type AnalyticsDateRange,
} from './dateRangeAnalytics'
import { getSetVolume } from './loadAnalytics'

export interface MuscleExerciseContribution {
  exerciseId: string
  exerciseName: string
  weightedSets: number
  volume: number
}

export interface MuscleSessionContribution {
  workoutId: string
  weightedSets: number
  volume: number
}

export interface MuscleGroupResult {
  muscleGroup: string
  weightedSets: number
  volume: number
  setPercentage: number
  volumePercentage: number
  contributions: MuscleExerciseContribution[]
  sessions: MuscleSessionContribution[]
}

interface MutableMuscleResult {
  weightedSets: number
  volume: number
  contributions: Map<string, MuscleExerciseContribution>
  sessions: Map<string, MuscleSessionContribution>
}

function getOrCreate(
  values: Map<string, MutableMuscleResult>,
  muscleGroup: string,
) {
  let result = values.get(muscleGroup)
  if (!result) {
    result = {
      weightedSets: 0,
      volume: 0,
      contributions: new Map(),
      sessions: new Map(),
    }
    values.set(muscleGroup, result)
  }
  return result
}

function addContribution(
  values: Map<string, MutableMuscleResult>,
  muscleGroup: string,
  weight: number,
  workoutId: string,
  exerciseId: string,
  exerciseName: string,
  setVolume: number | undefined,
) {
  const result = getOrCreate(values, muscleGroup)
  const volume = (setVolume ?? 0) * weight
  result.weightedSets += weight
  result.volume += volume

  const exercise = result.contributions.get(exerciseId) ?? {
    exerciseId,
    exerciseName,
    weightedSets: 0,
    volume: 0,
  }
  exercise.weightedSets += weight
  exercise.volume += volume
  result.contributions.set(exerciseId, exercise)

  const session = result.sessions.get(workoutId) ?? {
    workoutId,
    weightedSets: 0,
    volume: 0,
  }
  session.weightedSets += weight
  session.volume += volume
  result.sessions.set(workoutId, session)
}

export function getMuscleGroupAnalytics(
  workouts: readonly CompletedWorkout[],
  range: AnalyticsDateRange,
): MuscleGroupResult[] {
  const values = new Map<string, MutableMuscleResult>()

  for (const workout of workouts) {
    let date: string
    try {
      date = toLocalDateKey(workout.completedAt)
    } catch {
      continue
    }
    if (!isDateKeyInRange(date, range)) continue

    for (const exercise of workout.exercises) {
      const weights = new Map<string, number>()
      for (const muscle of exercise.exerciseSnapshot.primaryMuscles) {
        weights.set(muscle, 1)
      }
      for (const muscle of exercise.exerciseSnapshot.secondaryMuscles) {
        if (!weights.has(muscle)) weights.set(muscle, 0.5)
      }

      for (const set of exercise.sets) {
        if (!set.completed) continue
        const volume = getSetVolume(exercise, set)
        for (const [muscle, weight] of weights) {
          addContribution(
            values,
            muscle,
            weight,
            workout.id,
            exercise.exerciseId,
            exercise.exerciseSnapshot.name,
            volume,
          )
        }
      }
    }
  }

  const totalSets = [...values.values()].reduce(
    (total, value) => total + value.weightedSets,
    0,
  )
  const totalVolume = [...values.values()].reduce(
    (total, value) => total + value.volume,
    0,
  )

  return [...values.entries()]
    .map(([muscleGroup, value]) => ({
      muscleGroup,
      weightedSets: value.weightedSets,
      volume: value.volume,
      setPercentage:
        totalSets === 0 ? 0 : (value.weightedSets / totalSets) * 100,
      volumePercentage:
        totalVolume === 0 ? 0 : (value.volume / totalVolume) * 100,
      contributions: [...value.contributions.values()].sort(
        (left, right) => right.weightedSets - left.weightedSets,
      ),
      sessions: [...value.sessions.values()],
    }))
    .sort(
      (left, right) =>
        right.weightedSets - left.weightedSets ||
        left.muscleGroup.localeCompare(right.muscleGroup, 'de'),
    )
}
