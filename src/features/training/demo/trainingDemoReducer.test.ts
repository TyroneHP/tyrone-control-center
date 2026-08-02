import { describe, expect, it } from 'vitest'
import { createInitialTrainingDemoState } from './mockTrainingData'
import { trainingDemoReducer } from './trainingDemoReducer'

describe('trainingDemoReducer', () => {
  it('exposes all 50 local exercises', () => {
    expect(createInitialTrainingDemoState().exercises).toHaveLength(50)
  })

  it('uses 3 × 8–12 defaults for a selected exercise', () => {
    const next = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'wizard/toggle-exercise',
      exerciseId: 'bench-press',
    })

    expect(next.wizard.draft.exercises[0]).toMatchObject({
      targetSets: 3,
      repMin: 8,
      repMax: 12,
    })
  })

  it('keeps the selected IDs when visible library filters change', () => {
    const next = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'wizard/toggle-exercise',
      exerciseId: 'bench-press',
    })

    expect(next.wizard.selectedExerciseIds).toContain('bench-press')
  })

  it('replaces an existing plan immutably instead of adding a duplicate', () => {
    const initial = createInitialTrainingDemoState()
    const withEditedDraft = trainingDemoReducer(initial, {
      type: 'wizard/load-plan',
      planId: 'upper-body',
    })
    const namedDraft = trainingDemoReducer(withEditedDraft, {
      type: 'wizard/set-name',
      name: 'Oberkörper aktualisiert',
    })
    const replaced = trainingDemoReducer(namedDraft, {
      type: 'plan/replace',
      planId: 'upper-body',
    })

    expect(replaced).not.toBe(namedDraft)
    expect(replaced.plans).toHaveLength(1)
    expect(replaced.plans[0]).toMatchObject({
      id: 'upper-body',
      name: 'Oberkörper aktualisiert',
    })
    expect(namedDraft.plans[0]).toMatchObject({ name: 'Oberkörper' })
  })

  it('removes the one active session only after explicit discard', () => {
    const active = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'session/start',
      planId: 'upper-body',
    })

    expect(active.activeSession).toBeDefined()
    expect(
      trainingDemoReducer(active, { type: 'session/discard' }).activeSession,
    ).toBeUndefined()
  })

  it('starts one free session and preserves it when a second free start is requested', () => {
    const noActiveSession = {
      ...createInitialTrainingDemoState(),
      activeSession: undefined,
    }
    const started = trainingDemoReducer(noActiveSession, {
      type: 'session/start-free',
    })

    expect(started.activeSession).toMatchObject({
      id: 'session-free-training',
      name: 'Freies Training',
      planId: 'free-training',
    })
    expect(started.activeSession?.exercises).toEqual([])
    expect(trainingDemoReducer(started, { type: 'session/start-free' })).toBe(
      started,
    )
  })

  it('adds and removes catalog exercises in a free session', () => {
    const initial = {
      ...createInitialTrainingDemoState(),
      activeSession: undefined,
    }
    const started = trainingDemoReducer(initial, { type: 'session/start-free' })
    const added = trainingDemoReducer(started, {
      type: 'session/add-exercise',
      exerciseId: 'bench-press',
    })
    const duplicateAttempt = trainingDemoReducer(added, {
      type: 'session/add-exercise',
      exerciseId: 'bench-press',
    })
    const removed = trainingDemoReducer(duplicateAttempt, {
      type: 'session/remove-exercise',
      exerciseId: 'bench-press',
    })

    expect(added.activeSession?.exercises).toEqual([
      expect.objectContaining({
        exerciseId: 'bench-press',
        sets: expect.arrayContaining([
          expect.objectContaining({ weightKg: 0, repetitions: 0, completed: false }),
        ]),
      }),
    ])
    expect(duplicateAttempt.activeSession?.exercises).toHaveLength(1)
    expect(removed.activeSession?.exercises).toEqual([])
  })

  it('stores grip, note and rating in the active session state', () => {
    const initial = createInitialTrainingDemoState()
    const exerciseId = initial.activeSession!.exercises[1].exerciseId
    const setId = initial.activeSession!.exercises[1].sets[0].id
    const withExerciseDetails = trainingDemoReducer(initial, {
      type: 'session/update-exercise',
      exerciseId,
      changes: { grip: 'Neutral', note: 'Ellbogen eng halten' },
    })
    const withRating = trainingDemoReducer(withExerciseDetails, {
      type: 'session/update-set',
      exerciseId,
      setId,
      changes: { rating: 8 },
    })

    expect(withRating.activeSession?.exercises[1]).toMatchObject({
      grip: 'Neutral',
      note: 'Ellbogen eng halten',
    })
    expect(withRating.activeSession?.exercises[1].sets[0]).toMatchObject({ rating: 8 })
  })

  it('keeps plan and nested exercise IDs unique across create-delete-create', () => {
    const selectBench = (state: ReturnType<typeof createInitialTrainingDemoState>) =>
      trainingDemoReducer(state, { type: 'wizard/toggle-exercise', exerciseId: 'bench-press' })
    const first = trainingDemoReducer(selectBench(createInitialTrainingDemoState()), { type: 'plan/create' })
    const second = trainingDemoReducer(selectBench(first), { type: 'plan/create' })
    const afterDelete = trainingDemoReducer(second, { type: 'plan/delete', planId: first.plans[1].id })
    const third = trainingDemoReducer(selectBench(afterDelete), { type: 'plan/create' })
    const ids = third.plans.flatMap((plan) => [plan.id, ...plan.exercises.map((exercise) => exercise.id)])

    expect(new Set(ids)).toHaveLength(ids.length)
  })

  it('keeps plan and nested exercise IDs unique across duplicate-delete-duplicate', () => {
    const first = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'plan/duplicate',
      planId: 'upper-body',
    })
    const duplicateId = first.plans.at(-1)!.id
    const afterDelete = trainingDemoReducer(first, { type: 'plan/delete', planId: duplicateId })
    const second = trainingDemoReducer(afterDelete, {
      type: 'plan/duplicate',
      planId: 'upper-body',
    })
    const ids = second.plans.flatMap((plan) => [plan.id, ...plan.exercises.map((exercise) => exercise.id)])

    expect(second.plans.at(-1)!.id).not.toBe(duplicateId)
    expect(new Set(ids)).toHaveLength(ids.length)
  })

  it('preserves an optional description through create, edit and duplicate', () => {
    const described = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'wizard/set-description',
      description: 'Kurze Einheit für den Montag.',
    })
    const created = trainingDemoReducer(described, { type: 'plan/create' })
    const createdPlan = created.plans.at(-1)!
    const loaded = trainingDemoReducer(created, { type: 'wizard/load-plan', planId: createdPlan.id })
    const editedDraft = trainingDemoReducer(loaded, {
      type: 'wizard/set-description',
      description: 'Aktualisierte Beschreibung.',
    })
    const replaced = trainingDemoReducer(editedDraft, { type: 'plan/replace', planId: createdPlan.id })
    const duplicated = trainingDemoReducer(replaced, { type: 'plan/duplicate', planId: createdPlan.id })

    expect(loaded.wizard.draft.description).toBe('Kurze Einheit für den Montag.')
    expect(replaced.plans.find(({ id }) => id === createdPlan.id)?.description).toBe('Aktualisierte Beschreibung.')
    expect(duplicated.plans.at(-1)?.description).toBe('Aktualisierte Beschreibung.')
  })

  it('creates a distinct replacement set ID and updates only that new set after a removal', () => {
    const started = trainingDemoReducer(createInitialTrainingDemoState(), {
      type: 'session/start',
      planId: 'upper-body',
    })
    const firstSetId = started.activeSession!.exercises[0].sets[0].id
    const afterRemoval = trainingDemoReducer(started, {
      type: 'session/remove-set',
      exerciseId: 'bench-press',
      setId: firstSetId,
    })
    const afterAddition = trainingDemoReducer(afterRemoval, {
      type: 'session/add-set',
      exerciseId: 'bench-press',
    })
    const addedSet = afterAddition.activeSession!.exercises[0].sets.at(-1)!
    const updated = trainingDemoReducer(afterAddition, {
      type: 'session/update-set',
      exerciseId: 'bench-press',
      setId: addedSet.id,
      changes: { weightKg: 42, repetitions: 9, completed: true },
    })
    const updatedSets = updated.activeSession!.exercises[0].sets

    expect(
      updatedSets.filter(({ weightKg }) => weightKg === 42),
    ).toHaveLength(1)
    expect(new Set(updatedSets.map(({ id }) => id))).toHaveLength(
      updatedSets.length,
    )
    expect(updatedSets.find(({ id }) => id === addedSet.id)).toMatchObject({
      weightKg: 42,
      repetitions: 9,
      completed: true,
    })
    expect(updatedSets.filter(({ id }) => id !== addedSet.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weightKg: 0,
          repetitions: 0,
          completed: false,
        }),
        expect.objectContaining({
          weightKg: 0,
          repetitions: 0,
          completed: false,
        }),
      ]),
    )
  })
})
