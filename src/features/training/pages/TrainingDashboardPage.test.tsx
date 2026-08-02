import { useEffect, useReducer, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TrainingDemoContext,
  useTrainingDemo,
} from '../demo/useTrainingDemo'
import { createInitialTrainingDemoState } from '../demo/mockTrainingData'
import { trainingDemoReducer } from '../demo/trainingDemoReducer'
import type { TrainingDemoState } from '../demo/trainingDemoTypes'
import { TrainingDashboardPage } from './TrainingDashboardPage'

function DemoHarness({ children, initialState }: {
  children: ReactNode
  initialState: TrainingDemoState
}) {
  const [state, dispatch] = useReducer(trainingDemoReducer, initialState)

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
  return <output aria-label="Aktueller Pfad">{useLocation().pathname}</output>
}

function renderDashboard(initialState = createInitialTrainingDemoState()) {
  let demoState = initialState
  render(
    <MemoryRouter initialEntries={['/training']}>
      <DemoHarness initialState={initialState}>
        <Routes>
          <Route path="/training" element={<TrainingDashboardPage />} />
          <Route path="/training/active" element={<p>Aktives Training</p>} />
          <Route path="/training/library" element={<p>Bibliothek</p>} />
          <Route path="/training/plans/:planId" element={<p>Plan</p>} />
        </Routes>
        <DemoStateReader onStateChange={(state) => { demoState = state }} />
        <LocationMarker />
      </DemoHarness>
    </MemoryRouter>,
  )
  return { readDemoState: () => demoState }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-03T09:00:00.000Z'))
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media: query,
    removeEventListener: vi.fn(),
  }))
})

describe('TrainingDashboardPage', () => {
  it('continues one active session rather than creating another', async () => {
    const activeSession = createInitialTrainingDemoState().activeSession
    const { readDemoState } = renderDashboard()
    vi.useRealTimers()

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Training fortsetzen' }),
    )

    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
    expect(readDemoState().activeSession).toEqual(activeSession)
  })

  it('offers today plan, another plan and free workout', async () => {
    const initialState = {
      ...createInitialTrainingDemoState(),
      activeSession: undefined,
    }
    renderDashboard(initialState)
    vi.useRealTimers()

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Training starten' }),
    )

    expect(screen.getByRole('dialog', { name: 'Training starten' })).toHaveTextContent(
      'Heutigen PlanAnderen PlanFreies Training',
    )
  })

  it('shows active duration and completed-set progress with a labelled progress bar', () => {
    const initial = createInitialTrainingDemoState()
    initial.activeSession!.exercises[0].sets[0].completed = true
    renderDashboard(initial)

    expect(screen.getByText('Dauer: 1440 Min.')).toBeVisible()
    expect(screen.getByText('1 von 6 Sätzen abgeschlossen')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Trainingsfortschritt' })).toHaveAttribute('value', '1')
    expect(screen.getByRole('progressbar', { name: 'Trainingsfortschritt' })).toHaveAttribute('max', '6')
  })

  it('shows no today-plan choice when no plan matches the current weekday', async () => {
    vi.setSystemTime(new Date('2026-08-04T09:00:00.000Z'))
    renderDashboard({ ...createInitialTrainingDemoState(), activeSession: undefined })
    vi.useRealTimers()

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Training starten' }),
    )

    expect(screen.getByRole('dialog', { name: 'Training starten' })).not.toHaveTextContent(
      'Heutigen Plan',
    )
  })

  it('starts a free session from the dashboard row when none is active', async () => {
    const { readDemoState } = renderDashboard({
      ...createInitialTrainingDemoState(),
      activeSession: undefined,
    })
    vi.useRealTimers()

    await userEvent.setup().click(
      screen.getByRole('button', { name: /Freies Training/ }),
    )

    expect(readDemoState().activeSession).toMatchObject({
      name: 'Freies Training',
    })
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training/active')
  })
})
