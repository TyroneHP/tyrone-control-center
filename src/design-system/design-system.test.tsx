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

function themeToken(tokens: string, theme: 'dark' | 'light', token: string) {
  const themeContract = tokens.match(
    theme === 'dark'
      ? /:root,\s*\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/
      : /\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/,
  )?.[1]
  const value = themeContract?.match(
    new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'),
  )?.[1]

  if (!value) throw new Error(`Missing ${token} in the ${theme} theme contract`)
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
    const accentText = themeToken(tokens, 'dark', '--color-accent-text')

    expect(
      contrastRatio(accentText, themeToken(tokens, 'dark', '--color-bg')),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(
        accentText,
        themeToken(tokens, 'dark', '--color-bg-elevated'),
      ),
    ).toBeGreaterThanOrEqual(4.5)
    expect(authStyles).toMatch(
      /\.auth-card__links a,\s*\.auth-card__footer a\s*\{\s*color: var\(--color-accent-text\);\s*\}/,
    )
  })

  it('maps readable on-primary content to blue controls and brand marks', () => {
    const tokens = readFileSync(
      resolve(process.cwd(), 'src/design-system/tokens.css'),
      'utf8',
    )
    const designSystemStyles = readFileSync(
      resolve(process.cwd(), 'src/design-system/styles.css'),
      'utf8',
    )
    const settingsStyles = readFileSync(
      resolve(process.cwd(), 'src/features/settings/settings.css'),
      'utf8',
    )
    const reloadPromptStyles = readFileSync(
      resolve(process.cwd(), 'src/pwa/reloadPrompt.css'),
      'utf8',
    )
    const authStyles = readFileSync(
      resolve(process.cwd(), 'src/features/auth/auth.css'),
      'utf8',
    )
    const shellStyles = readFileSync(
      resolve(process.cwd(), 'src/features/shell/AppShell.css'),
      'utf8',
    )

    for (const theme of ['dark', 'light'] as const) {
      const onPrimary = themeToken(tokens, theme, '--color-on-primary')
      expect(
        contrastRatio(onPrimary, themeToken(tokens, theme, '--color-primary')),
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(
          onPrimary,
          themeToken(tokens, theme, '--color-primary-hover'),
        ),
      ).toBeGreaterThanOrEqual(4.5)
    }
    expect(designSystemStyles).toMatch(
      /\.button--primary\s*\{[\s\S]*?color:\s*var\(--color-on-primary\)/,
    )
    expect(settingsStyles).toMatch(
      /\.settings-invite button,[\s\S]*?\{[\s\S]*?color:\s*var\(--color-on-primary\)/,
    )
    expect(reloadPromptStyles).toMatch(
      /\.reload-prompt button\s*\{[\s\S]*?color:\s*var\(--color-on-primary\)/,
    )
    expect(authStyles).toMatch(
      /\.auth-page__mark\s*\{[\s\S]*?color:\s*var\(--color-on-primary\)/,
    )
    expect(shellStyles).toMatch(
      /\.app-shell__brand-mark\s*\{[\s\S]*?color:\s*var\(--color-on-primary\)/,
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
