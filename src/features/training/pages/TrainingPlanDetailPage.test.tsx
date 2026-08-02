import { useEffect, useReducer, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingDemoContext, useTrainingDemo } from '../demo/useTrainingDemo'
import { createInitialTrainingDemoState } from '../demo/mockTrainingData'
import { trainingDemoReducer } from '../demo/trainingDemoReducer'
import type { TrainingDemoState } from '../demo/trainingDemoTypes'
import { TrainingPlanDetailPage } from './TrainingPlanDetailPage'

function DemoHarness({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    trainingDemoReducer,
    undefined,
    createInitialTrainingDemoState,
  )

  return (
    <TrainingDemoContext.Provider
      value={{ state, dispatch, toggleFavoriteExercise: (exerciseId) => dispatch({ type: 'favorite/toggle', exerciseId }) }}
    >
      {children}
    </TrainingDemoContext.Provider>
  )
}

function DemoStateReader({ onStateChange }: {
  onStateChange: (state: TrainingDemoState) => void
}) {
  const state = useTrainingDemo().state
  useEffect(() => {
    onStateChange(state)
  }, [onStateChange, state])
  return null
}

function LocationMarker() {
  return <output aria-label="Aktueller Pfad">{useLocation().pathname}</output>
}

function renderPlanDetail(planId = 'upper-body') {
  let demoState = createInitialTrainingDemoState()
  render(
    <MemoryRouter initialEntries={[`/training/plans/${planId}`]}>
      <DemoHarness>
        <Routes>
          <Route path="/training" element={<p>Training</p>} />
          <Route path="/training/plans/:planId" element={<TrainingPlanDetailPage />} />
        </Routes>
        <DemoStateReader onStateChange={(state) => { demoState = state }} />
        <LocationMarker />
      </DemoHarness>
    </MemoryRouter>,
  )
  return { readDemoState: () => demoState }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media: query,
    removeEventListener: vi.fn(),
  }))
})

describe('TrainingPlanDetailPage', () => {
  it('requires a second confirmation before plan deletion', async () => {
    const { readDemoState } = renderPlanDetail()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
    await user.click(screen.getByRole('button', { name: 'Plan löschen' }))

    expect(
      screen.getByRole('dialog', { name: 'Plan wirklich löschen?' }),
    ).toBeVisible()
    expect(readDemoState().plans).toHaveLength(1)
  })

  it('duplicates through the demo reducer', async () => {
    const { readDemoState } = renderPlanDetail()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
    await user.click(screen.getByRole('button', { name: 'Plan duplizieren' }))

    expect(readDemoState().plans).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Oberkörper Kopie' })]),
    )
  })

  it('deletes only after the second confirmation', async () => {
    const { readDemoState } = renderPlanDetail()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
    await user.click(screen.getByRole('button', { name: 'Plan löschen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(readDemoState().plans).toHaveLength(0)
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training')
  })
})
