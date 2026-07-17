import { resolveRequestOrigin } from './accountRules.ts'

export function corsHeaders(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
) {
  const allowedOrigin = resolveRequestOrigin(requestOrigin, allowedOrigins)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin
  }

  return headers
}
