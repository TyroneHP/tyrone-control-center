import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type { ExerciseDefinition, TrainingState } from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { useTraining } from '../useTraining'
import {
  ExerciseEditorDialog,
  type ExerciseEditorDialogProps,
} from './ExerciseEditorDialog'

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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
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

function LoadedEditor(props: ExerciseEditorDialogProps) {
  const { loading } = useTraining()
  return loading ? <p>Lädt …</p> : <ExerciseEditorDialog {...props} />
}

function renderEditor(
  props: Omit<ExerciseEditorDialogProps, 'open'>,
  repository: TrainingRepository,
) {
  return render(
    <ToastProvider>
      <TrainingProvider profileId="profile-a" repository={repository}>
        <LoadedEditor {...props} open />
      </TrainingProvider>
    </ToastProvider>,
  )
}

async function fillNewExercise(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await user.type(within(dialog).getByLabelText('Name'), 'Bildübung')
  await user.type(within(dialog).getByLabelText('Hauptmuskeln'), 'Brust')
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

describe('ExerciseEditorDialog image persistence', () => {
  it('keeps the dialog locked until normalization and metadata persistence finish', async () => {
    const normalization = deferred<Blob>()
    const metadataSave = deferred<void>()
    const normalizeImage = vi.fn(() => normalization.promise)
    const repository = createRepository(trainingState(), {
      save: vi.fn(() => metadataSave.promise),
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderEditor({ normalizeImage, onClose }, repository)

    const dialog = await screen.findByRole('dialog', {
      name: 'Eigene Übung erstellen',
    })
    await fillNewExercise(dialog, user)
    await user.upload(
      within(dialog).getByLabelText('Bild (optional)'),
      new File(['original'], 'exercise.png', { type: 'image/png' }),
    )

    const form = dialog.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(normalizeImage).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled()
    expect(
      within(dialog).queryByRole('button', { name: 'Dialog schließen' }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('responsive-dialog-backdrop'))
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      normalization.resolve(new Blob(['processed'], { type: 'image/webp' }))
    })
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => metadataSave.resolve())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('rolls back a newly stored image when metadata persistence fails', async () => {
    const metadataSave = deferred<void>()
    const operations: string[] = []
    const repository = createRepository(trainingState(), {
      deleteImage: vi.fn(async (_profileId, imageId) => {
        operations.push(`delete:${imageId}`)
      }),
      save: vi.fn((_profileId, state) => {
        operations.push(`metadata:${state.customExercises.length}`)
        return operations.filter((entry) => entry.startsWith('metadata:')).length === 1
          ? metadataSave.promise
          : Promise.resolve()
      }),
      saveImage: vi.fn(async (_profileId, imageId) => {
        operations.push(`image:${imageId}`)
      }),
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderEditor({ normalizeImage: async () => new Blob(['webp'], { type: 'image/webp' }), onClose }, repository)

    const dialog = await screen.findByRole('dialog', {
      name: 'Eigene Übung erstellen',
    })
    await fillNewExercise(dialog, user)
    await user.upload(
      within(dialog).getByLabelText('Bild (optional)'),
      new File(['original'], 'exercise.png', { type: 'image/png' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Übung erstellen' }))

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => metadataSave.reject(new Error('metadata unavailable')))

    await waitFor(() => expect(repository.deleteImage).toHaveBeenCalledTimes(1))
    const newImageId = vi.mocked(repository.saveImage).mock.calls[0][1]
    expect(repository.deleteImage).toHaveBeenCalledWith('profile-a', newImageId)
    expect(operations).toEqual([
      `image:${newImageId}`,
      'metadata:1',
      'metadata:0',
      `delete:${newImageId}`,
    ])
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Übung konnte nicht gespeichert werden.',
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stores a replacement under a new id and deletes the old blob only after metadata persisted', async () => {
    const operations: string[] = []
    const initialState = trainingState({ customExercises: [CUSTOM_WITH_IMAGE] })
    const repository = createRepository(initialState, {
      deleteImage: vi.fn(async (_profileId, imageId) => {
        operations.push(`delete:${imageId}`)
      }),
      save: vi.fn(async (_profileId, state) => {
        operations.push(`metadata:${state.customExercises[0]?.customImageId}`)
      }),
      saveImage: vi.fn(async (_profileId, imageId) => {
        operations.push(`image:${imageId}`)
      }),
    })
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderEditor(
      {
        exercise: CUSTOM_WITH_IMAGE,
        normalizeImage: async () => new Blob(['webp'], { type: 'image/webp' }),
        onClose,
      },
      repository,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Übung bearbeiten' })
    await user.upload(
      within(dialog).getByLabelText('Bild (optional)'),
      new File(['replacement'], 'replacement.png', { type: 'image/png' }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Änderungen speichern' }),
    )

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const replacementId = vi.mocked(repository.saveImage).mock.calls[0][1]
    expect(replacementId).not.toBe('image-old')
    expect(operations).toEqual([
      `image:${replacementId}`,
      `metadata:${replacementId}`,
      'delete:image-old',
    ])
  })

  it('removes existing image metadata first and exposes a cleanup retry without resaving metadata', async () => {
    const operations: string[] = []
    const initialState = trainingState({ customExercises: [CUSTOM_WITH_IMAGE] })
    const deleteImage = vi
      .fn<TrainingRepository['deleteImage']>()
      .mockImplementationOnce(async (_profileId, imageId) => {
        operations.push(`delete:${imageId}`)
        throw new Error('cleanup unavailable')
      })
      .mockImplementationOnce(async (_profileId, imageId) => {
        operations.push(`delete:${imageId}`)
      })
    const repository = createRepository(initialState, {
      deleteImage,
      save: vi.fn(async (_profileId, state) => {
        operations.push(`metadata:${state.customExercises[0]?.customImageId ?? 'none'}`)
      }),
    })
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderEditor({ exercise: CUSTOM_WITH_IMAGE, onClose }, repository)

    const dialog = await screen.findByRole('dialog', { name: 'Übung bearbeiten' })
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Vorhandenes Bild entfernen' }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Änderungen speichern' }),
    )

    await waitFor(() => expect(deleteImage).toHaveBeenCalledTimes(1))
    expect(operations).toEqual(['metadata:none', 'delete:image-old'])
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Trainingsbild konnte nicht gelöscht werden.',
    )
    expect(onClose).not.toHaveBeenCalled()

    await user.click(
      within(dialog).getByRole('button', { name: 'Bildlöschung erneut versuchen' }),
    )

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(repository.save).toHaveBeenCalledTimes(1)
    expect(deleteImage).toHaveBeenNthCalledWith(2, 'profile-a', 'image-old')
  })
})
