import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../design-system'
import { TrainingProvider } from './TrainingProvider'
import { TrainingRecoveryDialog } from './components/TrainingRecoveryDialog'
import { EMPTY_TRAINING_STATE } from './model/trainingDefaults'
import type { TrainingState } from './model/trainingTypes'
import type { TrainingRepository } from './persistence/trainingRepository'
import { TrainingDataCorruptionError } from './persistence/trainingMigrations'
import { TrainingSettings } from './TrainingSettings'

function trainingState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    ...EMPTY_TRAINING_STATE,
    preferences: { ...EMPTY_TRAINING_STATE.preferences },
    ...overrides,
  }
}

function createRepository(
  state = trainingState(),
  overrides: Partial<TrainingRepository> = {},
): TrainingRepository {
  return {
    deleteImage: vi.fn(async () => undefined),
    exportRaw: vi.fn(async () => 'null'),
    load: vi.fn(async () => state),
    loadImage: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    saveImage: vi.fn(async () => undefined),
    ...overrides,
  }
}

function renderTrainingSettings(repository = createRepository()) {
  render(
    <ToastProvider>
      <TrainingProvider profileId="profile-a" repository={repository}>
        <TrainingSettings />
        <TrainingRecoveryDialog />
      </TrainingProvider>
    </ToastProvider>,
  )
  return repository
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    })),
  )
})

describe('TrainingSettings', () => {
  it('persists visible rating and progression preferences without a network call', async () => {
    const user = userEvent.setup()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const repository = renderTrainingSettings()

    await screen.findByRole('heading', { name: 'Training' })
    expect(screen.getByLabelText('Satzbewertungen anzeigen')).toBeChecked()
    expect(screen.getByLabelText('Progressive Steigerung aktivieren')).toBeChecked()
    expect(screen.getByLabelText('Erfolgreiche Trainings')).toHaveValue(3)
    expect(screen.getByLabelText('Maximale Durchschnittsbewertung')).toHaveValue(8)
    expect(screen.getByLabelText('Standardsteigerung in kg')).toHaveValue(2.5)

    await user.click(screen.getByLabelText('Satzbewertungen anzeigen'))
    await user.click(screen.getByLabelText('Progressive Steigerung aktivieren'))

    expect(screen.getByLabelText('Erfolgreiche Trainings')).toBeDisabled()
    expect(screen.getByLabelText('Maximale Durchschnittsbewertung')).toBeDisabled()
    expect(screen.getByLabelText('Standardsteigerung in kg')).toBeDisabled()
    await waitFor(() => {
      expect(vi.mocked(repository.save)).toHaveBeenLastCalledWith(
        'profile-a',
        expect.objectContaining({
          preferences: expect.objectContaining({
            progressionEnabled: false,
            showSetRating: false,
          }),
        }),
      )
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('constrains progression thresholds and half-kilogram increments before persisting', async () => {
    const user = userEvent.setup()
    const repository = renderTrainingSettings()

    await screen.findByRole('heading', { name: 'Training' })
    const successful = screen.getByLabelText('Erfolgreiche Trainings')
    const rating = screen.getByLabelText('Maximale Durchschnittsbewertung')
    const increment = screen.getByLabelText('Standardsteigerung in kg')

    expect(successful).toHaveAttribute('min', '2')
    expect(successful).toHaveAttribute('max', '5')
    expect(rating).toHaveAttribute('min', '1')
    expect(rating).toHaveAttribute('max', '10')
    expect(increment).toHaveAttribute('min', '0.5')
    expect(increment).toHaveAttribute('step', '0.5')

    await user.clear(successful)
    await user.type(successful, '1')
    await user.clear(rating)
    await user.type(rating, '11')
    await user.clear(increment)
    await user.type(increment, '1.3')
    await user.tab()

    expect(successful).toHaveValue(2)
    expect(rating).toHaveValue(10)
    expect(increment).toHaveValue(1.5)
    await waitFor(() => {
      expect(vi.mocked(repository.save)).toHaveBeenLastCalledWith(
        'profile-a',
        expect.objectContaining({
          preferences: expect.objectContaining({
            defaultIncrementKg: 1.5,
            maximumAverageRating: 10,
            successfulWorkoutCount: 2,
          }),
        }),
      )
    })
  })
})

describe('TrainingRecoveryDialog', () => {
  it('exports untouched corrupt raw data and leaves it unchanged when cancelled', async () => {
    const user = userEvent.setup()
    const raw = '{"schemaVersion":"invalid","entries":["untouched"]}'
    const repository = createRepository(trainingState(), {
      exportRaw: vi.fn(async () => raw),
      load: vi.fn(async () => {
        throw new TrainingDataCorruptionError('Beschädigte Trainingsdaten')
      }),
    })
    const createObjectURL = vi.fn(() => 'blob:training-export')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    renderTrainingSettings(repository)

    const dialog = await screen.findByRole('dialog', {
      name: 'Trainingsdaten wiederherstellen',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Rohdaten exportieren' }))
    expect(repository.exportRaw).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()

    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(repository.reset).not.toHaveBeenCalled()
    expect(repository.exportRaw).toHaveBeenCalledOnce()
  })

  it('requires confirmation before resetting corrupted training data', async () => {
    const user = userEvent.setup()
    const corruption = new TrainingDataCorruptionError('Beschädigte Trainingsdaten')
    const repository = createRepository(trainingState(), {
      load: vi
        .fn()
        .mockRejectedValueOnce(corruption)
        .mockResolvedValue(trainingState()),
    })

    renderTrainingSettings(repository)

    const dialog = await screen.findByRole('dialog', {
      name: 'Trainingsdaten wiederherstellen',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Trainingsbereich zurücksetzen' }),
    )
    const confirmation = await screen.findByRole('dialog', {
      name: 'Trainingsbereich zurücksetzen?',
    })
    expect(repository.reset).not.toHaveBeenCalled()

    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Zurücksetzen bestätigen',
      }),
    )
    await waitFor(() => {
      expect(repository.reset).toHaveBeenCalledWith('profile-a')
    })
    await expect(
      screen.queryByRole('dialog', { name: 'Trainingsdaten wiederherstellen' }),
    ).not.toBeInTheDocument()
  })
})
