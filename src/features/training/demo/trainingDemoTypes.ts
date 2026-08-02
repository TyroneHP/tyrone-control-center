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
  startWeightKg?: number
  grip?: string
}

export interface TrainingDemoPlan {
  id: string
  name: string
  description: string
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
  rating?: number | null
}

export interface TrainingDemoSessionExercise {
  id: string
  exerciseId: string
  order: number
  grip?: string
  note: string
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
  description: string
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
  nextPlanSequence: number
}

export type TrainingDemoAction =
  | { type: 'favorite/toggle'; exerciseId: string }
  | { type: 'wizard/toggle-exercise'; exerciseId: string }
  | { type: 'wizard/set-name'; name: string }
  | { type: 'wizard/set-description'; description: string }
  | { type: 'wizard/toggle-weekday'; weekday: number }
  | { type: 'wizard/load-plan'; planId: string }
  | {
      type: 'wizard/update-exercise'
      exerciseId: string
      changes: Partial<
      Pick<
        TrainingDemoPlanExercise,
          'targetSets' | 'repMin' | 'repMax' | 'startWeightKg' | 'grip'
        >
      >
    }
  | { type: 'wizard/reorder-exercise'; exerciseId: string; toIndex: number }
  | { type: 'wizard/reset' }
  | { type: 'plan/create' }
  | { type: 'plan/replace'; planId: string }
  | { type: 'plan/duplicate'; planId: string }
  | { type: 'plan/delete'; planId: string }
  | { type: 'session/start'; planId: string }
  | { type: 'session/start-free' }
  | { type: 'session/add-exercise'; exerciseId: string }
  | { type: 'session/remove-exercise'; exerciseId: string }
  | {
      type: 'session/update-exercise'
      exerciseId: string
      changes: Partial<Pick<TrainingDemoSessionExercise, 'grip' | 'note'>>
    }
  | {
      type: 'session/update-set'
      exerciseId: string
      setId: string
      changes: Partial<Pick<TrainingDemoSet, 'weightKg' | 'repetitions' | 'completed' | 'rating'>>
    }
  | { type: 'session/add-set'; exerciseId: string }
  | { type: 'session/remove-set'; exerciseId: string; setId: string }
  | { type: 'session/set-active-exercise'; index: number }
  | { type: 'session/finish' }
  | { type: 'session/discard' }
