import { act, render, renderHook } from '@testing-library/react'
import { useLayoutEffect, useRef } from 'react'
import { describe, expect, it } from 'vitest'
import {
  calendarEventsStorageKey,
  type CalendarEvent,
  type CalendarStorage,
} from './calendarEvents'
import { useCalendarEvents } from './useCalendarEvents'

function memoryStorage() {
  const values = new Map<string, string>()
  const storage: CalendarStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
  return { storage, values }
}

function LayoutEffectMutation({
  onSnapshot,
  profileId,
  storage,
}: {
  onSnapshot: (snapshot: { events: CalendarEvent[]; warning: string | null }) => void
  profileId: string
  storage: CalendarStorage
}) {
  const { createEvent, events, warning } = useCalendarEvents({
    profileId,
    storage,
    createId: () => 'event-b',
  })
  const createdForProfile = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (profileId !== 'profile-b' || createdForProfile.current === profileId) return
    onSnapshot({ events, warning })
    createdForProfile.current = profileId
    createEvent({ title: 'Zahnarzt', date: '2026-07-21' })
  }, [createEvent, events, onSnapshot, profileId, warning])

  return null
}

describe('useCalendarEvents', () => {
  it('persists CRUD state under the active profile only', () => {
    const { storage, values } = memoryStorage()
    const { result } = renderHook(() =>
      useCalendarEvents({ profileId: 'profile-a', storage, createId: () => 'event-1' }),
    )

    act(() => result.current.createEvent({ title: 'Arzt', date: '2026-07-20' }))
    expect(result.current.events).toHaveLength(1)
    expect(values.has(calendarEventsStorageKey('profile-a'))).toBe(true)
    expect(values.has(calendarEventsStorageKey('profile-b'))).toBe(false)

    act(() =>
      result.current.updateEvent('event-1', {
        title: 'Zahnarzt',
        date: '2026-07-21',
      }),
    )
    expect(result.current.events[0].title).toBe('Zahnarzt')

    act(() => result.current.deleteEvent('event-1'))
    expect(result.current.events).toEqual([])
  })

  it('keeps previous React state when a write fails', () => {
    const storage: CalendarStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const { result } = renderHook(() => useCalendarEvents({ profileId: 'profile-a', storage }))

    expect(() =>
      act(() => result.current.createEvent({ title: 'Arzt', date: '2026-07-20' })),
    ).toThrow('Termine konnten nicht lokal gespeichert werden.')
    expect(result.current.events).toEqual([])
  })

  it('reloads events when the active profile changes', () => {
    const { storage, values } = memoryStorage()
    let nextId = 1
    const { result, rerender } = renderHook(
      ({ profileId }) =>
        useCalendarEvents({
          profileId,
          storage,
          createId: () => `event-${nextId++}`,
        }),
      { initialProps: { profileId: 'profile-a' } },
    )

    act(() => result.current.createEvent({ title: 'Arzt', date: '2026-07-20' }))
    rerender({ profileId: 'profile-b' })

    expect(result.current.events).toEqual([])
    act(() => result.current.createEvent({ title: 'Zahnarzt', date: '2026-07-21' }))
    expect(JSON.parse(values.get(calendarEventsStorageKey('profile-b')) ?? '[]')).toEqual([
      { id: 'event-2', title: 'Zahnarzt', date: '2026-07-21' },
    ])
  })

  it('atomically switches sources before a consumer layout effect mutates the new profile', () => {
    const { storage: storageA, values: valuesA } = memoryStorage()
    const valuesB = new Map<string, string>()
    const storageB: CalendarStorage = {
      getItem: () => {
        throw new Error('blocked read')
      },
      setItem: (key, value) => void valuesB.set(key, value),
    }
    valuesA.set(
      calendarEventsStorageKey('profile-a'),
      JSON.stringify([{ id: 'event-a', title: 'Arzt', date: '2026-07-20' }]),
    )
    const snapshots: Array<{ events: CalendarEvent[]; warning: string | null }> = []
    const onSnapshot = (snapshot: { events: CalendarEvent[]; warning: string | null }) =>
      snapshots.push(snapshot)

    const view = render(
      <LayoutEffectMutation
        onSnapshot={onSnapshot}
        profileId="profile-a"
        storage={storageA}
      />,
    )
    view.rerender(
      <LayoutEffectMutation
        onSnapshot={onSnapshot}
        profileId="profile-b"
        storage={storageB}
      />,
    )

    expect(snapshots).toEqual([
      { events: [], warning: 'Gespeicherte Termine konnten nicht gelesen werden.' },
    ])
    expect(JSON.parse(valuesB.get(calendarEventsStorageKey('profile-b')) ?? '[]')).toEqual([
      { id: 'event-b', title: 'Zahnarzt', date: '2026-07-21' },
    ])
  })

  it('uses the current source when a retained pre-switch mutator is invoked', () => {
    const { storage: storageA, values: valuesA } = memoryStorage()
    const { storage: storageB, values: valuesB } = memoryStorage()
    valuesA.set(
      calendarEventsStorageKey('profile-a'),
      JSON.stringify([{ id: 'event-a', title: 'Arzt', date: '2026-07-20' }]),
    )
    const { result, rerender } = renderHook(
      ({ createId, profileId, storage }) => useCalendarEvents({ createId, profileId, storage }),
      {
        initialProps: {
          createId: () => 'event-a-new',
          profileId: 'profile-a',
          storage: storageA,
        },
      },
    )
    const createForA = result.current.createEvent

    rerender({
      createId: () => 'event-b-new',
      profileId: 'profile-b',
      storage: storageB,
    })
    act(() => createForA({ title: 'Zahnarzt', date: '2026-07-21' }))

    expect(JSON.parse(valuesA.get(calendarEventsStorageKey('profile-a')) ?? '[]')).toEqual([
      { id: 'event-a', title: 'Arzt', date: '2026-07-20' },
    ])
    expect(JSON.parse(valuesB.get(calendarEventsStorageKey('profile-b')) ?? '[]')).toEqual([
      { id: 'event-b-new', title: 'Zahnarzt', date: '2026-07-21' },
    ])
    expect(result.current.events).toEqual([
      { id: 'event-b-new', title: 'Zahnarzt', date: '2026-07-21' },
    ])
  })
})
