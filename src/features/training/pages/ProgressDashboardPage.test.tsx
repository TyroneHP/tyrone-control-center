import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import type { TrainingContextValue } from '../trainingContext'
import type { CompletedWorkout, ExerciseSnapshot, TrainingState } from '../model/trainingTypes'
import { ProgressDashboardPage } from './ProgressDashboardPage'

let training: TrainingContextValue
vi.mock('../useTraining', () => ({ useTraining: () => training }))

const CHEST: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: [], unit: 'kg-reps', supportsBodyweightModes: false,
}

function workout(index: number, hour = 10): CompletedWorkout {
  const date = `2026-07-${String(index + 20).padStart(2, '0')}`
  return {
    id: `workout-${index}-${hour}`, name: `Push ${index}`,
    startedAt: `${date}T${String(hour - 1).padStart(2, '0')}:00:00.000Z`,
    completedAt: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`,
    exercises: [{
      id: `entry-${index}-${hour}`, exerciseId: 'bench', exerciseSnapshot: CHEST,
      order: 0, targetSets: 2, repMin: 8, repMax: 12, loadMode: 'external', note: '',
      sets: [0, 1].map((setIndex) => ({
        id: `set-${index}-${hour}-${setIndex}`, weightKg: 80 + index,
        reps: 10, rating: 7, completed: true,
      })),
    }],
  }
}

function state(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    schemaVersion: 2,
    customExercises: [], favoriteExerciseIds: [], templates: [], activeWorkout: null,
    completedWorkouts: [], bodyWeightEntries: [],
    analyticsPreferences: {
      range: { preset: '30d' }, exerciseMetric: 'weight', muscleMetric: 'sets',
      dismissedBalanceInsightIds: [],
    },
    preferences: {
      showSetRating: true, progressionEnabled: true, successfulWorkoutCount: 3,
      maximumAverageRating: 8, defaultIncrementKg: 2.5,
    },
    ...overrides,
  }
}

function renderDashboard(currentState: TrainingState) {
  training = {
    state: currentState,
    loading: false,
    updateAnalyticsPreferences: vi.fn(),
    dismissBalanceInsight: vi.fn(),
  } as unknown as TrainingContextValue
  return render(
    <MemoryRouter>
      <ToastProvider><ProgressDashboardPage /></ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'))
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    addEventListener: vi.fn(), matches: false, media: '', removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ProgressDashboardPage', () => {
  it('renders metrics, quick links and explicit missing body-weight data', () => {
    renderDashboard(state({ completedWorkouts: [workout(0)] }))

    expect(screen.getByRole('heading', { name: 'Fortschritt' })).toBeInTheDocument()
    expect(screen.getByText('Trainings', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Abgeschlossene Sätze', { selector: 'dt' }).nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Körpergewichtsänderung', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Keine Messdaten')
    expect(screen.getByRole('link', { name: 'Übungsfortschritt öffnen' })).toHaveAttribute('href', '/training/progress/exercises')
    expect(screen.getByRole('link', { name: 'Körpergewicht öffnen' })).toHaveAttribute('href', '/training/progress/bodyweight')
  })

  it('persists valid period changes but rejects an invalid custom draft', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDashboard(state())

    await user.selectOptions(screen.getByLabelText('Zeitraum'), '7d')
    expect(training.updateAnalyticsPreferences).toHaveBeenCalledWith({ range: { preset: '7d' } })
    await user.selectOptions(screen.getByLabelText('Zeitraum'), 'custom')
    await user.type(screen.getByLabelText('Startdatum'), '2026-07-30')
    await user.type(screen.getByLabelText('Enddatum'), '2026-07-29')
    expect(screen.getByRole('alert')).toHaveTextContent('Startdatum darf nicht nach dem Enddatum')
    expect(training.updateAnalyticsPreferences).not.toHaveBeenCalledWith(expect.objectContaining({ range: expect.objectContaining({ preset: 'custom' }) }))
  })

  it('opens all workouts for a heatmap day with status and history links', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const complete = workout(0, 10)
    const incomplete = workout(0, 18)
    incomplete.exercises[0].sets[1].completed = false
    renderDashboard(state({ completedWorkouts: [complete, incomplete] }))

    await user.click(screen.getByRole('button', { name: /20\. Juli 2026.*3 abgeschlossene Sätze/i }))
    const dialog = screen.getByRole('dialog', { name: 'Trainings am 20. Juli 2026' })
    expect(within(dialog).getByText('Vollständig')).toBeInTheDocument()
    expect(within(dialog).getByText('Unvollständig')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('link', { name: 'Im Verlauf öffnen' })).toHaveLength(2)
  })

  it('shows qualifying neutral balance guidance and persists dismissal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDashboard(state({ completedWorkouts: [0, 1, 2, 3, 4].map((index) => workout(index)) }))

    const insight = screen.getByRole('article', { name: 'Orientierung: Rücken' })
    expect(insight).toHaveTextContent('Orientierung')
    await user.click(within(insight).getByRole('button', { name: 'Hinweis ausblenden' }))
    expect(training.dismissBalanceInsight).toHaveBeenCalledWith('back-versus-chest')
  })
})
