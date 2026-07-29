import type { TrainingPreferences, TrainingState } from './trainingTypes'

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  showSetRating: true,
  progressionEnabled: true,
  successfulWorkoutCount: 3,
  maximumAverageRating: 8,
  defaultIncrementKg: 2.5,
}

export const EMPTY_TRAINING_STATE: TrainingState = {
  schemaVersion: 1,
  customExercises: [],
  favoriteExerciseIds: [],
  templates: [],
  activeWorkout: null,
  completedWorkouts: [],
  preferences: DEFAULT_TRAINING_PREFERENCES,
}
