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
})
