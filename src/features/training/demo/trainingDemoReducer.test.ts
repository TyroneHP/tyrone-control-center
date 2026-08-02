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
