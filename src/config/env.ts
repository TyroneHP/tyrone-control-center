import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  BASE_URL: z.string().min(1).default('/'),
})

export type PublicEnv = z.infer<typeof schema>

export function parsePublicEnv(input: unknown): PublicEnv {
  return schema.parse(input)
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(import.meta.env)
}
