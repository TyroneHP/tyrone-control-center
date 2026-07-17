export type SafeError = {
  code: string
  message: string
  status: number
}

const safeErrors: Record<string, Omit<SafeError, 'code'>> = {
  ACCOUNT_ALREADY_EXISTS: {
    message: 'Für diese E-Mail-Adresse besteht bereits ein Konto.',
    status: 409,
  },
  ACCOUNT_CAPACITY_REACHED: {
    message: 'Alle vier Kontoplätze sind bereits belegt oder reserviert.',
    status: 409,
  },
  ADMIN_REQUIRED: {
    message: 'Diese Aktion ist nur für Administratoren verfügbar.',
    status: 403,
  },
  AUTHENTICATION_REQUIRED: {
    message: 'Bitte melde dich erneut an.',
    status: 401,
  },
  BOOTSTRAP_CLOSED: {
    message: 'Das erste Administratorkonto wurde bereits eingerichtet.',
    status: 409,
  },
  BOOTSTRAP_EMAIL_MISMATCH: {
    message: 'Diese E-Mail-Adresse ist nicht für die Ersteinrichtung freigegeben.',
    status: 403,
  },
  CONFIGURATION_ERROR: {
    message: 'Die Anwendung ist noch nicht vollständig konfiguriert.',
    status: 500,
  },
  CRON_AUTHENTICATION_REQUIRED: {
    message: 'Der Bereinigungsaufruf ist nicht autorisiert.',
    status: 401,
  },
  INVALID_EMAIL: {
    message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    status: 400,
  },
  INVALID_MANAGE_REQUEST: {
    message: 'Die Kontoverwaltungsanfrage ist ungültig.',
    status: 400,
  },
  INVITATION_ALREADY_PENDING: {
    message: 'Für diese E-Mail-Adresse besteht bereits eine offene Einladung.',
    status: 409,
  },
  METHOD_NOT_ALLOWED: {
    message: 'Diese Anfragemethode wird nicht unterstützt.',
    status: 405,
  },
  LAST_ACTIVE_ADMIN: {
    message: 'Das letzte aktive Administratorkonto kann nicht deaktiviert werden.',
    status: 409,
  },
  ORIGIN_NOT_ALLOWED: {
    message: 'Diese Anfragequelle ist nicht freigegeben.',
    status: 403,
  },
  PROFILE_NOT_FOUND: {
    message: 'Das ausgewählte Konto wurde nicht gefunden.',
    status: 404,
  },
  SELF_DEACTIVATION_FORBIDDEN: {
    message: 'Du kannst dein eigenes Administratorkonto nicht deaktivieren.',
    status: 409,
  },
}

export class AccountRuleError extends Error {
  constructor(readonly code: keyof typeof safeErrors) {
    super(code)
    this.name = 'AccountRuleError'
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function parseInvitationRequest(input: unknown): { email: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AccountRuleError('INVALID_EMAIL')
  }

  const email = normalizeEmail(String((input as { email?: unknown }).email ?? ''))
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountRuleError('INVALID_EMAIL')
  }

  return { email }
}

export type ManageUserRequest =
  | { action: 'deactivate'; userId: string }
  | { action: 'restore'; userId: string }

export function parseManageUserRequest(input: unknown): ManageUserRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AccountRuleError('INVALID_MANAGE_REQUEST')
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const action = record.action
  const userId = record.userId
  const validUuid =
    typeof userId === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      userId,
    )

  if (
    keys.length !== 2 ||
    keys[0] !== 'action' ||
    keys[1] !== 'userId' ||
    (action !== 'deactivate' && action !== 'restore') ||
    !validUuid
  ) {
    throw new AccountRuleError('INVALID_MANAGE_REQUEST')
  }

  return { action, userId }
}

function parseHttpUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AccountRuleError('CONFIGURATION_ERROR')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AccountRuleError('CONFIGURATION_ERROR')
  }

  return url
}

export function parseAllowedOrigins(value: string) {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => parseHttpUrl(origin).origin)

  const uniqueOrigins = [...new Set(origins)]
  if (uniqueOrigins.length === 0) {
    throw new AccountRuleError('CONFIGURATION_ERROR')
  }

  return uniqueOrigins
}

export function resolveRequestOrigin(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
) {
  if (!requestOrigin) return null

  const origin = parseHttpUrl(requestOrigin).origin
  if (!allowedOrigins.includes(origin)) {
    throw new AccountRuleError('ORIGIN_NOT_ALLOWED')
  }

  return origin
}

export function createPasswordRedirectUrl(
  appOrigin: string,
  allowedOrigins: readonly string[],
) {
  const url = parseHttpUrl(appOrigin)
  if (!allowedOrigins.includes(url.origin)) {
    throw new AccountRuleError('CONFIGURATION_ERROR')
  }

  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath}/update-password`.replace(/\/{2,}/g, '/')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function toSafeError(error: unknown): SafeError {
  const errorCode =
    error instanceof AccountRuleError
      ? error.code
      : typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : ''
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error)
  const knownCode = Object.keys(safeErrors).find(
    (code) => code === errorCode || message.includes(code),
  )

  if (knownCode) {
    return { code: knownCode, ...safeErrors[knownCode] }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.',
    status: 500,
  }
}
