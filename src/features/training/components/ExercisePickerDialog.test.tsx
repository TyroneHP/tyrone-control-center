import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type { ExerciseDefinition, TrainingState } from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { useTraining, type TrainingContextValue } from '../useTraining'
import { ExercisePickerDialog } from './ExercisePickerDialog'

const CUSTOM_WITH_IMAGE: ExerciseDefinition = {
  customImageId: 'image-old',
  description: 'Einarmig zur Hüfte ziehen.',
  equipment: ['Kurzhantel'],
  gripOptions: ['Neutralgriff'],
  id: 'custom:row',
  name: 'Eigenes Rudern',
  primaryMuscles: ['Latissimus'],
  secondaryMuscles: ['Bizeps'],
  source: 'custom',
  supportsBodyweightModes: false,
  unit: 'kg-reps',
}

function trainingState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    schemaVersion: 1,
    customExercises: [],
    favoriteExerciseIds: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    preferences: {
      showSetRating: true,
      progressionEnabled: true,
      successfulWorkoutCount: 3,
      maximumAverageRating: 8,
      defaultIncrementKg: 2.5,
    },
    ...overrides,
  }
}

function CaptureTraining({
  capture,
}: {
  capture: (training: TrainingContextValue) => void
}) {
  const training = useTraining()
  useEffect(() => capture(training), [capture, training])
  return null
}

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ExercisePickerDialog custom images', () => {
  it('loads profile-bound custom images and revokes their URLs on replacement and unmount', async () => {
    const oldBlob = new Blob(['old'], { type: 'image/webp' })
    const newBlob = new Blob(['new'], { type: 'image/webp' })
    const createObjectURL = vi.fn((blob: Blob) =>
      blob === oldBlob ? 'blob:custom-old' : 'blob:custom-new',
    )
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const initialState = trainingState({ customExercises: [CUSTOM_WITH_IMAGE] })
    const repository: TrainingRepository = {
      deleteImage: vi.fn(async () => undefined),
      exportRaw: vi.fn(async () => 'null'),
      load: vi.fn(async () => initialState),
      loadImage: vi.fn(async (_profileId, imageId) =>
        imageId === 'image-old' ? oldBlob : newBlob,
      ),
      reset: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
      saveImage: vi.fn(async () => undefined),
    }
    let training: TrainingContextValue | undefined
    const capture = (value: TrainingContextValue) => {
      training = value
    }
    const user = userEvent.setup()
    const page = render(
      <ToastProvider>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <CaptureTraining capture={capture} />
          <ExercisePickerDialog onClose={vi.fn()} onSelect={vi.fn()} open />
        </TrainingProvider>
      </ToastProvider>,
    )

    const picker = await screen.findByRole('dialog', { name: 'Übung auswählen' })
    const card = await within(picker).findByRole('article', {
      name: 'Eigenes Rudern',
    })
    expect(
      await within(card).findByRole('img', { name: 'Abbildung: Eigenes Rudern' }),
    ).toHaveAttribute('src', 'blob:custom-old')
    await user.click(
      within(card).getByRole('button', { name: 'Details zu Eigenes Rudern' }),
    )
    const details = await screen.findByRole('dialog', { name: 'Eigenes Rudern' })
    expect(
      within(details).getByRole('img', { name: 'Abbildung: Eigenes Rudern' }),
    ).toHaveAttribute('src', 'blob:custom-old')

    await act(async () => {
      await Promise.resolve(
        training!.saveCustomExercise({
          ...CUSTOM_WITH_IMAGE,
          customImageId: 'image-new',
        }),
      )
    })

    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:custom-old'),
    )
    await waitFor(() =>
      expect(repository.loadImage).toHaveBeenCalledWith('profile-a', 'image-new'),
    )
    expect(
      within(card).getByRole('img', { name: 'Abbildung: Eigenes Rudern' }),
    ).toHaveAttribute('src', 'blob:custom-new')

    page.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:custom-new')
  })

  it('falls back when a stored custom image is missing or corrupt', async () => {
    const corruptBlob = new Blob(['broken'], { type: 'image/webp' })
    const createObjectURL = vi.fn(() => 'blob:corrupt-custom-image')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
    const missingExercise = {
      ...CUSTOM_WITH_IMAGE,
      customImageId: 'image-missing',
      id: 'custom:missing',
      name: 'Fehlendes Bild',
    }
    const corruptExercise = {
      ...CUSTOM_WITH_IMAGE,
      customImageId: 'image-corrupt',
      id: 'custom:corrupt',
      name: 'Defektes Bild',
    }
    const initialState = trainingState({
      customExercises: [missingExercise, corruptExercise],
    })
    const repository: TrainingRepository = {
      deleteImage: vi.fn(async () => undefined),
      exportRaw: vi.fn(async () => 'null'),
      load: vi.fn(async () => initialState),
      loadImage: vi.fn(async (_profileId, imageId) =>
        imageId === 'image-corrupt' ? corruptBlob : undefined,
      ),
      reset: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
      saveImage: vi.fn(async () => undefined),
    }
    render(
      <ToastProvider>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <ExercisePickerDialog onClose={vi.fn()} onSelect={vi.fn()} open />
        </TrainingProvider>
      </ToastProvider>,
    )

    const picker = await screen.findByRole('dialog', { name: 'Übung auswählen' })
    const missingCard = await within(picker).findByRole('article', {
      name: 'Fehlendes Bild',
    })
    expect(
      within(missingCard).getByRole('img', { name: 'Keine Abbildung verfügbar' }),
    ).toBeInTheDocument()
    const corruptCard = within(picker).getByRole('article', {
      name: 'Defektes Bild',
    })
    const corruptImage = await within(corruptCard).findByRole('img', {
      name: 'Abbildung: Defektes Bild',
    })
    fireEvent.error(corruptImage)
    expect(
      within(corruptCard).getByRole('img', { name: 'Keine Abbildung verfügbar' }),
    ).toBeInTheDocument()
    expect(repository.loadImage).toHaveBeenCalledWith(
      'profile-a',
      'image-missing',
    )
    expect(repository.loadImage).toHaveBeenCalledWith(
      'profile-a',
      'image-corrupt',
    )
  })
})
