export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ExerciseSource = 'standard' | 'custom'
export type LoadMode = 'external' | 'bodyweight' | 'added' | 'assisted'
export type ExerciseUnit = 'kg-reps' | 'reps' | 'seconds'

export interface ExerciseDefinition {
  id: string
  source: ExerciseSource
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string[]
  unit: ExerciseUnit
  description: string
  gripOptions: string[]
  supportsBodyweightModes: boolean
  illustrationPath?: string
  customImageId?: string
}

export interface WorkoutTemplateExercise {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  preferredGrip?: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  weekdays: Weekday[]
  exercises: WorkoutTemplateExercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutSetEntry {
  id: string
  weightKg: number | null
  reps: number | null
  rating: number | null
  completed: boolean
}

export interface WorkoutExerciseEntry {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
  grip?: string
  loadMode: LoadMode
  note: string
  sets: WorkoutSetEntry[]
}

export interface ActiveWorkout {
  id: string
  templateId?: string
  name: string
  startedAt: string
  updatedAt: string
  exercises: WorkoutExerciseEntry[]
}

export interface CompletedWorkout extends Omit<ActiveWorkout, 'updatedAt'> {
  completedAt: string
}

export interface TrainingPreferences {
  showSetRating: boolean
  progressionEnabled: boolean
  successfulWorkoutCount: number
  maximumAverageRating: number
  defaultIncrementKg: number
}

export interface TrainingState {
  schemaVersion: 1
  customExercises: ExerciseDefinition[]
  favoriteExerciseIds: string[]
  templates: WorkoutTemplate[]
  activeWorkout: ActiveWorkout | null
  completedWorkouts: CompletedWorkout[]
  preferences: TrainingPreferences
}
