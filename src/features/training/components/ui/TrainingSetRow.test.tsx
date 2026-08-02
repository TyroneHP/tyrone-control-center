import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TrainingSetRow, type TrainingSetValue } from './TrainingSetRow'

const demoSet = {
  completed: false,
  reps: 8,
  weight: 60,
}

function ControlledSetRow({
  onChange,
}: {
  onChange: (changes: Partial<TrainingSetValue>) => void
}) {
  const [value, setValue] = useState<TrainingSetValue>(demoSet)

  return (
    <TrainingSetRow
      setNumber={1}
      value={value}
      onChange={(changes) => {
        onChange(changes)
        setValue((current) => ({ ...current, ...changes }))
      }}
    />
  )
}

describe('TrainingSetRow', () => {
  it('labels numeric fields, reports decimal changes, and exposes completed state without color alone', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledSetRow onChange={onChange} />)

    expect(screen.getByLabelText('Satz 1 Gewicht')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Satz 1 abgeschlossen')).toHaveAttribute('aria-pressed', 'false')

    await user.clear(screen.getByLabelText('Satz 1 Gewicht'))
    await user.type(screen.getByLabelText('Satz 1 Gewicht'), '62.5')
    expect(onChange).toHaveBeenLastCalledWith({ weight: 62.5 })

    await user.click(screen.getByLabelText('Satz 1 abgeschlossen'))
    expect(onChange).toHaveBeenLastCalledWith({ completed: true })
  })
})
