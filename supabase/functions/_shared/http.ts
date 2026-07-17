import { corsHeaders } from './cors.ts'

export function jsonResponse(
  body: unknown,
  status: number,
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(requestOrigin, allowedOrigins),
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function optionsResponse(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(requestOrigin, allowedOrigins),
  })
}
