import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  Button,
  Card,
  FormField,
  InlineAlert,
  LoadingIndicator,
} from './index'

function darkThemeToken(tokens: string, token: string) {
  const darkTheme = tokens.match(
    /:root,\s*\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/,
  )?.[1]
  const value = darkTheme?.match(
    new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'),
  )?.[1]

  if (!value) throw new Error(`Missing ${token} in the Dark theme contract`)
  return value
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      )
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (first, second) => second - first,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

describe('design system', () => {
  it('defines semantic contracts for both supported themes', () => {
    const tokens = readFileSync(
      resolve(process.cwd(), 'src/design-system/tokens.css'),
      'utf8',
    )

    expect(tokens).toContain("[data-theme='dark']")
    expect(tokens).toContain("[data-theme='light']")
    expect(tokens).toContain('--color-bg-accent:')
    expect(tokens).toContain('--color-glass:')
    expect(tokens).toContain('--color-overlay:')
    expect(tokens).toContain('--radius-sheet: 24px')
    expect(tokens).toContain('--motion-normal: 220ms')
  })

  it('keeps Dark accent text readable on application and card surfaces', () => {
    const tokens = readFileSync(
      resolve(process.cwd(), 'src/design-system/tokens.css'),
      'utf8',
    )
    const authStyles = readFileSync(
      resolve(process.cwd(), 'src/features/auth/auth.css'),
      'utf8',
    )
    const accentText = darkThemeToken(tokens, '--color-accent-text')

    expect(contrastRatio(accentText, darkThemeToken(tokens, '--color-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(accentText, darkThemeToken(tokens, '--color-bg-elevated')),
    ).toBeGreaterThanOrEqual(4.5)
    expect(authStyles).toMatch(
      /\.auth-card__links a,\s*\.auth-card__footer a\s*\{\s*color: var\(--color-accent-text\);\s*\}/,
    )
  })

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
