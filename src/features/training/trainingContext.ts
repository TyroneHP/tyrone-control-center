import { createContext } from 'react'
import type {
  CompletedWorkout,
  AnalyticsPreferences,
  ExerciseDefinition,
  TrainingPreferences,
  TrainingState,
  WorkoutTemplate,
} from './model/trainingTypes'
import type { BodyWeightEntryInput } from './model/bodyWeightModel'
import type {
  AddWorkoutExerciseInput,
  WorkoutExerciseChanges,
  WorkoutSetChanges,
} from './model/workoutModel'

export interface TrainingContextValue {
  state: TrainingState
  catalog: readonly ExerciseDefinition[]
  loading: boolean
  recoveryError: Error | null
  addWorkoutExercise: (
    input: AddWorkoutExerciseInput,
    updatedAt: string,
  ) => void
  addWorkoutSet: (exerciseEntryId: string, updatedAt: string) => void
  completeWorkout: (completedAt: string) => Promise<boolean>
  saveBodyWeightEntry: (
    input: BodyWeightEntryInput,
    timestamp: string,
  ) => Promise<boolean>
  moveBodyWeightEntry: (
    entryId: string,
    input: BodyWeightEntryInput,
    timestamp: string,
  ) => Promise<boolean>
  deleteBodyWeightEntry: (entryId: string) => Promise<boolean>
  deleteCompletedWorkout: (workoutId: string) => Promise<boolean>
  deleteCustomExercise: (exerciseId: string) => Promise<void>
  deleteImage: (imageId: string) => Promise<void>
  deleteWorkoutTemplate: (templateId: string) => void
  discardWorkout: () => Promise<boolean>
  exportRaw: () => Promise<string>
  loadImage: (imageId: string) => Promise<Blob | undefined>
  removeWorkoutExercise: (
    exerciseEntryId: string,
    updatedAt: string,
  ) => void
  removeWorkoutSet: (
    exerciseEntryId: string,
    setId: string,
    updatedAt: string,
  ) => void
  reorderWorkoutExercise: (
    exerciseEntryId: string,
    toIndex: number,
    updatedAt: string,
  ) => void
  replaceCompletedWorkout: (
    workoutId: string,
    replacement: CompletedWorkout,
  ) => Promise<boolean>
  refreshWorkoutBodyWeightSnapshots: (
    workoutId: string,
    capturedAt: string,
  ) => Promise<boolean>
  reset: () => Promise<void>
  resolveActiveWorkoutAndStart: (
    template: WorkoutTemplate,
    startedAt: string,
    resolution: 'complete' | 'discard',
  ) => Promise<boolean>
  saveCustomExercise: (exercise: ExerciseDefinition) => Promise<void>
  saveImage: (imageId: string, blob: Blob) => Promise<void>
  saveWorkoutTemplate: (template: WorkoutTemplate) => void
  startWorkout: (template: WorkoutTemplate, startedAt: string) => void
  toggleFavoriteExercise: (exerciseId: string) => void
  updateAnalyticsPreferences: (
    changes: Partial<AnalyticsPreferences>,
  ) => void
  dismissBalanceInsight: (insightId: string) => void
  updatePreferences: (changes: Partial<TrainingPreferences>) => void
  updateWorkoutExercise: (
    exerciseEntryId: string,
    changes: WorkoutExerciseChanges,
    updatedAt: string,
  ) => void
  updateWorkoutSet: (
    exerciseEntryId: string,
    setId: string,
    changes: WorkoutSetChanges,
    updatedAt: string,
  ) => void
}

export const TrainingContext = createContext<TrainingContextValue | null>(null)
