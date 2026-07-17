import { describe, expect, it } from 'vitest'
import {
  forgotPasswordSchema,
  loginSchema,
  setupSchema,
  updatePasswordSchema,
} from './schemas'

describe('authentication schemas', () => {
  it('validates and normalizes German login fields', () => {
    expect(loginSchema.safeParse({ email: 'keine-adresse', password: '' }).success).toBe(false)
    expect(
      loginSchema.parse({ email: ' USER@Example.COM ', password: 'geheim' }),
    ).toEqual({ email: 'user@example.com', password: 'geheim' })
  })

  it('requires valid setup and reset addresses', () => {
    expect(setupSchema.safeParse({ email: '' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'falsch' }).success).toBe(false)
    expect(setupSchema.parse({ email: 'Admin@Example.COM' })).toEqual({
      email: 'admin@example.com',
    })
  })

  it('requires a matching password with at least twelve characters', () => {
    expect(
      updatePasswordSchema.safeParse({
        password: 'zu-kurz',
        passwordConfirmation: 'zu-kurz',
      }).success,
    ).toBe(false)
    expect(
      updatePasswordSchema.safeParse({
        password: 'mindestens-12',
        passwordConfirmation: 'anderes-passwort',
      }).success,
    ).toBe(false)
    expect(
      updatePasswordSchema.parse({
        password: 'mindestens-12',
        passwordConfirmation: 'mindestens-12',
      }).password,
    ).toBe('mindestens-12')
  })
})
