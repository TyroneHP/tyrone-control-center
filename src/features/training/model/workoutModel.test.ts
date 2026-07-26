import { describe, expect, it } from 'vitest'
import type {
  ActiveWorkout,
  CompletedWorkout,
  TrainingState,
  WorkoutExerciseEntry,
  WorkoutTemplateExercise,
} from './trainingTypes'
import {
  addTemplateExercise,
  addWorkoutExercise,
  addWorkoutSet,
  completeWorkout,
  createTemplateExercise,
  createWorkoutTemplate,
  deleteCompletedWorkout,
  findLastExerciseEntry,
  removeTemplateExercise,
  removeWorkoutExercise,
  removeWorkoutSet,
  reorderTemplateExercise,
  reorderWorkoutExercise,
  replaceCompletedWorkout,
  startWorkout,
  updateTemplateExercise,
  updateWorkoutExercise,
  updateWorkoutSet,
} from './workoutModel'

const MORNING = '2026-07-26T08:00:00.000Z'
const STARTED = '2026-07-26T09:00:00.000Z'
const UPDATED = '2026-07-26T09:30:00.000Z'
const FINISHED = '2026-07-26T10:00:00.000Z'

function makeWorkoutExercise(
  overrides: Partial<WorkoutExerciseEntry> = {},
): WorkoutExerciseEntry {
  return {
    id: 'entry-bench',
    exerciseId: 'bench-press',
    order: 0,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    loadMode: 'external',
    note: 'Pause on the chest.',
    sets: [
      {
        id: 'set-bench-1',
        weightKg: 80,
        reps: 12,
        rating: 7,
        completed: true,
      },
    ],
    ...overrides,
  }
}

function makeActiveWorkout(
  exercises: WorkoutExerciseEntry[] = [makeWorkoutExercise()],
): ActiveWorkout {
  return {
    id: 'active-1',
    templateId: 'template-1',
    name: 'Push',
    startedAt: STARTED,
    updatedAt: STARTED,
    exercises,
  }
}

function makeCompletedWorkout(
  overrides: Partial<CompletedWorkout> = {},
): CompletedWorkout {
  return {
    id: 'completed-1',
    templateId: 'template-1',
    name: 'Push',
    startedAt: '2026-07-25T09:00:00.000Z',
    completedAt: '2026-07-25T10:00:00.000Z',
    exercises: [makeWorkoutExercise()],
    ...overrides,
  }
}

function makeState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    preferences: {
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg: 2.5,
    },
    ...overrides,
  }
}

function withoutId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id, ...rest } = value
  void id
  return rest
}

describe('workout templates', () => {
  it('creates template exercises with the 3 x 8-12 defaults', () => {
    const exercise = createTemplateExercise('bench-press', 0)

    expect(exercise).toMatchObject({
      exerciseId: 'bench-press',
      order: 0,
      targetSets: 3,
      repMin: 8,
      repMax: 12,
    })
    expect(exercise.id).toEqual(expect.any(String))
    expect(exercise.id).not.toBe('')
  })

  it('creates a template with custom targets without retaining caller-owned arrays', () => {
    const customExercise: WorkoutTemplateExercise = {
      id: 'template-exercise-1',
      exerciseId: 'lat-pulldown',
      order: 0,
      targetSets: 4,
      repMin: 6,
      repMax: 10,
      preferredGrip: 'Breit',
    }
    const weekdays = [1, 4] as const

    const template = createWorkoutTemplate({
      name: 'Pull',
      weekdays: [...weekdays],
      exercises: [customExercise],
      timestamp: MORNING,
    })

    expect(template).toEqual({
      id: expect.any(String),
      name: 'Pull',
      weekdays: [1, 4],
      exercises: [
        {
          id: 'template-exercise-1',
          exerciseId: 'lat-pulldown',
          order: 0,
          targetSets: 4,
          repMin: 6,
          repMax: 10,
          preferredGrip: 'Breit',
        },
      ],
      createdAt: MORNING,
      updatedAt: MORNING,
    })
    expect(template.weekdays).not.toBe(weekdays)
    expect(template.exercises[0]).not.toBe(customExercise)
  })

  it('adds and updates a template exercise immutably', () => {
    const original = createWorkoutTemplate({
      name: 'Upper',
      weekdays: [2],
      exercises: [
        {
          id: 'template-bench',
          exerciseId: 'bench-press',
          order: 0,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
        },
      ],
      timestamp: MORNING,
    })

    const withExercise = addTemplateExercise(original, 'lat-pulldown', UPDATED)
    const addedId = withExercise.exercises[1].id
    const customized = updateTemplateExercise(
      withExercise,
      addedId,
      {
        targetSets: 5,
        repMin: 5,
        repMax: 7,
        preferredGrip: 'Neutral',
      },
      FINISHED,
    )

    expect(withExercise.exercises.map(withoutId)).toEqual([
      {
        exerciseId: 'bench-press',
        order: 0,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
      },
      {
        exerciseId: 'lat-pulldown',
        order: 1,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
      },
    ])
    expect(customized.exercises.map(withoutId)).toEqual([
      {
        exerciseId: 'bench-press',
        order: 0,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
      },
      {
        exerciseId: 'lat-pulldown',
        order: 1,
        targetSets: 5,
        repMin: 5,
        repMax: 7,
        preferredGrip: 'Neutral',
      },
    ])
    expect(customized.updatedAt).toBe(FINISHED)
    expect(original.exercises).toHaveLength(1)
    expect(original.updatedAt).toBe(MORNING)
  })

  it('reorders and removes template exercises while normalizing order', () => {
    const template = createWorkoutTemplate({
      name: 'Full Body',
      weekdays: [1, 3, 5],
      exercises: [
        {
          id: 'template-bench',
          exerciseId: 'bench-press',
          order: 0,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
        },
        {
          id: 'template-row',
          exerciseId: 'barbell-row',
          order: 1,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
        },
        {
          id: 'template-squat',
          exerciseId: 'back-squat',
          order: 2,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
        },
      ],
      timestamp: MORNING,
    })

    const reordered = reorderTemplateExercise(
      template,
      'template-squat',
      0,
      UPDATED,
    )
    const removed = removeTemplateExercise(
      reordered,
      'template-bench',
      FINISHED,
    )

    expect(reordered.exercises.map(({ exerciseId, order }) => ({ exerciseId, order }))).toEqual([
      { exerciseId: 'back-squat', order: 0 },
      { exerciseId: 'bench-press', order: 1 },
      { exerciseId: 'barbell-row', order: 2 },
    ])
    expect(removed.exercises.map(({ exerciseId, order }) => ({ exerciseId, order }))).toEqual([
      { exerciseId: 'back-squat', order: 0 },
      { exerciseId: 'barbell-row', order: 1 },
    ])
    expect(template.exercises.map(({ exerciseId, order }) => ({ exerciseId, order }))).toEqual([
      { exerciseId: 'bench-press', order: 0 },
      { exerciseId: 'barbell-row', order: 1 },
      { exerciseId: 'back-squat', order: 2 },
    ])
  })
})

describe('active workouts', () => {
  it('starts a workout with custom targets and the planned number of empty sets', () => {
    const template = createWorkoutTemplate({
      name: 'Strength',
      weekdays: [1],
      exercises: [
        {
          id: 'template-squat',
          exerciseId: 'back-squat',
          order: 0,
          targetSets: 4,
          repMin: 4,
          repMax: 6,
        },
      ],
      timestamp: MORNING,
    })

    const result = startWorkout(makeState(), template, STARTED)
    const active = result.activeWorkout

    expect(active).not.toBeNull()
    expect(active).toMatchObject({
      id: expect.any(String),
      templateId: template.id,
      name: 'Strength',
      startedAt: STARTED,
      updatedAt: STARTED,
    })
    expect(active?.exercises.map((entry) => ({
      ...withoutId(entry),
      sets: entry.sets.map(withoutId),
    }))).toEqual([
      {
        exerciseId: 'back-squat',
        order: 0,
        targetSets: 4,
        repMin: 4,
        repMax: 6,
        loadMode: 'external',
        note: '',
        sets: [
          { weightKg: null, reps: null, rating: null, completed: false },
          { weightKg: null, reps: null, rating: null, completed: false },
          { weightKg: null, reps: null, rating: null, completed: false },
          { weightKg: null, reps: null, rating: null, completed: false },
        ],
      },
    ])
  })

  it('rejects a second start so a state can never contain two active workouts', () => {
    const state = makeState({ activeWorkout: makeActiveWorkout() })
    const template = createWorkoutTemplate({
      name: 'Pull',
      weekdays: [3],
      timestamp: MORNING,
    })

    expect(() => startWorkout(state, template, UPDATED)).toThrow(
      'An active workout already exists',
    )
    expect(state.activeWorkout).toBeTruthy()
    expect(state.activeWorkout?.id).toBe('active-1')
  })

  it('prefills the latest completed occurrence with fresh set IDs and an explicit empty note', () => {
    const older = makeCompletedWorkout({
      id: 'older',
      completedAt: '2026-07-20T10:00:00.000Z',
      exercises: [
        makeWorkoutExercise({
          id: 'older-pull-up',
          exerciseId: 'pull-up',
          grip: 'Eng',
          loadMode: 'added',
          note: 'Old note must not win.',
          sets: [
            {
              id: 'older-set',
              weightKg: 10,
              reps: 9,
              rating: 9,
              completed: true,
            },
          ],
        }),
      ],
    })
    const latest = makeCompletedWorkout({
      id: 'latest',
      completedAt: '2026-07-25T10:00:00.000Z',
      exercises: [
        makeWorkoutExercise({
          id: 'latest-pull-up',
          exerciseId: 'pull-up',
          targetSets: 2,
          repMin: 6,
          repMax: 8,
          grip: 'Neutral',
          loadMode: 'bodyweight',
          note: '',
          sets: [
            {
              id: 'latest-set-1',
              weightKg: null,
              reps: 8,
              rating: 6,
              completed: true,
            },
            {
              id: 'latest-set-2',
              weightKg: null,
              reps: 7,
              rating: null,
              completed: false,
            },
          ],
        }),
      ],
    })
    const state = makeState({ completedWorkouts: [latest, older] })
    const template = createWorkoutTemplate({
      name: 'Calisthenics',
      weekdays: [6],
      exercises: [
        {
          id: 'template-pull-up',
          exerciseId: 'pull-up',
          order: 0,
          targetSets: 3,
          repMin: 6,
          repMax: 10,
          preferredGrip: 'Breit',
        },
      ],
      timestamp: MORNING,
    })

    const result = startWorkout(state, template, STARTED)
    const entry = result.activeWorkout?.exercises[0]

    expect(findLastExerciseEntry([latest, older], 'pull-up')).toBe(
      latest.exercises[0],
    )
    expect(entry && withoutId(entry)).toEqual({
      exerciseId: 'pull-up',
      order: 0,
      targetSets: 3,
      repMin: 6,
      repMax: 10,
      grip: 'Neutral',
      loadMode: 'bodyweight',
      note: '',
      sets: [
        {
          id: expect.any(String),
          weightKg: null,
          reps: 8,
          rating: 6,
          completed: false,
        },
        {
          id: expect.any(String),
          weightKg: null,
          reps: 7,
          rating: null,
          completed: false,
        },
      ],
    })
    const newSetIds = entry?.sets.map(({ id }) => id) ?? []
    expect(new Set(newSetIds).size).toBe(2)
    expect(newSetIds).not.toContain('latest-set-1')
    expect(newSetIds).not.toContain('latest-set-2')
  })

  it('adds, reorders, and removes workout exercises without mutating prior states', () => {
    const bench = makeWorkoutExercise()
    const row = makeWorkoutExercise({
      id: 'entry-row',
      exerciseId: 'barbell-row',
      order: 1,
    })
    const original = makeState({
      activeWorkout: makeActiveWorkout([bench, row]),
    })

    const added = addWorkoutExercise(
      original,
      {
        exerciseId: 'back-squat',
        targetSets: 2,
        repMin: 5,
        repMax: 8,
      },
      UPDATED,
    )
    const squatId = added.activeWorkout?.exercises[2].id ?? ''
    const reordered = reorderWorkoutExercise(added, squatId, 0, FINISHED)
    const removed = removeWorkoutExercise(
      reordered,
      'entry-bench',
      '2026-07-26T10:05:00.000Z',
    )

    expect(added.activeWorkout?.exercises.map((entry) => ({
      exerciseId: entry.exerciseId,
      order: entry.order,
      targetSets: entry.targetSets,
      repMin: entry.repMin,
      repMax: entry.repMax,
      setCount: entry.sets.length,
    }))).toEqual([
      {
        exerciseId: 'bench-press',
        order: 0,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
        setCount: 1,
      },
      {
        exerciseId: 'barbell-row',
        order: 1,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
        setCount: 1,
      },
      {
        exerciseId: 'back-squat',
        order: 2,
        targetSets: 2,
        repMin: 5,
        repMax: 8,
        setCount: 2,
      },
    ])
    expect(reordered.activeWorkout?.exercises.map(({ exerciseId, order }) => ({
      exerciseId,
      order,
    }))).toEqual([
      { exerciseId: 'back-squat', order: 0 },
      { exerciseId: 'bench-press', order: 1 },
      { exerciseId: 'barbell-row', order: 2 },
    ])
    expect(removed.activeWorkout?.exercises.map(({ exerciseId, order }) => ({
      exerciseId,
      order,
    }))).toEqual([
      { exerciseId: 'back-squat', order: 0 },
      { exerciseId: 'barbell-row', order: 1 },
    ])
    expect(original.activeWorkout?.exercises.map(({ exerciseId, order }) => ({
      exerciseId,
      order,
    }))).toEqual([
      { exerciseId: 'bench-press', order: 0 },
      { exerciseId: 'barbell-row', order: 1 },
    ])
    expect(original.activeWorkout?.updatedAt).toBe(STARTED)
  })

  it('adds, updates, and removes sets while preserving the previous workout snapshot', () => {
    const original = makeState({ activeWorkout: makeActiveWorkout() })

    const withSet = addWorkoutSet(original, 'entry-bench', UPDATED)
    const addedSetId =
      withSet.activeWorkout?.exercises[0].sets[1]?.id ?? ''
    const updated = updateWorkoutSet(
      withSet,
      'entry-bench',
      addedSetId,
      {
        weightKg: 82.5,
        reps: 10,
        rating: 8,
        completed: true,
      },
      FINISHED,
    )
    const removed = removeWorkoutSet(
      updated,
      'entry-bench',
      'set-bench-1',
      '2026-07-26T10:05:00.000Z',
    )

    expect(withSet.activeWorkout?.exercises[0].sets.map(withoutId)).toEqual([
      { weightKg: 80, reps: 12, rating: 7, completed: true },
      { weightKg: null, reps: null, rating: null, completed: false },
    ])
    expect(removed.activeWorkout?.exercises[0].sets.map(withoutId)).toEqual([
      { weightKg: 82.5, reps: 10, rating: 8, completed: true },
    ])
    expect(removed.activeWorkout?.updatedAt).toBe(
      '2026-07-26T10:05:00.000Z',
    )
    expect(original.activeWorkout?.exercises[0].sets).toEqual([
      {
        id: 'set-bench-1',
        weightKg: 80,
        reps: 12,
        rating: 7,
        completed: true,
      },
    ])
  })

  it('updates grip, load mode, and an explicitly cleared note immutably', () => {
    const original = makeState({ activeWorkout: makeActiveWorkout() })

    const updated = updateWorkoutExercise(
      original,
      'entry-bench',
      {
        grip: 'Neutral',
        loadMode: 'assisted',
        note: '',
      },
      UPDATED,
    )

    expect(updated.activeWorkout?.exercises[0]).toMatchObject({
      grip: 'Neutral',
      loadMode: 'assisted',
      note: '',
    })
    expect(updated.activeWorkout?.updatedAt).toBe(UPDATED)
    expect(original.activeWorkout?.exercises[0]).toMatchObject({
      loadMode: 'external',
      note: 'Pause on the chest.',
    })
    expect(original.activeWorkout?.exercises[0]).not.toHaveProperty('grip')
  })
})

describe('workout completion and history', () => {
  it('persists every set on completion, clears the active slot, and preserves an untouched note', () => {
    const active = makeActiveWorkout([
      makeWorkoutExercise({
        note: 'Keep this note.',
        sets: [
          {
            id: 'complete-set',
            weightKg: 80,
            reps: 12,
            rating: 7,
            completed: true,
          },
          {
            id: 'incomplete-set',
            weightKg: null,
            reps: null,
            rating: null,
            completed: false,
          },
        ],
      }),
    ])
    const previous = makeCompletedWorkout({ id: 'previous' })
    const state = makeState({
      activeWorkout: active,
      completedWorkouts: [previous],
    })

    const result = completeWorkout(state, FINISHED)

    expect(result.activeWorkout).toBeNull()
    expect(result.completedWorkouts).toHaveLength(2)
    expect(result.completedWorkouts[1]).toEqual({
      id: 'active-1',
      templateId: 'template-1',
      name: 'Push',
      startedAt: STARTED,
      completedAt: FINISHED,
      exercises: [
        {
          id: 'entry-bench',
          exerciseId: 'bench-press',
          order: 0,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
          loadMode: 'external',
          note: 'Keep this note.',
          sets: [
            {
              id: 'complete-set',
              weightKg: 80,
              reps: 12,
              rating: 7,
              completed: true,
            },
            {
              id: 'incomplete-set',
              weightKg: null,
              reps: null,
              rating: null,
              completed: false,
            },
          ],
        },
      ],
    })
    expect(state.activeWorkout).toBe(active)
    expect(state.completedWorkouts).toEqual([previous])
  })

  it('replaces editable history fields without changing identity or timestamps', () => {
    const originalWorkout = makeCompletedWorkout()
    const untouchedWorkout = makeCompletedWorkout({
      id: 'completed-2',
      completedAt: '2026-07-24T10:00:00.000Z',
    })
    const state = makeState({
      completedWorkouts: [originalWorkout, untouchedWorkout],
    })
    const editedDraft: CompletedWorkout = {
      id: 'draft-id-must-not-win',
      name: 'Edited Push',
      startedAt: '2099-01-01T00:00:00.000Z',
      completedAt: '2099-01-02T00:00:00.000Z',
      exercises: [
        makeWorkoutExercise({
          note: '',
          sets: [
            {
              id: 'edited-set',
              weightKg: 82.5,
              reps: 11,
              rating: 8,
              completed: true,
            },
          ],
        }),
      ],
    }

    const result = replaceCompletedWorkout(
      state,
      'completed-1',
      editedDraft,
    )

    expect(result.completedWorkouts[0]).toEqual({
      id: 'completed-1',
      templateId: 'template-1',
      name: 'Edited Push',
      startedAt: '2026-07-25T09:00:00.000Z',
      completedAt: '2026-07-25T10:00:00.000Z',
      exercises: [
        {
          id: 'entry-bench',
          exerciseId: 'bench-press',
          order: 0,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
          loadMode: 'external',
          note: '',
          sets: [
            {
              id: 'edited-set',
              weightKg: 82.5,
              reps: 11,
              rating: 8,
              completed: true,
            },
          ],
        },
      ],
    })
    expect(result.completedWorkouts[1]).toBe(untouchedWorkout)
    expect(result.completedWorkouts).not.toBe(state.completedWorkouts)
    expect(state.completedWorkouts[0]).toBe(originalWorkout)
  })

  it('deletes only the selected completed workout without mutating history', () => {
    const first = makeCompletedWorkout({ id: 'completed-1' })
    const second = makeCompletedWorkout({ id: 'completed-2' })
    const state = makeState({ completedWorkouts: [first, second] })

    const result = deleteCompletedWorkout(state, 'completed-1')

    expect(result.completedWorkouts).toEqual([second])
    expect(result.completedWorkouts).not.toBe(state.completedWorkouts)
    expect(state.completedWorkouts).toEqual([first, second])
  })
})
