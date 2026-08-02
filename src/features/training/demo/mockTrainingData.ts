import { STANDARD_EXERCISES } from '../model/exerciseCatalog'
import type {
  TrainingDemoExercise,
  TrainingDemoPlan,
  TrainingDemoPlanExercise,
  TrainingDemoSession,
  TrainingDemoSessionExercise,
  TrainingDemoState,
  TrainingDemoWizardState,
} from './trainingDemoTypes'

const DEMO_TIMESTAMP = '2026-08-02T09:00:00.000Z'

const UPPER_BODY_EXERCISES: readonly TrainingDemoPlanExercise[] = [
  {
    id: 'upper-body-bench-press',
    exerciseId: 'bench-press',
    order: 0,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    id: 'upper-body-lat-pulldown',
    exerciseId: 'lat-pulldown',
    order: 1,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
  },
]

export function createDemoExercises(
  source = STANDARD_EXERCISES,
): readonly TrainingDemoExercise[] {
  return source.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscle: exercise.primaryMuscles[0] ?? 'Ganzkörper',
    equipment: exercise.equipment.join(', '),
    illustrationPath:
      exercise.illustrationPath ?? `training/exercises/${exercise.id}.svg`,
    gripOptions: [...exercise.gripOptions],
  }))
}

export function createDemoPlans(): readonly TrainingDemoPlan[] {
  return [
    {
      id: 'upper-body',
      name: 'Oberkörper',
      weekdays: [1, 4],
      exercises: UPPER_BODY_EXERCISES.map((exercise) => ({ ...exercise })),
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ]
}

function createDemoSessionExercises(): readonly TrainingDemoSessionExercise[] {
  return UPPER_BODY_EXERCISES.map((exercise) => ({
    id: `session-${exercise.id}`,
    exerciseId: exercise.exerciseId,
    order: exercise.order,
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      id: `session-${exercise.id}-set-${index + 1}`,
      weightKg: 0,
      repetitions: 0,
      completed: false,
    })),
  }))
}

export function createDemoActiveSession(): TrainingDemoSession {
  return {
    id: 'session-upper-body',
    planId: 'upper-body',
    name: 'Oberkörper',
    startedAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
    activeExerciseIndex: 0,
    exercises: createDemoSessionExercises(),
  }
}

export function createEmptyWizardState(): TrainingDemoWizardState {
  return {
    selectedExerciseIds: [],
    draft: {
      name: 'Neuer Trainingsplan',
      weekdays: [],
      exercises: [],
    },
  }
}

export function createInitialTrainingDemoState(): TrainingDemoState {
  return {
    exercises: createDemoExercises(STANDARD_EXERCISES),
    favoriteExerciseIds: ['bench-press', 'lat-pulldown'],
    plans: createDemoPlans(),
    activeSession: createDemoActiveSession(),
    wizard: createEmptyWizardState(),
  }
}
