import { z } from 'zod'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const storagePrefix = 'coregrid:calendar-events:v1:'

function isRealIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export const calendarEventFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Bitte gib einen Titel ein.'),
    date: z.string().refine(isRealIsoDate, 'Bitte wähle ein gültiges Datum.'),
    startTime: z.union([z.literal(''), z.string().regex(timePattern)]),
    endTime: z.union([z.literal(''), z.string().regex(timePattern)]),
    description: z.string(),
  })
  .superRefine(({ endTime, startTime }, context) => {
    if (endTime && !startTime) {
      context.addIssue({
        code: 'custom',
        message: 'Bitte gib zuerst eine Startzeit ein.',
        path: ['endTime'],
      })
    } else if (endTime && startTime && endTime < startTime) {
      context.addIssue({
        code: 'custom',
        message: 'Die Endzeit darf nicht vor der Startzeit liegen.',
        path: ['endTime'],
      })
    }
  })

export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>

export interface CalendarEventDraft {
  date: string
  description?: string
  endTime?: string
  startTime?: string
  title: string
}

export interface CalendarEvent extends CalendarEventDraft {
  id: string
}

const storedCalendarEventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1),
    date: z.string().refine(isRealIsoDate),
    startTime: z.string().regex(timePattern).optional(),
    endTime: z.string().regex(timePattern).optional(),
    description: z.string().optional(),
  })
  .strict()
  .refine((event) => !event.endTime || Boolean(event.startTime))
  .refine((event) => !event.endTime || event.endTime >= (event.startTime ?? ''))

export interface CalendarStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface LoadCalendarEventsResult {
  events: CalendarEvent[]
  warning: string | null
}

export function calendarEventsStorageKey(profileId: string) {
  return `${storagePrefix}${profileId}`
}

export function toCalendarEventDraft(values: CalendarEventFormValues): CalendarEventDraft {
  const title = values.title.trim()
  const description = values.description.trim()
  return {
    title,
    date: values.date,
    ...(values.startTime ? { startTime: values.startTime } : {}),
    ...(values.endTime ? { endTime: values.endTime } : {}),
    ...(description ? { description } : {}),
  }
}

export function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.startTime ?? '').localeCompare(right.startTime ?? '') ||
      left.title.localeCompare(right.title, 'de-DE'),
  )
}

export function loadCalendarEvents(
  storage: CalendarStorage,
  profileId: string,
): LoadCalendarEventsResult {
  try {
    const raw = storage.getItem(calendarEventsStorageKey(profileId))
    if (!raw) return { events: [], warning: null }
    const parsed = z.array(storedCalendarEventSchema).safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error('invalid calendar events')
    return { events: sortCalendarEvents(parsed.data), warning: null }
  } catch {
    return {
      events: [],
      warning: 'Gespeicherte Termine konnten nicht gelesen werden.',
    }
  }
}

function persist(
  storage: CalendarStorage,
  profileId: string,
  events: CalendarEvent[],
) {
  const sorted = sortCalendarEvents(events)
  try {
    storage.setItem(calendarEventsStorageKey(profileId), JSON.stringify(sorted))
  } catch {
    throw new Error('Termine konnten nicht lokal gespeichert werden.')
  }
  return sorted
}

export function createCalendarEvent(
  storage: CalendarStorage,
  profileId: string,
  current: CalendarEvent[],
  draft: CalendarEventDraft,
  createId: () => string = () => crypto.randomUUID(),
) {
  return persist(storage, profileId, [...current, { id: createId(), ...draft }])
}

export function updateCalendarEvent(
  storage: CalendarStorage,
  profileId: string,
  current: CalendarEvent[],
  eventId: string,
  draft: CalendarEventDraft,
) {
  if (!current.some(({ id }) => id === eventId)) throw new Error('Termin nicht gefunden.')
  return persist(
    storage,
    profileId,
    current.map((event) => (event.id === eventId ? { id: eventId, ...draft } : event)),
  )
}

export function deleteCalendarEvent(
  storage: CalendarStorage,
  profileId: string,
  current: CalendarEvent[],
  eventId: string,
) {
  if (!current.some(({ id }) => id === eventId)) throw new Error('Termin nicht gefunden.')
  return persist(storage, profileId, current.filter(({ id }) => id !== eventId))
}
