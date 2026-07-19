import { useEffect, useId, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, FormField, ResponsiveDialog } from '../../design-system'
import {
  calendarEventFormSchema,
  toCalendarEventDraft,
  type CalendarEvent,
  type CalendarEventDraft,
  type CalendarEventFormValues,
} from './calendarEvents'

export interface CalendarEventDialogProps {
  event?: CalendarEvent
  initialDate: string
  onClose: () => void
  onRequestDelete?: () => void
  onSave: (draft: CalendarEventDraft) => void
  open: boolean
}

function getDefaults(
  event: CalendarEvent | undefined,
  initialDate: string,
): CalendarEventFormValues {
  return {
    title: event?.title ?? '',
    date: event?.date ?? initialDate,
    startTime: event?.startTime ?? '',
    endTime: event?.endTime ?? '',
    description: event?.description ?? '',
  }
}

export function CalendarEventDialog({
  event,
  initialDate,
  onClose,
  onRequestDelete,
  onSave,
  open,
}: CalendarEventDialogProps) {
  const form = useForm<CalendarEventFormValues>({
    defaultValues: getDefaults(event, initialDate),
    resolver: zodResolver(calendarEventFormSchema),
  })
  const formId = `calendar-event-form-${useId()}`
  const titleRef = useRef<HTMLInputElement>(null)
  const titleError = form.formState.errors.title?.message
  const dateError = form.formState.errors.date?.message
  const startTimeError = form.formState.errors.startTime?.message
  const endTimeError = form.formState.errors.endTime?.message
  const descriptionError = form.formState.errors.description?.message
  const { ref: registerTitleRef, ...titleRegistration } = form.register('title')

  useEffect(() => {
    form.reset(getDefaults(event, initialDate))
  }, [event, form, initialDate, open])

  return (
    <ResponsiveDialog
      actions={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            Abbrechen
          </Button>
          {event && onRequestDelete ? (
            <Button onClick={onRequestDelete} type="button" variant="danger">
              Termin löschen
            </Button>
          ) : null}
          <Button form={formId} type="submit">
            Termin speichern
          </Button>
        </>
      }
      initialFocusRef={titleRef}
      onClose={onClose}
      open={open}
      title={event ? 'Termin bearbeiten' : 'Termin erstellen'}
    >
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit((values) => onSave(toCalendarEventDraft(values)))}
      >
        <FormField htmlFor="calendar-event-title" label="Titel">
          <input
            aria-describedby={titleError ? 'calendar-event-title-error' : undefined}
            aria-invalid={titleError ? true : undefined}
            id="calendar-event-title"
            ref={(element) => {
              titleRef.current = element
              registerTitleRef(element)
            }}
            type="text"
            {...titleRegistration}
          />
          {titleError ? (
            <p className="form-field__error" id="calendar-event-title-error">
              {titleError}
            </p>
          ) : null}
        </FormField>

        <FormField htmlFor="calendar-event-date" label="Datum">
          <input
            aria-describedby={dateError ? 'calendar-event-date-error' : undefined}
            aria-invalid={dateError ? true : undefined}
            id="calendar-event-date"
            type="date"
            {...form.register('date')}
          />
          {dateError ? (
            <p className="form-field__error" id="calendar-event-date-error">
              {dateError}
            </p>
          ) : null}
        </FormField>

        <FormField htmlFor="calendar-event-start-time" label="Startzeit">
          <input
            aria-describedby={startTimeError ? 'calendar-event-start-time-error' : undefined}
            aria-invalid={startTimeError ? true : undefined}
            id="calendar-event-start-time"
            type="time"
            {...form.register('startTime')}
          />
          {startTimeError ? (
            <p className="form-field__error" id="calendar-event-start-time-error">
              {startTimeError}
            </p>
          ) : null}
        </FormField>

        <FormField htmlFor="calendar-event-end-time" label="Endzeit">
          <input
            aria-describedby={endTimeError ? 'calendar-event-end-time-error' : undefined}
            aria-invalid={endTimeError ? true : undefined}
            id="calendar-event-end-time"
            type="time"
            {...form.register('endTime')}
          />
          {endTimeError ? (
            <p className="form-field__error" id="calendar-event-end-time-error">
              {endTimeError}
            </p>
          ) : null}
        </FormField>

        <FormField htmlFor="calendar-event-description" label="Beschreibung">
          <textarea
            aria-describedby={
              descriptionError ? 'calendar-event-description-error' : undefined
            }
            aria-invalid={descriptionError ? true : undefined}
            id="calendar-event-description"
            rows={4}
            {...form.register('description')}
          />
          {descriptionError ? (
            <p className="form-field__error" id="calendar-event-description-error">
              {descriptionError}
            </p>
          ) : null}
        </FormField>
      </form>
    </ResponsiveDialog>
  )
}
