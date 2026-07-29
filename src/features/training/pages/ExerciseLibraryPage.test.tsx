import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type { ExerciseDefinition, TrainingState } from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { ExerciseLibraryPage } from './ExerciseLibraryPage'

const CUSTOM_EXERCISE: ExerciseDefinition = {
  id: 'custom:row',
  source: 'custom',
  name: 'Eigenes Rudern',
  primaryMuscles: ['Latissimus'],
  secondaryMuscles: ['Bizeps'],
  equipment: ['Kurzhantel'],
  unit: 'kg-reps',
  description: 'Eine eigene Ruderübung.',
  gripOptions: ['Neutralgriff'],
  supportsBodyweightModes: false,
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

function renderLibrary(
  state = trainingState(),
  repository = createRepository(state),
) {
  return {
    repository,
    ...render(
      <ToastProvider>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <ExerciseLibraryPage />
        </TrainingProvider>
      </ToastProvider>,
    ),
  }
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) =>
      ({
        addEventListener: vi.fn(),
        matches: false,
        media: query,
        removeEventListener: vi.fn(),
      }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ExerciseLibraryPage', () => {
  it('filters the catalog by name, primary muscle, and equipment', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await screen.findByRole('heading', { name: 'Übungsbibliothek' })
    const search = screen.getByRole('searchbox', { name: 'Übungen suchen' })

    await user.type(search, 'Klimmzug')
    expect(screen.getByRole('heading', { name: 'Klimmzug' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Bankdrücken' }),
    ).not.toBeInTheDocument()

    await user.clear(search)
    await user.selectOptions(screen.getByLabelText('Hauptmuskel'), 'Brust')
    expect(screen.getByRole('heading', { name: 'Bankdrücken' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Klimmzug' }),
    ).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Hauptmuskel'), '')
    await user.selectOptions(
      screen.getByLabelText('Ausrüstung'),
      'Klimmzugstange',
    )
    expect(screen.getByRole('heading', { name: 'Klimmzug' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Bankdrücken' }),
    ).not.toBeInTheDocument()
  })

  it('shows only marked exercises when the favorites filter is selected', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await screen.findByRole('heading', { name: 'Bankdrücken' })
    await user.click(
      screen.getByRole('button', {
        name: 'Zu Favoriten hinzufügen: Bankdrücken',
      }),
    )
    await user.click(screen.getByRole('checkbox', { name: 'Nur Favoriten' }))

    expect(screen.getByRole('heading', { name: 'Bankdrücken' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Klimmzug' }),
    ).not.toBeInTheDocument()
  })

  it('opens an accessible exercise detail dialog with the exercise information', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await screen.findByRole('heading', { name: 'Bankdrücken' })
    await user.click(
      screen.getByRole('button', { name: 'Details zu Bankdrücken' }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Bankdrücken' })
    expect(within(dialog).getByText('Hauptmuskeln')).toBeInTheDocument()
    expect(within(dialog).getByText('Brust')).toBeInTheDocument()
    expect(within(dialog).getByText('Nebenmuskeln')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Langhantel kontrolliert zur Brust senken und über der Schulterlinie auspressen.',
      ),
    ).toBeInTheDocument()
  })

  it('validates required custom-exercise fields and saves a custom-prefixed id', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000006',
    )
    renderLibrary(trainingState(), repository)

    await screen.findByRole('heading', { name: 'Übungsbibliothek' })
    await user.click(
      screen.getByRole('button', { name: 'Eigene Übung erstellen' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Eigene Übung erstellen',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Übung erstellen' }))
    expect(within(dialog).getByText('Name ist erforderlich.')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Mindestens ein Hauptmuskel ist erforderlich.'),
    ).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Name'), 'Kabelzug Spezial')
    await user.type(
      within(dialog).getByLabelText('Hauptmuskeln'),
      'Latissimus',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Übung erstellen' }))

    expect(
      await screen.findByRole('heading', { name: 'Kabelzug Spezial' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(
        'profile-a',
        expect.objectContaining({
          customExercises: [
            expect.objectContaining({
              id: 'custom:00000000-0000-4000-8000-000000000006',
            }),
          ],
        }),
      ),
    )
  })

  it('uses a fallback illustration when a custom image is unavailable', async () => {
    const customWithImage: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      customImageId: 'custom:row-image',
    }
    const repository = createRepository(
      trainingState({ customExercises: [customWithImage] }),
    )
    renderLibrary(trainingState({ customExercises: [customWithImage] }), repository)

    const card = await screen.findByRole('article', { name: 'Eigenes Rudern' })
    expect(
      within(card).getByRole('img', { name: 'Keine Abbildung verfügbar' }),
    ).toBeInTheDocument()
  })

  it('edits and deletes a custom exercise only after confirmation', async () => {
    const user = userEvent.setup()
    const initialState = trainingState({ customExercises: [CUSTOM_EXERCISE] })
    const repository = createRepository(initialState)
    renderLibrary(initialState, repository)

    await screen.findByRole('heading', { name: 'Eigenes Rudern' })
    await user.click(
      screen.getByRole('button', { name: 'Details zu Eigenes Rudern' }),
    )
    const details = await screen.findByRole('dialog', { name: 'Eigenes Rudern' })
    await user.click(within(details).getByRole('button', { name: 'Bearbeiten' }))

    const editor = await screen.findByRole('dialog', {
      name: 'Übung bearbeiten',
    })
    const name = within(editor).getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Eigenes Rudern aktualisiert')
    await user.click(
      within(editor).getByRole('button', { name: 'Änderungen speichern' }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Eigenes Rudern aktualisiert',
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Details zu Eigenes Rudern aktualisiert',
      }),
    )
    const updatedDetails = await screen.findByRole('dialog', {
      name: 'Eigenes Rudern aktualisiert',
    })
    await user.click(within(updatedDetails).getByRole('button', { name: 'Löschen' }))
    const confirmation = await screen.findByRole('dialog', {
      name: 'Übung löschen',
    })
    expect(
      within(confirmation).getByText(
        'Möchtest du „Eigenes Rudern aktualisiert“ wirklich löschen?',
      ),
    ).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Löschen' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Eigenes Rudern aktualisiert' }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(repository.save).toHaveBeenLastCalledWith(
        'profile-a',
        expect.objectContaining({ customExercises: [] }),
      ),
    )
  })

  it('keeps a failed image-cleanup deletion visible and retries the captured blob only', async () => {
    const customWithImage: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      customImageId: 'image-row',
    }
    const initialState = trainingState({
      customExercises: [customWithImage],
      favoriteExerciseIds: [customWithImage.id],
    })
    const deleteImage = vi
      .fn<TrainingRepository['deleteImage']>()
      .mockRejectedValueOnce(new Error('cleanup unavailable'))
      .mockResolvedValueOnce(undefined)
    const repository = createRepository(initialState, { deleteImage })
    const user = userEvent.setup()
    renderLibrary(initialState, repository)

    await screen.findByRole('heading', { name: 'Eigenes Rudern' })
    await user.click(
      screen.getByRole('button', { name: 'Details zu Eigenes Rudern' }),
    )
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Eigenes Rudern' }))
        .getByRole('button', { name: 'Löschen' }),
    )
    const confirmation = await screen.findByRole('dialog', {
      name: 'Übung löschen',
    })
    await user.click(within(confirmation).getByRole('button', { name: 'Löschen' }))

    await waitFor(() => expect(deleteImage).toHaveBeenCalledTimes(1))
    expect(confirmation).toBeInTheDocument()
    expect(within(confirmation).getByRole('alert')).toHaveTextContent(
      'Trainingsbild konnte nicht gelöscht werden.',
    )
    expect(
      screen.queryByRole('heading', { name: 'Eigenes Rudern' }),
    ).not.toBeInTheDocument()

    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Löschen erneut versuchen',
      }),
    )

    await waitFor(() => expect(confirmation).not.toBeInTheDocument())
    expect(repository.save).toHaveBeenCalledTimes(1)
    expect(deleteImage).toHaveBeenNthCalledWith(1, 'profile-a', 'image-row')
    expect(deleteImage).toHaveBeenNthCalledWith(2, 'profile-a', 'image-row')
  })

  it('restores metadata after a failed delete save and retries the whole deletion', async () => {
    const customWithImage: ExerciseDefinition = {
      ...CUSTOM_EXERCISE,
      customImageId: 'image-row',
    }
    const initialState = trainingState({
      customExercises: [customWithImage],
      favoriteExerciseIds: [customWithImage.id],
    })
    const save = vi
      .fn<TrainingRepository['save']>()
      .mockRejectedValueOnce(new Error('metadata unavailable'))
      .mockResolvedValue(undefined)
    const deleteImage = vi.fn(async () => undefined)
    const repository = createRepository(initialState, { deleteImage, save })
    const user = userEvent.setup()
    renderLibrary(initialState, repository)

    await screen.findByRole('heading', { name: 'Eigenes Rudern' })
    await user.click(
      screen.getByRole('button', { name: 'Details zu Eigenes Rudern' }),
    )
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Eigenes Rudern' }))
        .getByRole('button', { name: 'Löschen' }),
    )
    const confirmation = await screen.findByRole('dialog', {
      name: 'Übung löschen',
    })
    await user.click(within(confirmation).getByRole('button', { name: 'Löschen' }))

    await waitFor(() =>
      expect(within(confirmation).getByRole('alert')).toHaveTextContent(
        'Übung konnte nicht gelöscht werden.',
      ),
    )
    expect(screen.getByRole('heading', { name: 'Eigenes Rudern' })).toBeInTheDocument()
    expect(deleteImage).not.toHaveBeenCalled()

    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Löschen erneut versuchen',
      }),
    )

    await waitFor(() => expect(confirmation).not.toBeInTheDocument())
    expect(save).toHaveBeenCalledTimes(3)
    expect(deleteImage).toHaveBeenCalledWith('profile-a', 'image-row')
    expect(
      screen.queryByRole('heading', { name: 'Eigenes Rudern' }),
    ).not.toBeInTheDocument()
  })

  it('stores the processed optional image instead of the uploaded original', async () => {
    const editorModulePath = '../components/ExerciseEditorDialog'
    const { ExerciseEditorDialog } = await import(
      /* @vite-ignore */ editorModulePath
    )
    const user = userEvent.setup()
    const original = new File(['unprocessed'], 'exercise.png', {
      type: 'image/png',
    })
    const processed = new Blob(['processed'], { type: 'image/webp' })
    const normalizeImage = vi.fn(async () => processed)
    const repository = createRepository()

    render(
      <ToastProvider>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <ExerciseEditorDialog
            normalizeImage={normalizeImage}
            onClose={vi.fn()}
            open
          />
        </TrainingProvider>
      </ToastProvider>,
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Eigene Übung erstellen',
    })
    await user.type(within(dialog).getByLabelText('Name'), 'Bildübung')
    await user.type(within(dialog).getByLabelText('Hauptmuskeln'), 'Brust')
    await user.upload(within(dialog).getByLabelText('Bild (optional)'), original)
    await user.click(within(dialog).getByRole('button', { name: 'Übung erstellen' }))

    await waitFor(() =>
      expect(repository.saveImage).toHaveBeenCalledWith(
        'profile-a',
        expect.stringMatching(/^custom:/),
        processed,
      ),
    )
    expect(repository.saveImage).not.toHaveBeenCalledWith(
      'profile-a',
      expect.any(String),
      original,
    )
  })

  it('shows the add action in details when reused as an exercise picker', async () => {
    const pickerModulePath = '../components/ExercisePickerDialog'
    const { ExercisePickerDialog } = await import(
      /* @vite-ignore */ pickerModulePath
    )
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const repository = createRepository()

    render(
      <ToastProvider>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <ExercisePickerDialog onClose={vi.fn()} onSelect={onSelect} open />
        </TrainingProvider>
      </ToastProvider>,
    )

    const picker = await screen.findByRole('dialog', { name: 'Übung auswählen' })
    await user.click(
      within(picker).getByRole('button', { name: 'Details zu Bankdrücken' }),
    )
    const details = await screen.findByRole('dialog', { name: 'Bankdrücken' })
    await user.click(
      within(details).getByRole('button', { name: 'Zum Training hinzufügen' }),
    )

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bench-press' }),
    )
  })
})
