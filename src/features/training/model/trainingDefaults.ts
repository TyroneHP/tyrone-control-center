import type {
  AnalyticsPreferences,
  TrainingPreferences,
  TrainingState,
} from './trainingTypes'

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  showSetRating: true,
  progressionEnabled: true,
  successfulWorkoutCount: 3,
  maximumAverageRating: 8,
  defaultIncrementKg: 2.5,
}

export const DEFAULT_ANALYTICS_PREFERENCES: AnalyticsPreferences = {
  range: { preset: '30d' },
  exerciseMetric: 'weight',
  muscleMetric: 'sets',
  dismissedBalanceInsightIds: [],
}

export const EMPTY_TRAINING_STATE: TrainingState = {
  schemaVersion: 2,
  customExercises: [],
  favoriteExerciseIds: [],
  templates: [],
  activeWorkout: null,
  completedWorkouts: [],
  bodyWeightEntries: [],
  analyticsPreferences: DEFAULT_ANALYTICS_PREFERENCES,
  preferences: DEFAULT_TRAINING_PREFERENCES,
}
