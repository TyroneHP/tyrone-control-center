import type { CompletedWorkout } from '../model/trainingTypes'
import type { MuscleGroupResult } from './muscleGroupAnalytics'
import { isWorkoutFullyComplete } from './workoutCompletion'

export const BALANCE_INSIGHT_THRESHOLDS = {
  minimumCompleteWorkouts: 5,
  comparisonMinimumWeightedSets: 8,
  smallerSideRatio: 0.5,
} as const

export interface BalanceInsight {
  id: string
  smallerGroupLabel: string
  comparisonGroupLabel: string
  smallerWeightedSets: number
  comparisonWeightedSets: number
  message: string
}

interface BalanceRule {
  id: string
  smallerGroupLabel: string
  comparisonGroupLabel: string
  smallerMuscles: string[]
  comparisonMuscles: string[]
}

const RULES: BalanceRule[] = [
  {
    id: 'back-versus-chest',
    smallerGroupLabel: 'Rücken',
    comparisonGroupLabel: 'Brust',
    smallerMuscles: ['Latissimus', 'Mittlerer Rücken', 'Rückenstrecker', 'Rücken'],
    comparisonMuscles: ['Brust', 'Obere Brust'],
  },
  {
    id: 'rear-shoulder-versus-front',
    smallerGroupLabel: 'Hintere Schulter',
    comparisonGroupLabel: 'Brust und vordere Schulter',
    smallerMuscles: ['Hintere Schulter'],
    comparisonMuscles: ['Brust', 'Obere Brust', 'Vordere Schulter'],
  },
  {
    id: 'legs-versus-upper-body',
    smallerGroupLabel: 'Beine und Gesäß',
    comparisonGroupLabel: 'Oberkörper',
    smallerMuscles: ['Quadrizeps', 'Beinbeuger', 'Gesäß', 'Waden'],
    comparisonMuscles: [
      'Brust', 'Obere Brust', 'Latissimus', 'Mittlerer Rücken',
      'Rückenstrecker', 'Rücken', 'Schultern', 'Vordere Schulter',
      'Seitliche Schulter', 'Hintere Schulter', 'Bizeps', 'Brachialis',
      'Trizeps',
    ],
  },
]

function sumCompleteSets(
  muscles: readonly MuscleGroupResult[],
  names: readonly string[],
  completeWorkoutIds: ReadonlySet<string>,
) {
  const included = new Set(names)
  return muscles
    .filter(({ muscleGroup }) => included.has(muscleGroup))
    .flatMap(({ sessions }) => sessions)
    .filter(({ workoutId }) => completeWorkoutIds.has(workoutId))
    .reduce((total, { weightedSets }) => total + weightedSets, 0)
}

export function getBalanceInsights(
  workouts: readonly CompletedWorkout[],
  muscleGroups: readonly MuscleGroupResult[],
  dismissedIds: readonly string[],
): BalanceInsight[] {
  const completeWorkoutIds = new Set(
    workouts.filter(isWorkoutFullyComplete).map(({ id }) => id),
  )
  if (
    completeWorkoutIds.size <
    BALANCE_INSIGHT_THRESHOLDS.minimumCompleteWorkouts
  ) {
    return []
  }
  const dismissed = new Set(dismissedIds)

  return RULES.flatMap((rule) => {
    if (dismissed.has(rule.id)) return []
    const smallerWeightedSets = sumCompleteSets(
      muscleGroups,
      rule.smallerMuscles,
      completeWorkoutIds,
    )
    const comparisonWeightedSets = sumCompleteSets(
      muscleGroups,
      rule.comparisonMuscles,
      completeWorkoutIds,
    )
    if (
      comparisonWeightedSets <
        BALANCE_INSIGHT_THRESHOLDS.comparisonMinimumWeightedSets ||
      smallerWeightedSets >=
        comparisonWeightedSets *
          BALANCE_INSIGHT_THRESHOLDS.smallerSideRatio
    ) {
      return []
    }

    return [{
      id: rule.id,
      smallerGroupLabel: rule.smallerGroupLabel,
      comparisonGroupLabel: rule.comparisonGroupLabel,
      smallerWeightedSets,
      comparisonWeightedSets,
      message: `${rule.smallerGroupLabel} wurde im ausgewählten Zeitraum deutlich weniger belastet als ${rule.comparisonGroupLabel}. Diese Orientierung basiert auf vollständig abgeschlossenen Trainings.`,
    }]
  })
}
