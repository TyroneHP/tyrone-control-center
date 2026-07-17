import { describe, expect, it } from 'vitest'
import { detectSecrets, formatFinding } from './check-secrets.mjs'

describe('secret scanner', () => {
  it('detects actual Supabase, provider, and private-key values', () => {
    const assignedSecret =
      'SUPABASE_SERVICE_ROLE_KEY=' +
      ['eyJhbGciOiJIUzI1NiJ9', 'abcdefghijklmnopqrstuvwxyz', 'signature'].join('.')
    const fixtures = [
      assignedSecret,
      `token=${'sb_' + 'secret_' + 'a'.repeat(32)}`,
      `OPENAI_API_KEY=${'sk-' + 'b'.repeat(32)}`,
      ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
    ]

    for (const fixture of fixtures) {
      expect(detectSecrets(fixture)).not.toHaveLength(0)
    }
  })

  it('allows documentation names, workflow references, and explicit placeholders', () => {
    const documentation = [
      'Required secret: SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
      'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-placeholder-key',
      'Example only: sk-...',
      'Never commit a BEGIN PRIVATE KEY block.',
    ].join('\n')

    expect(detectSecrets(documentation)).toEqual([])
  })

  it('reports the detector and file without echoing the secret value', () => {
    const secret = 'sb_' + 'secret_' + 'c'.repeat(32)
    const finding = detectSecrets(`token=${secret}`)[0]
    const message = formatFinding('dist/assets/index.js', finding)

    expect(message).toContain('dist/assets/index.js')
    expect(message).toContain('Supabase secret key')
    expect(message).not.toContain(secret)
  })
})
