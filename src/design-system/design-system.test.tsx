import { render, screen } from '@testing-library/react'
import {
  Button,
  Card,
  FormField,
  InlineAlert,
  LoadingIndicator,
} from './index'

describe('design system', () => {
  it('provides accessible controls and feedback primitives', () => {
    render(
      <Card>
        <FormField
          label="E-Mail-Adresse"
          htmlFor="email"
          error="Bitte gib eine gültige E-Mail-Adresse ein."
        >
          <input id="email" />
        </FormField>
        <Button type="submit">Speichern</Button>
        <InlineAlert variant="error">Speichern fehlgeschlagen.</InlineAlert>
        <LoadingIndicator label="Daten werden geladen …" />
      </Card>,
    )

    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Speichern fehlgeschlagen.',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Daten werden geladen …',
    )
  })
})
