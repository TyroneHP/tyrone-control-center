import { useEffect, useRef, useState } from 'react'
import { Button, ResponsiveDialog, useToast } from '../../design-system'
import { useAuth } from '../auth/authContextValue'
import { CalendarEventDialog } from './CalendarEventDialog'
import { MonthCalendar } from './MonthCalendar'
import { SelectedDayEvents } from './SelectedDayEvents'
import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarStorage,
} from './calendarEvents'
import { shiftMonth } from './calendarModel'
import { useCalendarEvents } from './useCalendarEvents'
import './calendar.css'

export interface CalendarPageProps {
  createId?: () => string
  storage?: CalendarStorage
  today?: Date
}

interface AuthenticatedCalendarPageProps extends CalendarPageProps {
  profileId: string
}

function toLocalIsoDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthFromIsoDate(date: string) {
  const [year, month] = date.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Der Termin konnte nicht gespeichert werden.'
}

function AuthenticatedCalendarPage({
  createId,
  profileId,
  storage,
  today = new Date(),
}: AuthenticatedCalendarPageProps) {
  const toast = useToast()
  const { createEvent, deleteEvent, events, updateEvent, warning } =
    useCalendarEvents({ createId, profileId, storage })
  const initialDate = toLocalIsoDate(today)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>()
  const [deleteCandidate, setDeleteCandidate] = useState<CalendarEvent | undefined>()
  const shownWarningsRef = useRef(new Set<string>())
  const pageHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!warning || shownWarningsRef.current.has(warning)) return
    shownWarningsRef.current.add(warning)
    toast.show({ message: warning, variant: 'warning' })
  }, [toast, warning])

  const selectedEvents = events.filter((event) => event.date === selectedDate)

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingEvent(undefined)
  }

  const openCreate = () => {
    setEditingEvent(undefined)
    setEditorOpen(true)
  }

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event)
    setEditorOpen(true)
  }

  const showMutationError = (error: unknown) => {
    toast.show({ message: errorMessage(error), variant: 'error' })
  }

  const saveEvent = (draft: CalendarEventDraft) => {
    try {
      if (editingEvent) {
        updateEvent(editingEvent.id, draft)
        toast.show({ message: 'Termin wurde gespeichert.', variant: 'success' })
      } else {
        createEvent(draft)
        toast.show({ message: 'Termin wurde erstellt.', variant: 'success' })
      }
      setSelectedDate(draft.date)
      setVisibleMonth(monthFromIsoDate(draft.date))
      closeEditor()
    } catch (error) {
      showMutationError(error)
    }
  }

  const confirmDelete = () => {
    if (!deleteCandidate) return
    try {
      deleteEvent(deleteCandidate.id)
      setDeleteCandidate(undefined)
      closeEditor()
      toast.show({ message: 'Termin wurde gelöscht.', variant: 'success' })
    } catch (error) {
      showMutationError(error)
    }
  }

  const navigateMonth = (offset: number) => {
    const nextMonth = shiftMonth(visibleMonth, offset)
    setVisibleMonth(nextMonth)
    setSelectedDate(toLocalIsoDate(nextMonth))
  }

  return (
    <section className="calendar-page">
      <header className="calendar-page__header">
        <div className="calendar-page__heading-row">
          <div>
            <p>Planung</p>
            <h1 ref={pageHeadingRef} tabIndex={-1}>
              Kalender
            </h1>
            <p>Deine Monatsübersicht.</p>
          </div>
          <Button className="calendar-page__create" onClick={openCreate} type="button">
            Termin erstellen
          </Button>
        </div>
      </header>

      <MonthCalendar
        events={events}
        month={visibleMonth}
        onNextMonth={() => navigateMonth(1)}
        onPreviousMonth={() => navigateMonth(-1)}
        onSelectDate={setSelectedDate}
        selectedDate={selectedDate}
        today={today}
      />

      <div className="calendar-selected-day">
        <SelectedDayEvents
          date={selectedDate}
          events={selectedEvents}
          onEdit={openEdit}
        />
      </div>

      <CalendarEventDialog
        event={editingEvent}
        initialDate={selectedDate}
        onClose={closeEditor}
        onRequestDelete={
          editingEvent ? () => setDeleteCandidate(editingEvent) : undefined
        }
        onSave={saveEvent}
        open={editorOpen}
      />

      <ResponsiveDialog
        actions={
          <>
            <Button
              onClick={() => setDeleteCandidate(undefined)}
              type="button"
              variant="secondary"
            >
              Abbrechen
            </Button>
            <Button onClick={confirmDelete} type="button" variant="danger">
              Termin endgültig löschen
            </Button>
          </>
        }
        onClose={() => setDeleteCandidate(undefined)}
        open={Boolean(deleteCandidate)}
        restoreFocusFallbackRef={pageHeadingRef}
        title="Termin löschen"
      >
        <p>
          {deleteCandidate
            ? `Möchtest du den Termin „${deleteCandidate.title}“ wirklich löschen?`
            : ''}
        </p>
      </ResponsiveDialog>
    </section>
  )
}

export function CalendarPage(props: CalendarPageProps) {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <AuthenticatedCalendarPage
      {...props}
      key={profile.id}
      profileId={profile.id}
    />
  )
}
