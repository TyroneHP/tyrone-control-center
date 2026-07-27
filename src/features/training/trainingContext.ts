import { createContext } from 'react'
import type {
  CompletedWorkout,
  ExerciseDefinition,
  TrainingPreferences,
  TrainingState,
  WorkoutTemplate,
} from './model/trainingTypes'
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
  completeWorkout: (completedAt: string) => void
  deleteCompletedWorkout: (workoutId: string) => void
  deleteCustomExercise: (exerciseId: string) => void
  deleteWorkoutTemplate: (templateId: string) => void
  discardWorkout: () => void
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
  ) => void
  saveCustomExercise: (exercise: ExerciseDefinition) => void
  saveWorkoutTemplate: (template: WorkoutTemplate) => void
  startWorkout: (template: WorkoutTemplate, startedAt: string) => void
  toggleFavoriteExercise: (exerciseId: string) => void
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
