import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrainingContextValue } from '../trainingContext'
import type { CompletedWorkout, ExerciseSnapshot, TrainingState } from '../model/trainingTypes'
import { RecordAnalyticsPage } from './RecordAnalyticsPage'

let training: TrainingContextValue
vi.mock('../useTraining', () => ({ useTraining: () => training }))

const BENCH: ExerciseSnapshot = {
  exerciseId: 'bench', name: 'Bankdrücken', primaryMuscles: ['Brust'],
  secondaryMuscles: ['Trizeps'], unit: 'kg-reps', supportsBodyweightModes: false,
}
const ROW: ExerciseSnapshot = {
  ...BENCH, exerciseId: 'row', name: 'Rudern', primaryMuscles: ['Rücken'],
  secondaryMuscles: ['Bizeps'],
}

function workout(id: string, date: string, exercise: ExerciseSnapshot, weight: number, reps: number): CompletedWorkout {
  return {
    id, name: `Training ${id}`, startedAt: `${date}T09:00:00.000Z`,
    completedAt: `${date}T10:00:00.000Z`, exercises: [{
      id: `${id}-entry`, exerciseId: exercise.exerciseId, exerciseSnapshot: exercise,
      order: 0, targetSets: 1, repMin: 8, repMax: 12, loadMode: 'external', note: '',
      sets: [{ id: `${id}-set`, weightKg: weight, reps, rating: 7, completed: true }],
    }],
  }
}

function state(): TrainingState {
  return {
    schemaVersion: 2, customExercises: [], favoriteExerciseIds: [], templates: [],
    activeWorkout: null, bodyWeightEntries: [], completedWorkouts: [
      workout('bench-old', '2026-06-01', BENCH, 80, 8),
      workout('bench-new', '2026-07-25', BENCH, 85, 10),
      workout('row', '2026-07-26', ROW, 60, 12),
    ],
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
  training = { state: state(), loading: false, updateAnalyticsPreferences: vi.fn() } as unknown as TrainingContextValue
})
afterEach(() => vi.useRealTimers())

describe('RecordAnalyticsPage', () => {
  it('shows lifetime current records and strict period improvements with references', () => {
    render(<MemoryRouter><RecordAnalyticsPage /></MemoryRouter>)

    expect(screen.getByText('Aktuelle Rekorde (Gesamtzeit)')).toBeInTheDocument()
    const bench = screen.getByRole('article', { name: 'Rekorde: Bankdrücken' })
    expect(bench).toHaveTextContent('85 kg')
    expect(screen.getByText('Verbesserungen im gewählten Zeitraum')).toBeInTheDocument()
    const history = screen.getByRole('list', { name: 'Rekordhistorie' })
    expect(within(history).getByText(/vorher 80 kg/)).toBeInTheDocument()
    expect(within(history).getAllByText(/Satz 1/).length).toBeGreaterThan(0)
    expect(within(history).getAllByRole('link', { name: 'Training bench-new öffnen' })[0]).toHaveAttribute('href', '/training/history/bench-new')
  })

  it('filters current records and history by type, historical muscle and search', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><RecordAnalyticsPage /></MemoryRouter>)

    await user.selectOptions(screen.getByLabelText('Rekordart'), 'reps')
    expect(within(screen.getByRole('article', { name: 'Rekorde: Bankdrücken' })).queryByText('Höchstes Gewicht')).not.toBeInTheDocument()
    expect(screen.getAllByText('Meiste Wiederholungen').length).toBeGreaterThan(0)
    await user.selectOptions(screen.getByLabelText('Muskelgruppe'), 'Rücken')
    expect(screen.getByRole('article', { name: 'Rekorde: Rudern' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Rekorde: Bankdrücken' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Übung suchen' }), 'bank')
    expect(screen.getByText('Keine Rekorde für diese Filter.')).toBeInTheDocument()
  })
})
