import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import type { TrainingContextValue } from '../trainingContext'
import type {
  CompletedWorkout,
  ExerciseDefinition,
  ExerciseSnapshot,
  TrainingState,
} from '../model/trainingTypes'
import { ExerciseAnalyticsPage } from './ExerciseAnalyticsPage'

let training: TrainingContextValue
vi.mock('../useTraining', () => ({ useTraining: () => training }))

const BENCH: ExerciseDefinition = {
  id: 'bench', source: 'standard', name: 'Bankdrücken',
  primaryMuscles: ['Brust'], secondaryMuscles: ['Trizeps'],
  equipment: ['Langhantel'], unit: 'kg-reps', description: '',
  gripOptions: ['mittel'], supportsBodyweightModes: false,
}
const ROW: ExerciseDefinition = {
  ...BENCH, id: 'row', name: 'Rudern', primaryMuscles: ['Rücken'],
  secondaryMuscles: ['Bizeps'], equipment: ['Kabelzug'],
}
const PULL_UP: ExerciseDefinition = {
  ...BENCH, id: 'pull-up', name: 'Klimmzug', primaryMuscles: ['Latissimus'],
  secondaryMuscles: ['Bizeps'], equipment: ['Klimmzugstange'], unit: 'reps',
  supportsBodyweightModes: true,
}

function snapshot(exercise: ExerciseDefinition): ExerciseSnapshot {
  return {
    exerciseId: exercise.id, name: exercise.name,
    primaryMuscles: [...exercise.primaryMuscles],
    secondaryMuscles: [...exercise.secondaryMuscles], unit: exercise.unit,
    supportsBodyweightModes: exercise.supportsBodyweightModes,
  }
}

function workout(
  id: string,
  date: string,
  exercise: ExerciseSnapshot,
  weightKg: number,
): CompletedWorkout {
  return {
    id, name: `Training ${id}`, startedAt: `${date}T09:00:00.000Z`,
    completedAt: `${date}T10:00:00.000Z`,
    exercises: [{
      id: `${id}-entry`, exerciseId: exercise.exerciseId,
      exerciseSnapshot: exercise, order: 0, targetSets: 1, repMin: 8,
      repMax: 12, grip: 'mittel', loadMode: 'external', note: '',
      sets: [{
        id: `${id}-set`, weightKg, reps: 10, rating: 7, completed: true,
      }],
    }],
  }
}

function state(): TrainingState {
  const deleted: ExerciseSnapshot = {
    ...snapshot(ROW), exerciseId: 'deleted-row', name: 'Historisches Rudern',
  }
  return {
    schemaVersion: 2, customExercises: [], favoriteExerciseIds: ['row'],
    templates: [], activeWorkout: null, bodyWeightEntries: [],
    completedWorkouts: [
      workout('first', '2026-07-20', snapshot(BENCH), 80),
      workout('second', '2026-07-25', snapshot(BENCH), 85),
      workout('deleted', '2026-07-23', deleted, 60),
    ],
    analyticsPreferences: {
      range: { preset: 'all' }, exerciseMetric: 'weight', muscleMetric: 'sets',
      dismissedBalanceInsightIds: [],
    },
    preferences: {
      showSetRating: true, progressionEnabled: true, successfulWorkoutCount: 3,
      maximumAverageRating: 8, defaultIncrementKg: 2.5,
    },
  }
}

function renderPage(path = '/training/progress/exercises') {
  training = {
    state: state(), catalog: [BENCH, ROW], loading: false,
    updateAnalyticsPreferences: vi.fn(),
  } as unknown as TrainingContextValue
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider><ExerciseAnalyticsPage /></ToastProvider>
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

describe('ExerciseAnalyticsPage', () => {
  it('searches and filters current plus historical exercises and can prioritize favorites', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    expect(screen.getByRole('button', { name: /Historisches Rudern/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Hauptmuskel'), 'Brust')
    expect(screen.getByRole('button', { name: /Bankdrücken/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Historisches Rudern/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Hauptmuskel'), '')
    await user.type(screen.getByRole('searchbox', { name: 'Übung suchen' }), 'rudern')
    expect(screen.getByRole('button', { name: /Historisches Rudern/ })).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Übung suchen' }))
    await user.click(screen.getByRole('checkbox', { name: 'Favoriten zuerst' }))
    expect(screen.getAllByRole('button', { name: /analysieren/ })[0]).toHaveAccessibleName(/Rudern/)
  })

  it('inherits the period, persists metric switches and opens complete point details', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage('/training/progress/exercises?exercise=bench')

    expect(screen.getByRole('img', { name: 'Gewichtsverlauf Bankdrücken' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Kennzahl'), 'volume')
    expect(training.updateAnalyticsPreferences).toHaveBeenCalledWith({ exerciseMetric: 'volume' })
    expect(screen.getByRole('img', { name: 'Volumenverlauf Bankdrücken' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /25\. Juli 2026: 850 kg/ }))
    const dialog = screen.getByRole('dialog', { name: 'Training second' })
    expect(within(dialog).getByText('85 kg')).toBeInTheDocument()
    expect(within(dialog).getByText('10 Wiederholungen')).toBeInTheDocument()
    expect(within(dialog).getByText('Bewertung 7')).toBeInTheDocument()
    expect(within(dialog).getByText('Griff: mittel')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Training im Verlauf öffnen' })).toHaveAttribute('href', '/training/history/second')
  })

  it('does not offer weight-derived metrics for weightless exercises', () => {
    const plank: ExerciseDefinition = {
      ...BENCH, id: 'plank', name: 'Plank', primaryMuscles: ['Bauch'],
      secondaryMuscles: [], equipment: ['Eigengewicht'], unit: 'seconds',
    }
    training = {
      state: { ...state(), completedWorkouts: [] }, catalog: [plank], loading: false,
      updateAnalyticsPreferences: vi.fn(),
    } as unknown as TrainingContextValue
    render(<MemoryRouter><ExerciseAnalyticsPage /></MemoryRouter>)

    expect(screen.queryByRole('option', { name: 'Gewicht' })).not.toBeInTheDocument()
    expect(screen.getByText('Noch keine passenden Trainingsdaten vorhanden.')).toBeInTheDocument()
  })

  it('offers load, volume and 1RM for bodyweight exercises with a historical snapshot', () => {
    const pullUpWorkout = workout(
      'pull-up-workout',
      '2026-07-25',
      snapshot(PULL_UP),
      0,
    )
    pullUpWorkout.exercises[0] = {
      ...pullUpWorkout.exercises[0],
      loadMode: 'bodyweight',
      bodyWeightSnapshot: {
        weightKg: 80,
        sourceDate: '2026-07-25',
        capturedAt: '2026-07-25T10:00:00.000Z',
      },
      sets: [{
        ...pullUpWorkout.exercises[0].sets[0],
        weightKg: null,
        reps: 8,
      }],
    }
    training = {
      state: { ...state(), completedWorkouts: [pullUpWorkout] },
      catalog: [PULL_UP],
      loading: false,
      updateAnalyticsPreferences: vi.fn(),
    } as unknown as TrainingContextValue
    render(
      <MemoryRouter initialEntries={['/training/progress/exercises?exercise=pull-up']}>
        <ExerciseAnalyticsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('option', { name: 'Gewicht' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Volumen' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Geschätztes 1RM' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gewichtsverlauf Klimmzug' })).toBeInTheDocument()
  })
})
