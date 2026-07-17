import { AccountRuleError } from './accountRules.ts'

export interface RateLimitClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export function requestClientAddress(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function enforceRateLimit(
  client: RateLimitClient,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await client.rpc('consume_function_rate_limit', {
    p_key_hash: await sha256(`${scope}:${subject}`),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw error
  if (data !== true) throw new AccountRuleError('RATE_LIMIT_EXCEEDED')
}
