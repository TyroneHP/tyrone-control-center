import { useEffect, useReducer, type ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialTrainingDemoState } from '../demo/mockTrainingData'
import { trainingDemoReducer } from '../demo/trainingDemoReducer'
import type { TrainingDemoState } from '../demo/trainingDemoTypes'
import { TrainingDemoContext, useTrainingDemo } from '../demo/useTrainingDemo'
import { TrainingActiveSessionPage } from './TrainingActiveSessionPage'
import { TrainingDashboardPage } from './TrainingDashboardPage'

function DemoHarness({ children, initialState }: {
  children: ReactNode
  initialState: TrainingDemoState
}) {
  const [state, dispatch] = useReducer(trainingDemoReducer, initialState)

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

function DemoStateReader({ onStateChange }: { onStateChange: (state: TrainingDemoState) => void }) {
  const state = useTrainingDemo().state
  useEffect(() => onStateChange(state), [onStateChange, state])
  return null
}

function LocationMarker() {
  const location = useLocation()
  return <output aria-label="Aktueller Pfad">{location.pathname}</output>
}

function createThreeExerciseState(): TrainingDemoState {
  const state = createInitialTrainingDemoState()
  const session = state.activeSession
  if (!session) throw new Error('Die Demo-Sitzung fehlt.')

  return {
    ...state,
    activeSession: {
      ...session,
      exercises: [
        ...session.exercises,
        {
          id: 'session-extra-exercise',
          exerciseId: 'barbell-row',
          order: 2,
          note: '',
          sets: [{ id: 'session-extra-exercise-set-1', weightKg: 0, repetitions: 0, completed: false }],
        },
      ],
    },
  }
}

function renderActiveSession(initialState = createThreeExerciseState()) {
  let demoState = initialState
  render(
    <MemoryRouter initialEntries={['/training/active']}>
      <DemoHarness initialState={initialState}>
        <Routes>
          <Route path="/training" element={<TrainingDashboardPage />} />
          <Route path="/training/active" element={<TrainingActiveSessionPage />} />
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

describe('TrainingActiveSessionPage', () => {
  it('changes only the current in-memory set', async () => {
    const { readDemoState } = renderActiveSession()
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('Satz 1 Gewicht'))
    await user.type(screen.getByLabelText('Satz 1 Gewicht'), '62.5')
    await user.click(screen.getByLabelText('Satz 1 abgeschlossen'))

    expect(readDemoState().activeSession?.exercises[0].sets[0]).toMatchObject({
      weightKg: 62.5,
      completed: true,
    })
    expect(readDemoState().activeSession?.exercises[1].sets[0]).toMatchObject({
      weightKg: 0,
      completed: false,
    })
  })

  it('moves on a horizontal content swipe but ignores an input swipe', () => {
    renderActiveSession()

    fireEvent.pointerDown(screen.getByTestId('active-exercise-content'), { pointerId: 1, clientX: 280, clientY: 100 })
    fireEvent.pointerUp(screen.getByTestId('active-exercise-content'), { pointerId: 1, clientX: 80, clientY: 100 })
    expect(screen.getByText('2 von 3 Übungen')).toBeVisible()

    fireEvent.pointerDown(screen.getByLabelText('Satz 1 Gewicht'), { pointerId: 2, clientX: 280, clientY: 100 })
    fireEvent.pointerUp(screen.getByLabelText('Satz 1 Gewicht'), { pointerId: 2, clientX: 80, clientY: 100 })
    expect(screen.getByText('2 von 3 Übungen')).toBeVisible()
  })

  it('does not begin a content swipe from a weight input', () => {
    renderActiveSession()
    const input = screen.getByLabelText('Satz 1 Gewicht')
    const content = screen.getByTestId('active-exercise-content')

    fireEvent.pointerDown(input, { pointerId: 3, clientX: 280, clientY: 100 })
    fireEvent.pointerUp(content, { pointerId: 3, clientX: 80, clientY: 100 })

    expect(screen.getByText('1 von 3 Übungen')).toBeVisible()
  })

  it('requires confirmation before discard', async () => {
    renderActiveSession()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Training verwerfen' }))

    expect(screen.getByRole('dialog', { name: 'Training wirklich verwerfen?' })).toBeVisible()
  })

  it('discards only the active session after confirmation and returns to training', async () => {
    const { readDemoState } = renderActiveSession()
    const plans = readDemoState().plans
    const exercises = readDemoState().exercises
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Training verwerfen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Endgültig verwerfen' }))

    expect(readDemoState().activeSession).toBeUndefined()
    expect(readDemoState().plans).toBe(plans)
    expect(readDemoState().exercises).toBe(exercises)
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training')
  })

  it('finishes only the active session after confirmation and returns to training', async () => {
    const { readDemoState } = renderActiveSession()
    const plans = readDemoState().plans
    const exercises = readDemoState().exercises
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Training abschließen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Training abschließen' }))

    expect(readDemoState().activeSession).toBeUndefined()
    expect(readDemoState().plans).toBe(plans)
    expect(readDemoState().exercises).toBe(exercises)
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training')
  })

  it('shows a German empty state for a free session without exercises', () => {
    const state = createInitialTrainingDemoState()
    state.activeSession = {
      id: 'free-session',
      planId: 'free-training',
      name: 'Freies Training',
      startedAt: '2026-08-02T09:00:00.000Z',
      updatedAt: '2026-08-02T09:00:00.000Z',
      activeExerciseIndex: 0,
      exercises: [],
    }

    renderActiveSession(state)

    expect(screen.getByRole('heading', { name: 'Noch keine Übungen' })).toBeVisible()
    expect(screen.getByText('Füge im freien Training zuerst Übungen hinzu.')).toBeVisible()
  })

  it('adds, edits and removes a catalog exercise in a free session', async () => {
    const state = createInitialTrainingDemoState()
    state.activeSession = {
      id: 'free-session',
      planId: 'free-training',
      name: 'Freies Training',
      startedAt: '2026-08-02T09:00:00.000Z',
      updatedAt: '2026-08-02T09:00:00.000Z',
      activeExerciseIndex: 0,
      exercises: [],
    }
    const { readDemoState } = renderActiveSession(state)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Bankdrücken hinzufügen' }))
    await user.clear(screen.getByLabelText('Satz 1 Gewicht'))
    await user.type(screen.getByLabelText('Satz 1 Gewicht'), '55')
    await user.click(screen.getByRole('button', { name: 'Bankdrücken entfernen' }))

    expect(readDemoState().activeSession?.exercises).toEqual([])
  })

  it('keeps grip, note and rating while leaving and continuing the active route', async () => {
    renderActiveSession()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Nächste Übung' }))
    await user.click(screen.getByRole('button', { name: 'Griff wählen' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Griff wählen' })).getByRole('button', { name: 'Neutral' }))
    await user.type(screen.getByLabelText('Notiz für Latziehen zur Brust'), 'Langsam ablassen')
    await user.clear(screen.getByLabelText('Satz 1 Bewertung'))
    await user.type(screen.getByLabelText('Satz 1 Bewertung'), '8')
    await user.click(screen.getByRole('button', { name: 'Zurück' }))
    await user.click(screen.getByRole('button', { name: 'Training fortsetzen' }))

    expect(screen.getByText('Griff: Neutral')).toBeVisible()
    expect(screen.getByLabelText('Notiz für Latziehen zur Brust')).toHaveValue('Langsam ablassen')
    expect(screen.getByLabelText('Satz 1 Bewertung')).toHaveValue(8)
  })
})
