import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Bitte gib eine gültige E-Mail-Adresse ein.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Bitte gib dein Passwort ein.'),
})

export const setupSchema = z.object({ email: emailSchema })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Das Passwort muss mindestens 12 Zeichen lang sein.'),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type SetupValues = z.infer<typeof setupSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>
