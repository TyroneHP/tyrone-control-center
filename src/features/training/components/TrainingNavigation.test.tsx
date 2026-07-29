import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProgressNavigation } from './ProgressNavigation'
import { TrainingNavigation } from './TrainingNavigation'

function Location() {
  return <output aria-label="Pfad">{useLocation().pathname}</output>
}

describe('training navigation', () => {
  it('offers five primary destinations and marks only the current destination', () => {
    render(
      <MemoryRouter initialEntries={['/training/progress/records']}>
        <TrainingNavigation />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', {
      name: 'Trainingsbereiche',
    })
    expect(
      Array.from(navigation.querySelectorAll('a')).map((link) => link.textContent),
    ).toEqual(['Übersicht', 'Pläne', 'Bibliothek', 'Verlauf', 'Fortschritt'])
    expect(screen.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('offers five progress destinations and preserves browser-back navigation', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/training/progress']}>
        <ProgressNavigation />
        <Routes>
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      screen.getAllByRole('navigation')[0].querySelectorAll('a'),
    ).toHaveLength(5)
    await user.click(screen.getByRole('link', { name: 'Rekorde' }))
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      '/training/progress/records',
    )
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent('/training/progress')
  })
})
