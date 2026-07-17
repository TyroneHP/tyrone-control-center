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
      'maximal vier',
      'Keine öffentliche Registrierung',
      'docs/setup-supabase.md',
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
  })
})
