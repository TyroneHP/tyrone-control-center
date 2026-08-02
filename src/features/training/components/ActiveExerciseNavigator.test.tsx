import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActiveExerciseNavigator } from './ActiveExerciseNavigator'

describe('ActiveExerciseNavigator', () => {
  it('offers buttons and keyboard controls as a non-touch fallback', async () => {
    const onIndexChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ActiveExerciseNavigator currentIndex={1} exerciseCount={3} onIndexChange={onIndexChange}>
        <p>Übungsinhalt</p>
      </ActiveExerciseNavigator>,
    )

    await user.click(screen.getByRole('button', { name: 'Vorherige Übung' }))
    fireEvent.keyDown(screen.getByTestId('active-exercise-content'), { key: 'ArrowRight' })

    expect(onIndexChange).toHaveBeenNthCalledWith(1, 0)
    expect(onIndexChange).toHaveBeenNthCalledWith(2, 2)
  })

  it('requires a horizontal swipe of at least 72 pixels', () => {
    const onIndexChange = vi.fn()
    render(
      <ActiveExerciseNavigator currentIndex={1} exerciseCount={3} onIndexChange={onIndexChange}>
        <p>Übungsinhalt</p>
      </ActiveExerciseNavigator>,
    )
    const content = screen.getByTestId('active-exercise-content')

    fireEvent.pointerDown(content, { pointerId: 1, clientX: 280, clientY: 100 })
    fireEvent.pointerUp(content, { pointerId: 1, clientX: 209, clientY: 100 })
    fireEvent.pointerDown(content, { pointerId: 2, clientX: 280, clientY: 100 })
    fireEvent.pointerUp(content, { pointerId: 2, clientX: 208, clientY: 100 })

    expect(onIndexChange).toHaveBeenCalledTimes(1)
    expect(onIndexChange).toHaveBeenCalledWith(2)
  })
})
