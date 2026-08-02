import {
  createEmptyWizardState,
} from './mockTrainingData'
import type {
  TrainingDemoAction,
  TrainingDemoPlan,
  TrainingDemoPlanExercise,
  TrainingDemoSession,
  TrainingDemoSessionExercise,
  TrainingDemoState,
} from './trainingDemoTypes'

const DEMO_TIMESTAMP = '2026-08-02T09:00:00.000Z'
const DEFAULT_TARGET_SETS = 3
const DEFAULT_REP_MIN = 8
const DEFAULT_REP_MAX = 12

function updateWizardExercises(
  state: TrainingDemoState,
  exercises: readonly TrainingDemoPlanExercise[],
  selectedExerciseIds = state.wizard.selectedExerciseIds,
): TrainingDemoState {
  return {
    ...state,
    wizard: {
      ...state.wizard,
      selectedExerciseIds,
      draft: {
        ...state.wizard.draft,
        exercises: exercises.map((exercise, order) => ({ ...exercise, order })),
      },
    },
  }
}

function createSessionFromPlan(plan: TrainingDemoPlan): TrainingDemoSession {
  return {
    id: `session-${plan.id}`,
    planId: plan.id,
    name: plan.name,
    startedAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
    activeExerciseIndex: 0,
    exercises: plan.exercises.map((exercise) => ({
      id: `session-${exercise.id}`,
      exerciseId: exercise.exerciseId,
      order: exercise.order,
      sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
        id: `session-${exercise.id}-set-${index + 1}`,
        weightKg: 0,
        repetitions: 0,
        completed: false,
      })),
    })),
  }
}

function createFreeSession(): TrainingDemoSession {
  return {
    id: 'session-free-training',
    planId: 'free-training',
    name: 'Freies Training',
    startedAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
    activeExerciseIndex: 0,
    exercises: [],
  }
}

function updateActiveSession(
  state: TrainingDemoState,
  update: (session: TrainingDemoSession) => TrainingDemoSession,
): TrainingDemoState {
  if (!state.activeSession) return state

  return { ...state, activeSession: update(state.activeSession) }
}

function createNextSetId(exercise: TrainingDemoSessionExercise): string {
  const existingSetIds = new Set(exercise.sets.map(({ id }) => id))
  let setNumber = exercise.sets.length + 1
  let setId = `${exercise.id}-set-${setNumber}`

  while (existingSetIds.has(setId)) {
    setNumber += 1
    setId = `${exercise.id}-set-${setNumber}`
  }

  return setId
}

export function trainingDemoReducer(
  state: TrainingDemoState,
  action: TrainingDemoAction,
): TrainingDemoState {
  switch (action.type) {
    case 'favorite/toggle': {
      const isFavorite = state.favoriteExerciseIds.includes(action.exerciseId)
      return {
        ...state,
        favoriteExerciseIds: isFavorite
          ? state.favoriteExerciseIds.filter((id) => id !== action.exerciseId)
          : [...state.favoriteExerciseIds, action.exerciseId],
      }
    }

    case 'wizard/toggle-exercise': {
      const isSelected = state.wizard.selectedExerciseIds.includes(
        action.exerciseId,
      )
      if (isSelected) {
        return updateWizardExercises(
          state,
          state.wizard.draft.exercises.filter(
            (exercise) => exercise.exerciseId !== action.exerciseId,
          ),
          state.wizard.selectedExerciseIds.filter((id) => id !== action.exerciseId),
        )
      }

      if (!state.exercises.some((exercise) => exercise.id === action.exerciseId)) {
        return state
      }

      return updateWizardExercises(
        state,
        [
          ...state.wizard.draft.exercises,
          {
            id: `draft-${action.exerciseId}`,
            exerciseId: action.exerciseId,
            order: state.wizard.draft.exercises.length,
            targetSets: DEFAULT_TARGET_SETS,
            repMin: DEFAULT_REP_MIN,
            repMax: DEFAULT_REP_MAX,
          },
        ],
        [...state.wizard.selectedExerciseIds, action.exerciseId],
      )
    }

    case 'wizard/set-name':
      return {
        ...state,
        wizard: {
          ...state.wizard,
          draft: { ...state.wizard.draft, name: action.name },
        },
      }

    case 'wizard/toggle-weekday': {
      const isSelected = state.wizard.draft.weekdays.includes(action.weekday)
      const weekdays = isSelected
        ? state.wizard.draft.weekdays.filter((day) => day !== action.weekday)
        : [...state.wizard.draft.weekdays, action.weekday].sort((a, b) => a - b)
      return {
        ...state,
        wizard: {
          ...state.wizard,
          draft: { ...state.wizard.draft, weekdays },
        },
      }
    }

    case 'wizard/load-plan': {
      const plan = state.plans.find(({ id }) => id === action.planId)
      if (!plan) return state
      return {
        ...state,
        wizard: {
          selectedExerciseIds: plan.exercises.map(({ exerciseId }) => exerciseId),
          draft: {
            name: plan.name,
            weekdays: [...plan.weekdays],
            exercises: plan.exercises.map((exercise) => ({ ...exercise })),
          },
        },
      }
    }

    case 'wizard/update-exercise':
      return updateWizardExercises(
        state,
        state.wizard.draft.exercises.map((exercise) =>
          exercise.exerciseId === action.exerciseId
            ? { ...exercise, ...action.changes }
            : exercise,
        ),
      )

    case 'wizard/reorder-exercise': {
      const sourceIndex = state.wizard.draft.exercises.findIndex(
        (exercise) => exercise.exerciseId === action.exerciseId,
      )
      if (sourceIndex < 0) return state

      const exercises = [...state.wizard.draft.exercises]
      const [exercise] = exercises.splice(sourceIndex, 1)
      const toIndex = Math.max(0, Math.min(action.toIndex, exercises.length))
      exercises.splice(toIndex, 0, exercise)
      return updateWizardExercises(
        state,
        exercises,
        exercises.map(({ exerciseId }) => exerciseId),
      )
    }

    case 'wizard/reset':
      return { ...state, wizard: createEmptyWizardState() }

    case 'plan/create': {
      const id = `plan-${state.plans.length + 1}`
      const plan: TrainingDemoPlan = {
        id,
        name: state.wizard.draft.name,
        weekdays: [...state.wizard.draft.weekdays],
        exercises: state.wizard.draft.exercises.map((exercise) => ({ ...exercise })),
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
      }
      return {
        ...state,
        plans: [...state.plans, plan],
        wizard: createEmptyWizardState(),
      }
    }

    case 'plan/replace': {
      if (!state.plans.some((plan) => plan.id === action.planId)) return state

      const replacePlan = (plan: TrainingDemoPlan): TrainingDemoPlan =>
        plan.id === action.planId
          ? {
              ...plan,
              name: state.wizard.draft.name,
              weekdays: [...state.wizard.draft.weekdays],
              exercises: state.wizard.draft.exercises.map((exercise) => ({ ...exercise })),
              updatedAt: DEMO_TIMESTAMP,
            }
          : plan

      return {
        ...state,
        plans: state.plans.map(replacePlan),
        wizard: createEmptyWizardState(),
      }
    }

    case 'plan/duplicate': {
      const plan = state.plans.find(({ id }) => id === action.planId)
      if (!plan) return state

      const id = `${plan.id}-copy-${state.plans.length}`
      return {
        ...state,
        plans: [
          ...state.plans,
          {
            ...plan,
            id,
            name: `${plan.name} Kopie`,
            exercises: plan.exercises.map((exercise) => ({
              ...exercise,
              id: `${id}-${exercise.exerciseId}`,
            })),
            createdAt: DEMO_TIMESTAMP,
            updatedAt: DEMO_TIMESTAMP,
          },
        ],
      }
    }

    case 'plan/delete':
      return {
        ...state,
        plans: state.plans.filter((plan) => plan.id !== action.planId),
        activeSession:
          state.activeSession?.planId === action.planId
            ? undefined
            : state.activeSession,
      }

    case 'session/start': {
      const plan = state.plans.find(({ id }) => id === action.planId)
      return plan ? { ...state, activeSession: createSessionFromPlan(plan) } : state
    }

    case 'session/start-free':
      return state.activeSession
        ? state
        : { ...state, activeSession: createFreeSession() }

    case 'session/update-set':
      return updateActiveSession(state, (session) => ({
        ...session,
        updatedAt: DEMO_TIMESTAMP,
        exercises: session.exercises.map((exercise) =>
          exercise.exerciseId === action.exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === action.setId ? { ...set, ...action.changes } : set,
                ),
              }
            : exercise,
        ),
      }))

    case 'session/add-set':
      return updateActiveSession(state, (session) => ({
        ...session,
        updatedAt: DEMO_TIMESTAMP,
        exercises: session.exercises.map((exercise) =>
          exercise.exerciseId === action.exerciseId
            ? {
                ...exercise,
                sets: [
                  ...exercise.sets,
                  {
                    id: createNextSetId(exercise),
                    weightKg: 0,
                    repetitions: 0,
                    completed: false,
                  },
                ],
              }
            : exercise,
        ),
      }))

    case 'session/remove-set':
      return updateActiveSession(state, (session) => ({
        ...session,
        updatedAt: DEMO_TIMESTAMP,
        exercises: session.exercises.map((exercise) =>
          exercise.exerciseId === action.exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.filter((set) => set.id !== action.setId),
              }
            : exercise,
        ),
      }))

    case 'session/set-active-exercise':
      return updateActiveSession(state, (session) => ({
        ...session,
        activeExerciseIndex: Math.max(
          0,
          Math.min(action.index, session.exercises.length - 1),
        ),
      }))

    case 'session/finish':
    case 'session/discard':
      return { ...state, activeSession: undefined }
  }
}
