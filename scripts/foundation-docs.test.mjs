import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Foundation documentation', () => {
  it('documents local requirements, verification, and the milestone boundary', () => {
    const readme = read('README.md')

    for (const requiredText of [
      'Node.js 22.12.0',
      'npm ci',
      'npm run check',
      'npm run test:e2e',
      'maximal zehn',
      'bis zu neun weitere',
      'Keine öffentliche Registrierung',
      'docs/setup-supabase.md',
    ]) {
      expect(readme).toContain(requiredText)
    }
  })

  it('contains no obsolete four-account capacity guidance', () => {
    const currentDocs = [
      read('README.md'),
      read('docs/setup-supabase.md'),
      read('docs/superpowers/specs/2026-07-16-tyrone-control-center-design.md'),
      read('docs/superpowers/plans/2026-07-16-foundation-implementation.md'),
    ].join('\n')

    for (const obsoleteText of [
      'maximal vier',
      'vier Konten',
      'up to four invited users',
      'Maximum of four active accounts',
      'four-account',
      'four-user rule',
      'four active user profiles',
      'More than four active accounts',
      'Maximum accounts: four',
      'fifth reservation',
      'fifth account reservation',
      'fifth slot',
    ]) {
      expect(currentDocs).not.toContain(obsoleteText)
    }
  })

  it('documents device-local design-system personalization', () => {
    const readme = read('README.md')

    for (const requiredText of [
      'Dunkelmodus',
      'Light Mode',
      'Seitenleiste',
      'Mobile Navigation',
      'Kalender, Aufgaben und Training',
      'lokal auf dem Gerät',
    ]) {
      expect(readme).toContain(requiredText)
    }
  })

  it('documents every required hosted Supabase and Pages setup step', () => {
    const setup = read('docs/setup-supabase.md')

    for (const requiredText of [
      'Public signup',
      'http://127.0.0.1:5173/update-password',
      'https://tyronehp.github.io/tyrone-control-center/update-password',
      'Produktions-SMTP',
      'supabase login',
      'supabase link',
      'supabase db push',
      'BOOTSTRAP_ADMIN_EMAIL',
      'APP_ORIGIN',
      'ALLOWED_ORIGINS',
      'CLEANUP_CRON_SECRET',
      'bootstrap-admin',
      'invite-user',
      'manage-user',
      'cleanup-deactivated-users',
      'sieben Tage',
      'abgelaufene Bootstrap-Einladung',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'GitHub Actions',
      '/setup',
    ]) {
      expect(setup).toContain(requiredText)
    }
  })

  it('documents the local Function redirect required by the auth E2E test', () => {
    const setup = read('docs/setup-supabase.md')

    expect(setup).toContain('APP_ORIGIN=http://127.0.0.1:5173/')
    expect(setup).toContain(
      'supabase functions serve --env-file supabase/functions/.env',
    )
    expect(setup).toContain('E-Mail-Provider für eingeladene Konten aktiv')
    expect(setup).toContain('npx deno@2.9.3 test supabase/functions')
  })

  it('starts Supabase before resetting a fresh local database', () => {
    const setup = read('docs/setup-supabase.md')
    const start = setup.indexOf('npx supabase start')
    const reset = setup.indexOf('npx supabase db reset')

    expect(start).toBeGreaterThan(-1)
    expect(reset).toBeGreaterThan(start)
  })

  it('documents the safe upgrade order for an existing deployment', () => {
    const setup = read('docs/setup-supabase.md')
    const upgrade = setup.indexOf(
      '### Bestehende Installation auf zehn Konten aktualisieren',
    )
    const migration = setup.indexOf('npx supabase db push', upgrade)
    const inviteFunction = setup.indexOf(
      'npx supabase functions deploy invite-user',
      upgrade,
    )
    const manageFunction = setup.indexOf(
      'npx supabase functions deploy manage-user',
      upgrade,
    )
    const pages = setup.indexOf(
      'Erst danach den Pull Request nach `main` mergen',
      upgrade,
    )

    expect(upgrade).toBeGreaterThan(-1)
    expect(migration).toBeGreaterThan(upgrade)
    expect(inviteFunction).toBeGreaterThan(migration)
    expect(manageFunction).toBeGreaterThan(inviteFunction)
    expect(pages).toBeGreaterThan(manageFunction)
    expect(setup).toContain('keine bestehenden Konten oder Einladungen')
  })
})
