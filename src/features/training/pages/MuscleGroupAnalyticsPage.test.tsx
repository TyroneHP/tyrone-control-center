import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrainingContextValue } from '../trainingContext'
import type { CompletedWorkout, ExerciseSnapshot, TrainingState } from '../model/trainingTypes'
import { MuscleGroupAnalyticsPage } from './MuscleGroupAnalyticsPage'

let training: TrainingContextValue
vi.mock('../useTraining', () => ({ useTraining: () => training }))

const BENCH: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: ['Trizeps'], unit: 'kg-reps', supportsBodyweightModes: false,
}

function workout(): CompletedWorkout {
  return {
    id: 'push', name: 'Push', startedAt: '2026-07-25T09:00:00.000Z',
    completedAt: '2026-07-25T10:00:00.000Z', exercises: [{
      id: 'bench-entry', exerciseId: 'bench', exerciseSnapshot: BENCH,
      order: 0, targetSets: 2, repMin: 8, repMax: 12, loadMode: 'external', note: '',
      sets: [
        { id: 'set-1', weightKg: 100, reps: 8, rating: 8, completed: true },
        { id: 'set-2', weightKg: 100, reps: 8, rating: 8, completed: true },
      ],
    }],
  }
}

function state(): TrainingState {
  return {
    schemaVersion: 2, customExercises: [], favoriteExerciseIds: [], templates: [],
    activeWorkout: null, completedWorkouts: [workout()], bodyWeightEntries: [],
    analyticsPreferences: {
      range: { preset: '30d' }, exerciseMetric: 'weight', muscleMetric: 'sets',
      dismissedBalanceInsightIds: [],
    },
    preferences: {
      showSetRating: true, progressionEnabled: true, successfulWorkoutCount: 3,
      maximumAverageRating: 8, defaultIncrementKg: 2.5,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'))
  vi.stubGlobal('matchMedia', vi.fn(() => ({ addEventListener: vi.fn(), matches: false, media: '', removeEventListener: vi.fn() })))
  training = { state: state(), loading: false, updateAnalyticsPreferences: vi.fn() } as unknown as TrainingContextValue
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('MuscleGroupAnalyticsPage', () => {
  it('shows a sorted accessible chart, values, shares and the weighting explanation', () => {
    render(<MemoryRouter><MuscleGroupAnalyticsPage /></MemoryRouter>)

    expect(screen.getByRole('img', { name: 'Gewichtete Sätze nach Muskelgruppe' })).toBeInTheDocument()
    const ranking = screen.getByRole('list', { name: 'Muskelgruppen-Rangliste' })
    expect(within(ranking).getAllByRole('listitem')[0]).toHaveTextContent('Brust')
    expect(within(ranking).getByText(/2 gewichtete Sätze/)).toBeInTheDocument()
    expect(screen.getByText(/Primärmuskeln zählen zu 100 %/)).toBeInTheDocument()
  })

  it('persists the metric and opens exercise contributions with analysis links', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><MuscleGroupAnalyticsPage /></MemoryRouter>)

    await user.selectOptions(screen.getByLabelText('Kennzahl'), 'volume')
    expect(training.updateAnalyticsPreferences).toHaveBeenCalledWith({ muscleMetric: 'volume' })
    expect(screen.getByRole('img', { name: 'Volumen nach Muskelgruppe' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Brust: 1.600 kg/ }))
    const dialog = screen.getByRole('dialog', { name: 'Muskelgruppe Brust' })
    expect(within(dialog).getAllByText(/Bankdrücken/).length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/2 gewichtete Sätze/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Bankdrücken analysieren' })).toHaveAttribute('href', '/training/progress/exercises?exercise=bench')
  })
})
