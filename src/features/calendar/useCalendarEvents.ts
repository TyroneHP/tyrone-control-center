import { useCallback, useRef, useState } from 'react'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  loadCalendarEvents,
  updateCalendarEvent,
  type CalendarEventDraft,
  type CalendarStorage,
} from './calendarEvents'

export interface UseCalendarEventsOptions {
  createId?: () => string
  profileId: string
  storage?: CalendarStorage
}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function loadSource(storage: CalendarStorage | undefined, profileId: string) {
  const loaded = storage
    ? loadCalendarEvents(storage, profileId)
    : { events: [], warning: 'Lokale Termine sind in diesem Browser nicht verf\u00fcgbar.' }
  return { ...loaded, profileId, storage }
}

export function useCalendarEvents({
  createId,
  profileId,
  storage = getBrowserStorage() ?? undefined,
}: UseCalendarEventsOptions) {
  const [source, setSource] = useState(() => loadSource(storage, profileId))
  const sourceRef = useRef({ ...source, createId })

  if (source.profileId !== profileId || source.storage !== storage) {
    const nextSource = loadSource(storage, profileId)
    sourceRef.current = { ...nextSource, createId }
    setSource(nextSource)
  } else {
    sourceRef.current = { ...sourceRef.current, createId }
  }

  const createEvent = useCallback((draft: CalendarEventDraft) => {
    const current = sourceRef.current
    if (!current.storage) throw new Error('Termine konnten nicht lokal gespeichert werden.')
    const nextEvents = createCalendarEvent(
      current.storage,
      current.profileId,
      current.events,
      draft,
      current.createId,
    )
    const nextSource = { ...current, events: nextEvents }
    sourceRef.current = nextSource
    setSource(nextSource)
    return nextEvents
  }, [])

  const updateEvent = useCallback((eventId: string, draft: CalendarEventDraft) => {
    const current = sourceRef.current
    if (!current.storage) throw new Error('Termine konnten nicht lokal gespeichert werden.')
    const nextEvents = updateCalendarEvent(
      current.storage,
      current.profileId,
      current.events,
      eventId,
      draft,
    )
    const nextSource = { ...current, events: nextEvents }
    sourceRef.current = nextSource
    setSource(nextSource)
    return nextEvents
  }, [])

  const deleteEvent = useCallback((eventId: string) => {
    const current = sourceRef.current
    if (!current.storage) throw new Error('Termine konnten nicht lokal gespeichert werden.')
    const nextEvents = deleteCalendarEvent(
      current.storage,
      current.profileId,
      current.events,
      eventId,
    )
    const nextSource = { ...current, events: nextEvents }
    sourceRef.current = nextSource
    setSource(nextSource)
    return nextEvents
  }, [])

  return {
    createEvent,
    deleteEvent,
    events: source.events,
    updateEvent,
    warning: source.warning,
  }
}
