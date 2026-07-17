import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { navigationItems } from './navigation'

describe('AppShell', () => {
  it('uses the same German links for desktop and mobile navigation', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppShell>
          <h1>Übersicht</h1>
        </AppShell>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Mehr' }))

    const desktop = screen.getByRole('navigation', {
      name: 'Desktop-Navigation',
    })
    const mobile = screen.getByRole('navigation', {
      name: 'Mobile Navigation',
    })

    for (const item of navigationItems) {
      expect(
        within(desktop).getByRole('link', { name: item.label }),
      ).toHaveAttribute('href', item.path)
      expect(
        within(mobile).getByRole('link', { name: item.label }),
      ).toHaveAttribute('href', item.path)
    }
  })
})
