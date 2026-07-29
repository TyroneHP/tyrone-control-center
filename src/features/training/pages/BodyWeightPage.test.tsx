import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import type { TrainingContextValue } from '../trainingContext'
import type { BodyWeightEntry, TrainingState } from '../model/trainingTypes'
import { BodyWeightPage } from './BodyWeightPage'

let training: TrainingContextValue
vi.mock('../useTraining', () => ({ useTraining: () => training }))

const ENTRIES: BodyWeightEntry[] = [
  { id: 'old', date: '2026-07-20', weightKg: 80, note: 'Morgens', createdAt: '2026-07-20T08:00:00Z', updatedAt: '2026-07-20T08:00:00Z' },
  { id: 'new', date: '2026-07-25', weightKg: 79, note: 'Nach dem Aufstehen', createdAt: '2026-07-25T08:00:00Z', updatedAt: '2026-07-25T08:00:00Z' },
]

function state(entries = ENTRIES): TrainingState {
  return {
    schemaVersion: 2, customExercises: [], favoriteExerciseIds: [], templates: [],
    activeWorkout: null, completedWorkouts: [], bodyWeightEntries: entries,
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

function renderPage(entries = ENTRIES, overrides: Partial<TrainingContextValue> = {}) {
  training = {
    state: state(entries), loading: false, saveBodyWeightEntry: vi.fn(async () => true),
    moveBodyWeightEntry: vi.fn(async () => true), deleteBodyWeightEntry: vi.fn(async () => true),
    updateAnalyticsPreferences: vi.fn(), ...overrides,
  } as unknown as TrainingContextValue
  return render(<ToastProvider><BodyWeightPage /></ToastProvider>)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'))
  vi.stubGlobal('matchMedia', vi.fn(() => ({ addEventListener: vi.fn(), matches: false, media: '', removeEventListener: vi.fn() })))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('BodyWeightPage', () => {
  it('shows summary, raw values, seven-day trend and a tappable note', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    expect(screen.getByText('Aktuelles Gewicht').nextElementSibling).toHaveTextContent('79 kg')
    expect(screen.getByText('Veränderung im Zeitraum').nextElementSibling).toHaveTextContent('-1 kg')
    expect(screen.getByText('Messungen').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Rohwerte')).toBeInTheDocument()
    expect(screen.getByText('7-Tage-Durchschnitt')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /25\. Juli 2026: 79 kg/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Nach dem Aufstehen')
  })

  it('validates and creates a measurement with a decimal keyboard hint', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage([])
    await user.click(screen.getByRole('button', { name: 'Messung hinzufügen' }))
    const dialog = screen.getByRole('dialog', { name: 'Messung hinzufügen' })
    const weight = within(dialog).getByLabelText('Gewicht in kg')
    expect(weight).toHaveAttribute('inputmode', 'decimal')
    await user.clear(weight)
    await user.type(weight, '10')
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('zwischen 20 und 500 kg')
    await user.clear(weight)
    await user.type(weight, '78,5')
    await user.type(within(dialog).getByLabelText('Notiz (optional)'), 'Abends')
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    expect(training.saveBodyWeightEntry).toHaveBeenCalledWith(
      { date: '2026-07-29', weightKg: 78.5, note: 'Abends' },
      expect.any(String),
    )
  })

  it('edits entries, reports a date conflict before writing and deletes only after confirmation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Messung vom 20. Juli 2026 bearbeiten' }))
    const edit = screen.getByRole('dialog', { name: 'Messung bearbeiten' })
    const date = within(edit).getByLabelText('Datum')
    await user.clear(date)
    await user.type(date, '2026-07-25')
    await user.click(within(edit).getByRole('button', { name: 'Speichern' }))
    expect(within(edit).getByRole('alert')).toHaveTextContent('Für dieses Datum besteht bereits eine Messung')
    expect(training.moveBodyWeightEntry).not.toHaveBeenCalled()
    await user.click(within(edit).getByRole('button', { name: 'Abbrechen' }))

    await user.click(screen.getByRole('button', { name: 'Messung vom 20. Juli 2026 löschen' }))
    const deletion = screen.getByRole('dialog', { name: 'Messung wirklich löschen?' })
    await user.click(within(deletion).getByRole('button', { name: 'Endgültig löschen' }))
    expect(training.deleteBodyWeightEntry).toHaveBeenCalledWith('old')
  })

  it('keeps the form open and offers retry when local persistence fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage([], { saveBodyWeightEntry: vi.fn(async () => false) })
    await user.click(screen.getByRole('button', { name: 'Messung hinzufügen' }))
    const dialog = screen.getByRole('dialog', { name: 'Messung hinzufügen' })
    await user.type(within(dialog).getByLabelText('Gewicht in kg'), '80')
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Messung konnte nicht gespeichert werden')
    expect(within(dialog).getByRole('button', { name: 'Erneut speichern' })).toBeInTheDocument()
  })
})
