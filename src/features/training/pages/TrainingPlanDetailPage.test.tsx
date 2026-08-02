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

function DemoHarness({
  children,
  initialState = createInitialTrainingDemoState(),
}: {
  children: ReactNode
  initialState?: TrainingDemoState
}) {
  const [state, dispatch] = useReducer(
    trainingDemoReducer,
    initialState,
  )

  return (
    <TrainingDemoContext.Provider
      value={{
        state,
        dispatch,
        startFreeSession: () => dispatch({ type: 'session/start-free' }),
        toggleFavoriteExercise: (exerciseId) => dispatch({ type: 'favorite/toggle', exerciseId }),
      }}
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
  const location = useLocation()
  return <output aria-label="Aktueller Pfad">{location.pathname}{location.search}</output>
}

function renderPlanDetail(
  planId = 'upper-body',
  initialState = createInitialTrainingDemoState(),
) {
  let demoState = initialState
  render(
    <MemoryRouter initialEntries={[`/training/plans/${planId}`]}>
      <DemoHarness initialState={initialState}>
        <Routes>
          <Route path="/training" element={<p>Training</p>} />
          <Route path="/training/plans/new" element={<p>Planassistent</p>} />
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

  it('opens the approved plan-wizard edit URL', async () => {
    renderPlanDetail()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Planaktionen \u00f6ffnen' }))
    await user.click(screen.getByRole('button', { name: 'Plan bearbeiten' }))

    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent(
      '/training/plans/new?edit=upper-body',
    )
  })

  it('starts this exact plan when no session is active', async () => {
    const { readDemoState } = renderPlanDetail('upper-body', {
      ...createInitialTrainingDemoState(),
      activeSession: undefined,
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Training starten' }))

    expect(readDemoState().activeSession).toMatchObject({ planId: 'upper-body' })
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
  })

  it('continues the existing session instead of starting the displayed plan', async () => {
    const initialState = createInitialTrainingDemoState()
    const activeSession = {
      ...initialState.activeSession!,
      id: 'session-existing-detail-conflict',
      name: 'Bestehendes Training',
      startedAt: '2026-07-31T08:00:00.000Z',
      updatedAt: '2026-07-31T08:15:00.000Z',
    }
    const { readDemoState } = renderPlanDetail('upper-body', {
      ...initialState,
      activeSession,
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Training fortsetzen' }))

    expect(readDemoState().activeSession).toBe(activeSession)
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
  })
})
