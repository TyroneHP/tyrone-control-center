import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingDemoProvider } from '../demo/TrainingDemoProvider'
import { TrainingExerciseLibraryPage } from './TrainingExerciseLibraryPage'

function renderLibrary() {
  render(
    <MemoryRouter>
      <TrainingDemoProvider>
        <TrainingExerciseLibraryPage />
      </TrainingDemoProvider>
    </MemoryRouter>,
  )
}

describe('TrainingExerciseLibraryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }))
  })
  it('searches all 50 exercises without a cap', async () => {
    renderLibrary()
    expect(screen.getAllByRole('button', { name: /Übung öffnen:/ })).toHaveLength(50)
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Übungen suchen' }), 'Klimmzug')
    expect(screen.getAllByRole('button', { name: /Übung öffnen:/ })).toHaveLength(1)
  })

  it('updates a favorite without changing the unfiltered catalog', async () => {
    renderLibrary()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bankdrücken aus Favoriten entfernen' }))
    expect(screen.getByRole('button', { name: 'Bankdrücken zu Favoriten hinzufügen' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Übung öffnen:/ })).toHaveLength(50)
  })
})
