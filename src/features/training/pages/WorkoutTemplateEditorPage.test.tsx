import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../design-system'
import { TrainingProvider } from '../TrainingProvider'
import type { TrainingState, WorkoutTemplate } from '../model/trainingTypes'
import type { TrainingRepository } from '../persistence/trainingRepository'
import { WorkoutTemplateEditorPage } from './WorkoutTemplateEditorPage'

const MONDAY = 1
const WEDNESDAY = 3

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

function createRepository(state = trainingState()): TrainingRepository {
  return {
    deleteImage: vi.fn(async () => undefined),
    exportRaw: vi.fn(async () => 'null'),
    load: vi.fn(async () => state),
    loadImage: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    saveImage: vi.fn(async () => undefined),
  }
}

function LocationMarker() {
  const location = useLocation()
  return <output aria-label="Aktueller Pfad">{location.pathname}</output>
}

function renderEditor({
  path = '/training/templates/new',
  state = trainingState(),
}: {
  path?: string
  state?: TrainingState
} = {}) {
  const repository = createRepository(state)
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <TrainingProvider profileId="profile-a" repository={repository}>
          <Routes>
            <Route
              path="/training/templates/new"
              element={<WorkoutTemplateEditorPage />}
            />
            <Route
              path="/training/templates/:templateId/edit"
              element={<WorkoutTemplateEditorPage />}
            />
            <Route path="/training" element={<LocationMarker />} />
          </Routes>
        </TrainingProvider>
      </MemoryRouter>
    </ToastProvider>,
  )
  return repository
}

async function addExercise(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }))
  const picker = await screen.findByRole('dialog', { name: 'Übung auswählen' })
  await user.click(within(picker).getByRole('button', { name: `Details zu ${name}` }))
  const details = await screen.findByRole('dialog', { name })
  await user.click(
    within(details).getByRole('button', { name: 'Zum Training hinzufügen' }),
  )
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
  vi.setSystemTime(new Date('2026-07-27T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('WorkoutTemplateEditorPage', () => {
  it('creates a named template with multiple ISO weekdays and default exercise targets', async () => {
    const user = userEvent.setup()
    const repository = renderEditor()

    await screen.findByRole('heading', { name: 'Trainingsplan erstellen' })
    await user.type(screen.getByLabelText('Name des Trainingsplans'), 'Oberkörper')
    await user.click(screen.getByRole('checkbox', { name: 'Mo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Mi' }))
    await addExercise(user, 'Bankdrücken')

    expect(screen.getByLabelText('Zielsätze für Bankdrücken')).toHaveValue(3)
    expect(screen.getByLabelText('Minimale Wiederholungen für Bankdrücken')).toHaveValue(8)
    expect(screen.getByLabelText('Maximale Wiederholungen für Bankdrücken')).toHaveValue(12)

    await user.click(screen.getByRole('button', { name: 'Trainingsplan speichern' }))

    await waitFor(() => {
      const lastSave = vi.mocked(repository.save).mock.calls.at(-1)?.[1]
      expect(lastSave?.templates).toEqual([
        expect.objectContaining({
          name: 'Oberkörper',
          weekdays: [MONDAY, WEDNESDAY],
          exercises: [
            expect.objectContaining({
              exerciseId: 'bench-press',
              order: 0,
              targetSets: 3,
              repMin: 8,
              repMax: 12,
            }),
          ],
        }),
      ])
    })
    expect(screen.getByLabelText('Aktueller Pfad')).toHaveTextContent('/training')
  })

  it('edits target values and removes an exercise before saving', async () => {
    const user = userEvent.setup()
    const repository = renderEditor()

    await screen.findByRole('heading', { name: 'Trainingsplan erstellen' })
    await user.type(screen.getByLabelText('Name des Trainingsplans'), 'Unterkörper')
    await addExercise(user, 'Kniebeuge mit Langhantel')
    await addExercise(user, 'Beinpresse')

    await user.clear(screen.getByLabelText('Zielsätze für Kniebeuge mit Langhantel'))
    await user.type(screen.getByLabelText('Zielsätze für Kniebeuge mit Langhantel'), '4')
    await user.clear(
      screen.getByLabelText('Minimale Wiederholungen für Kniebeuge mit Langhantel'),
    )
    await user.type(
      screen.getByLabelText('Minimale Wiederholungen für Kniebeuge mit Langhantel'),
      '5',
    )
    await user.clear(
      screen.getByLabelText('Maximale Wiederholungen für Kniebeuge mit Langhantel'),
    )
    await user.type(
      screen.getByLabelText('Maximale Wiederholungen für Kniebeuge mit Langhantel'),
      '7',
    )
    await user.click(screen.getByRole('button', { name: 'Übung entfernen: Beinpresse' }))
    await user.click(screen.getByRole('button', { name: 'Trainingsplan speichern' }))

    await waitFor(() => {
      const template = vi.mocked(repository.save).mock.calls.at(-1)?.[1].templates[0]
      expect(template?.exercises).toEqual([
        expect.objectContaining({
          exerciseId: 'back-squat',
          order: 0,
          targetSets: 4,
          repMin: 5,
          repMax: 7,
        }),
      ])
    })
  })

  it('sorts exercises with always-visible buttons and normalizes every order', async () => {
    const user = userEvent.setup()
    const repository = renderEditor()

    await screen.findByRole('heading', { name: 'Trainingsplan erstellen' })
    await user.type(screen.getByLabelText('Name des Trainingsplans'), 'Sortiert')
    await addExercise(user, 'Bankdrücken')
    await addExercise(user, 'Klimmzug')

    expect(screen.getAllByRole('button', { name: 'Übung nach oben' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Übung nach unten' })).toHaveLength(2)
    await user.click(screen.getAllByRole('button', { name: 'Übung nach oben' })[1])
    await user.click(screen.getByRole('button', { name: 'Trainingsplan speichern' }))

    await waitFor(() => {
      const exercises = vi.mocked(repository.save).mock.calls.at(-1)?.[1].templates[0]
        ?.exercises
      expect(exercises?.map(({ exerciseId, order }) => [exerciseId, order])).toEqual([
        ['pull-up', 0],
        ['bench-press', 1],
      ])
    })
  })

  it('supports keyboard drag sorting and keeps orders contiguous', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function getBoundingClientRect(this: HTMLElement) {
        const top =
          this instanceof HTMLLIElement && this.textContent?.includes('Klimmzug')
            ? 100
            : 0
        return {
          bottom: top + 80,
          height: 80,
          left: 0,
          right: 320,
          toJSON: () => undefined,
          top,
          width: 320,
          x: 0,
          y: top,
        } as DOMRect
      },
    )
    const user = userEvent.setup()
    const repository = renderEditor()

    await screen.findByRole('heading', { name: 'Trainingsplan erstellen' })
    await user.type(screen.getByLabelText('Name des Trainingsplans'), 'Tastatur')
    await addExercise(user, 'Bankdrücken')
    await addExercise(user, 'Klimmzug')

    const handles = screen.getAllByRole('button', { name: /Übung verschieben:/ })
    handles[0].focus()
    await user.keyboard('[Space]')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('[Space]')
    await user.click(screen.getByRole('button', { name: 'Trainingsplan speichern' }))

    await waitFor(() => {
      const exercises = vi.mocked(repository.save).mock.calls.at(-1)?.[1].templates[0]
        ?.exercises
      expect(exercises?.map(({ exerciseId, order }) => [exerciseId, order])).toEqual([
        ['pull-up', 0],
        ['bench-press', 1],
      ])
    })
  })

  it('loads an existing template and saves edits without replacing its identity', async () => {
    const user = userEvent.setup()
    const template: WorkoutTemplate = {
      id: 'template-upper',
      name: 'Oberkörper',
      weekdays: [1],
      exercises: [],
      createdAt: '2026-07-20T08:00:00.000Z',
      updatedAt: '2026-07-20T08:00:00.000Z',
    }
    const repository = renderEditor({
      path: '/training/templates/template-upper/edit',
      state: trainingState({ templates: [template] }),
    })

    await screen.findByRole('heading', { name: 'Trainingsplan bearbeiten' })
    const name = screen.getByLabelText('Name des Trainingsplans')
    expect(name).toHaveValue('Oberkörper')
    await user.clear(name)
    await user.type(name, 'Oberkörper neu')
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }))

    await waitFor(() => {
      const saved = vi.mocked(repository.save).mock.calls.at(-1)?.[1].templates[0]
      expect(saved).toMatchObject({
        id: 'template-upper',
        createdAt: '2026-07-20T08:00:00.000Z',
        name: 'Oberkörper neu',
      })
    })

  })

  it('deletes an existing template only after confirmation', async () => {
    const user = userEvent.setup()
    const template: WorkoutTemplate = {
      id: 'template-upper',
      name: 'Oberkörper',
      weekdays: [1],
      exercises: [],
      createdAt: '2026-07-20T08:00:00.000Z',
      updatedAt: '2026-07-20T08:00:00.000Z',
    }
    const repository = renderEditor({
      path: '/training/templates/template-upper/edit',
      state: trainingState({ templates: [template] }),
    })

    await screen.findByRole('heading', { name: 'Trainingsplan bearbeiten' })
    await user.click(screen.getByRole('button', { name: 'Trainingsplan löschen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Trainingsplan löschen' })
    expect(within(dialog).getByText(/wirklich löschen/)).toBeInTheDocument()
    expect(vi.mocked(repository.save)).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(() => {
      const lastSave = vi.mocked(repository.save).mock.calls.at(-1)?.[1]
      expect(lastSave?.templates).toEqual([])
    })
  })
})
