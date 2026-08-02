import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TrainingDemoLayout } from './TrainingDemoLayout'

function Location() {
  return <output aria-label="Pfad">{useLocation().pathname}</output>
}

function renderLayout() {
  render(
    <MemoryRouter initialEntries={['/training']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <TrainingDemoLayout />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TrainingDemoLayout', () => {
  it('shows only Dashboard, Pläne and Bibliothek internally', () => {
    renderLayout()

    expect(screen.getByRole('navigation', { name: 'Training' })).toHaveTextContent(
      'DashboardPläneBibliothek',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/training',
    )
    expect(screen.getByRole('link', { name: 'Pläne' })).toHaveAttribute(
      'href',
      '/training/plans/new',
    )
    expect(screen.getByRole('link', { name: 'Bibliothek' })).toHaveAttribute(
      'href',
      '/training/library',
    )
  })

  it('navigates internally without reloading the document', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('link', { name: 'Bibliothek' }))

    expect(screen.getByLabelText('Pfad')).toHaveTextContent('/training/library')
  })
})
