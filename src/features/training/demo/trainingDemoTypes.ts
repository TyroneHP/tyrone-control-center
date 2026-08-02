export interface TrainingDemoExercise {
  id: string
  name: string
  muscle: string
  equipment: string
  illustrationPath: string
  gripOptions: readonly string[]
}

export interface TrainingDemoPlanExercise {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  repMin: number
  repMax: number
}

export interface TrainingDemoPlan {
  id: string
  name: string
  weekdays: readonly number[]
  exercises: readonly TrainingDemoPlanExercise[]
  createdAt: string
  updatedAt: string
}

export interface TrainingDemoSet {
  id: string
  weightKg: number
  repetitions: number
  completed: boolean
}

export interface TrainingDemoSessionExercise {
  id: string
  exerciseId: string
  order: number
  sets: readonly TrainingDemoSet[]
}

export interface TrainingDemoSession {
  id: string
  planId: string
  name: string
  startedAt: string
  updatedAt: string
  activeExerciseIndex: number
  exercises: readonly TrainingDemoSessionExercise[]
}

export interface TrainingDemoPlanDraft {
  name: string
  weekdays: readonly number[]
  exercises: readonly TrainingDemoPlanExercise[]
}

export interface TrainingDemoWizardState {
  selectedExerciseIds: readonly string[]
  draft: TrainingDemoPlanDraft
}

export interface TrainingDemoState {
  exercises: readonly TrainingDemoExercise[]
  favoriteExerciseIds: readonly string[]
  plans: readonly TrainingDemoPlan[]
  activeSession?: TrainingDemoSession
  wizard: TrainingDemoWizardState
}

export type TrainingDemoAction =
  | { type: 'favorite/toggle'; exerciseId: string }
  | { type: 'wizard/toggle-exercise'; exerciseId: string }
  | { type: 'wizard/set-name'; name: string }
  | { type: 'wizard/toggle-weekday'; weekday: number }
  | {
      type: 'wizard/update-exercise'
      exerciseId: string
      changes: Partial<
        Pick<
          TrainingDemoPlanExercise,
          'targetSets' | 'repMin' | 'repMax'
        >
      >
    }
  | { type: 'wizard/reorder-exercise'; exerciseId: string; toIndex: number }
  | { type: 'wizard/reset' }
  | { type: 'plan/create' }
  | { type: 'plan/duplicate'; planId: string }
  | { type: 'plan/delete'; planId: string }
  | { type: 'session/start'; planId: string }
  | { type: 'session/start-free' }
  | {
      type: 'session/update-set'
      exerciseId: string
      setId: string
      changes: Partial<Pick<TrainingDemoSet, 'weightKg' | 'repetitions' | 'completed'>>
    }
  | { type: 'session/add-set'; exerciseId: string }
  | { type: 'session/remove-set'; exerciseId: string; setId: string }
  | { type: 'session/set-active-exercise'; index: number }
  | { type: 'session/finish' }
  | { type: 'session/discard' }
