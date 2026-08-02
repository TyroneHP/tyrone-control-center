import { useEffect, useReducer, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingDemoContext, useTrainingDemo } from '../demo/useTrainingDemo'
import { createInitialTrainingDemoState } from '../demo/mockTrainingData'
import { trainingDemoReducer } from '../demo/trainingDemoReducer'
import type { TrainingDemoState } from '../demo/trainingDemoTypes'
import { createSortableMoveAction, TrainingPlanWizardPage } from './TrainingPlanWizardPage'

function DemoHarness({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(trainingDemoReducer, undefined, createInitialTrainingDemoState)
  return (
    <TrainingDemoContext.Provider value={{
      state,
      dispatch,
      startFreeSession: () => dispatch({ type: 'session/start-free' }),
      toggleFavoriteExercise: (exerciseId) => dispatch({ type: 'favorite/toggle', exerciseId }),
    }}>
      {children}
    </TrainingDemoContext.Provider>
  )
}

function StateReader({ onChange }: { onChange: (state: TrainingDemoState) => void }) {
  const { state } = useTrainingDemo()
  useEffect(() => onChange(state), [onChange, state])
  return null
}

function renderWizard(path = '/training/plans/new') {
  let demoState = createInitialTrainingDemoState()
  render(
    <MemoryRouter initialEntries={[path]}>
      <DemoHarness>
        <Routes>
          <Route path="/training" element={<p>Training</p>} />
          <Route path="/training/plans/new" element={<TrainingPlanWizardPage />} />
        </Routes>
        <StateReader onChange={(state) => { demoState = state }} />
      </DemoHarness>
    </MemoryRouter>,
  )
  return { readDemoState: () => demoState }
}

async function renderWizardAtExerciseStep() {
  renderWizard()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Montag' }))
  await user.click(screen.getByRole('button', { name: 'Weiter zu Übungen' }))
}

async function renderWizardAtAdjustmentStep(exercises: readonly string[]) {
  renderWizard()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Montag' }))
  await user.click(screen.getByRole('button', { name: 'Weiter zu Übungen' }))
  for (const exerciseId of exercises) {
    const name = exerciseId === 'bench-press' ? 'Bankdrücken' : 'Latziehen zur Brust'
    await user.click(screen.getByRole('button', { name: `${name} auswählen` }))
  }
  await user.click(screen.getByRole('button', { name: 'Weiter zu Anpassen' }))
}

describe('TrainingPlanWizardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }))
  })
  it('keeps Bankdrücken selected while switching to Favorites', async () => {
    await renderWizardAtExerciseStep()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Bankdrücken auswählen' }))
    await user.click(screen.getByRole('button', { name: 'Favoriten filtern' }))
    expect(screen.getByRole('button', { name: 'Bankdrücken abwählen' })).toBeVisible()
  })

  it('moves a selected exercise up through its accessible action', async () => {
    await renderWizardAtAdjustmentStep(['bench-press', 'lat-pulldown'])
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Latziehen zur Brust nach oben verschieben' }),
    )
    expect(screen.getAllByTestId('plan-exercise-row').at(0)).toHaveTextContent('Latziehen zur Brust')
  })

  it('loads the matching plan for the approved edit query and replaces it on save', async () => {
    const { readDemoState } = renderWizard('/training/plans/new?edit=upper-body')
    expect(screen.getByLabelText('Planname')).toHaveValue('Oberkörper')
    await userEvent.setup().clear(screen.getByLabelText('Planname'))
    await userEvent.setup().type(screen.getByLabelText('Planname'), 'Oberkörper bearbeitet')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Plan speichern' }))
    expect(readDemoState().plans.filter((plan) => plan.id === 'upper-body')).toEqual([
      expect.objectContaining({ name: 'Oberkörper bearbeitet' }),
    ])
  })

  it('does not replace the edited plan while required basics are invalid', async () => {
    const { readDemoState } = renderWizard('/training/plans/new?edit=upper-body')
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Planname'))
    await user.click(screen.getByRole('button', { name: 'Montag' }))
    await user.click(screen.getByRole('button', { name: 'Donnerstag' }))

    expect(screen.getByRole('button', { name: 'Plan speichern' })).toBeDisabled()
    expect(readDemoState().plans).toEqual([
      expect.objectContaining({ id: 'upper-body', name: 'Oberkörper', weekdays: [1, 4] }),
    ])
  })

  it('maps edit-plan sortable entry IDs to their exercise ID before reordering', () => {
    const state = createInitialTrainingDemoState()
    const draft = trainingDemoReducer(state, { type: 'wizard/load-plan', planId: 'upper-body' }).wizard.draft
    const action = createSortableMoveAction(draft.exercises, 'upper-body-lat-pulldown', 'upper-body-bench-press')
    const moved = action ? trainingDemoReducer({ ...state, wizard: { selectedExerciseIds: draft.exercises.map(({ exerciseId }) => exerciseId), draft } }, action) : state

    expect(action).toEqual({ type: 'wizard/reorder-exercise', exerciseId: 'lat-pulldown', toIndex: 0 })
    expect(moved.wizard.draft.exercises[0]).toMatchObject({ exerciseId: 'lat-pulldown' })
  })

  it('shows edited optional start weight and grip exactly in preview', async () => {
    renderWizard('/training/plans/new?edit=upper-body')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Weiter zu Übungen' }))
    await user.click(screen.getByRole('button', { name: 'Weiter zu Anpassen' }))
    await user.clear(screen.getByLabelText('Startgewicht für Latziehen zur Brust'))
    await user.type(screen.getByLabelText('Startgewicht für Latziehen zur Brust'), '60')
    await user.type(screen.getByLabelText('Griff für Latziehen zur Brust'), 'Neutral')
    await user.click(screen.getByRole('button', { name: 'Weiter zu Vorschau' }))

    expect(screen.getByRole('region', { name: 'Planvorschau' })).toHaveTextContent('60 kg')
    expect(screen.getByRole('region', { name: 'Planvorschau' })).toHaveTextContent('Neutral')
  })

  it('returns to training without mutating plans for an unknown edit query', async () => {
    const { readDemoState } = renderWizard('/training/plans/new?edit=does-not-exist')
    expect(await screen.findByText('Training')).toBeVisible()
    expect(readDemoState().plans).toHaveLength(1)
    expect(readDemoState().plans[0]).toMatchObject({ id: 'upper-body', name: 'Oberkörper' })
  })
})
