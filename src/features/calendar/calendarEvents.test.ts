import { describe, expect, it, vi } from 'vitest'
import {
  calendarEventFormSchema,
  calendarEventsStorageKey,
  createCalendarEvent,
  deleteCalendarEvent,
  loadCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarStorage,
} from './calendarEvents'

function memoryStorage(initial: Record<string, string> = {}): CalendarStorage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
}

const breakfast: CalendarEvent = {
  id: 'event-1',
  title: 'Frühstück',
  date: '2026-07-20',
  startTime: '08:00',
}

describe('calendar event repository', () => {
  it('isolates valid events by profile and sorts untimed events first', () => {
    const storage = memoryStorage({
      [calendarEventsStorageKey('profile-a')]: JSON.stringify([
        breakfast,
        { id: 'event-2', title: 'Arzt', date: '2026-07-20' },
      ]),
    })

    expect(loadCalendarEvents(storage, 'profile-a')).toEqual({
      events: [
        { id: 'event-2', title: 'Arzt', date: '2026-07-20' },
        breakfast,
      ],
      warning: null,
    })
    expect(loadCalendarEvents(storage, 'profile-b').events).toEqual([])
  })

  it('creates, updates, and deletes persisted events', () => {
    const setItem = vi.fn()
    const storage: CalendarStorage = { getItem: () => null, setItem }
    const created = createCalendarEvent(
      storage,
      'profile-a',
      [],
      { title: 'Training', date: '2026-07-21' },
      () => 'event-3',
    )
    expect(created).toEqual([
      { id: 'event-3', title: 'Training', date: '2026-07-21' },
    ])
    const updated = updateCalendarEvent(storage, 'profile-a', created, 'event-3', {
      title: 'Lauftraining',
      date: '2026-07-22',
      description: 'Locker',
    })
    expect(updated[0]).toMatchObject({ title: 'Lauftraining', date: '2026-07-22' })
    expect(deleteCalendarEvent(storage, 'profile-a', updated, 'event-3')).toEqual([])
    expect(setItem).toHaveBeenCalledTimes(3)
  })

  it('returns a warning for corrupt data and preserves state on failed writes', () => {
    const storage: CalendarStorage = {
      getItem: () => '{broken',
      setItem: () => {
        throw new DOMException('blocked', 'QuotaExceededError')
      },
    }
    expect(loadCalendarEvents(storage, 'profile-a')).toEqual({
      events: [],
      warning: 'Gespeicherte Termine konnten nicht gelesen werden.',
    })
    expect(() =>
      createCalendarEvent(storage, 'profile-a', [breakfast], {
        title: 'Arzt',
        date: '2026-07-21',
      }),
    ).toThrow('Termine konnten nicht lokal gespeichert werden.')
  })
})

describe('calendar event form schema', () => {
  it('requires title and date and validates dependent times', () => {
    expect(
      calendarEventFormSchema.safeParse({
        title: ' ',
        date: '2026-02-30',
        startTime: '',
        endTime: '09:00',
        description: '',
      }).success,
    ).toBe(false)
    expect(
      calendarEventFormSchema.safeParse({
        title: 'Arzt',
        date: '2026-07-20',
        startTime: '10:00',
        endTime: '09:00',
        description: '',
      }).success,
    ).toBe(false)
  })
})
