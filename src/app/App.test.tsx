import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('shows the product heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Tyrone Control Center' }),
    ).toBeInTheDocument()
  })
})
