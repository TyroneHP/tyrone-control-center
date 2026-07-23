# CoreGrid Local Calendar Events Design

**Date:** 2026-07-19

**Status:** Approved design

**Scope:** Local event CRUD and persistence for the existing CoreGrid month calendar

## Goal

Extend the protected CoreGrid calendar with locally stored events. Authenticated users can create, view, edit, and delete events in the existing month view. Events persist across reloads in the same browser and remain isolated per CoreGrid profile.

## Non-goals

This milestone does not add:

- Supabase, database, migration, or Edge Function changes
- synchronization between devices, accounts, or browser tabs
- recurring events
- reminders or notifications
- week or day views
- Graphify integration
- PWA changes

## Event model

Each event contains:

```ts
interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  description?: string
}
```

- `id` is generated with `crypto.randomUUID()` when the event is created.
- `date` uses the local calendar date format `YYYY-MM-DD`.
- Times use the browser-native `HH:mm` value from `input[type="time"]`.
- Optional text and time fields are omitted when empty.
- Events are ordered by date, then by start time, with untimed events first, and finally by title.

## Local persistence

A small calendar event repository owns serialization, validation, and writes to browser storage. The storage key is versioned and scoped to the authenticated profile:

```text
coregrid:calendar-events:v1:<profile-id>
```

The existing authenticated profile ID is the stable owner identifier. One profile cannot read or mutate another profile's events through the application API.

Loading behavior:

- Missing data returns an empty event list.
- Parsed values are accepted only when they are an array of valid event objects.
- Corrupt or incompatible data returns an empty list plus a recoverable German warning.
- Loading failures do not crash or block the calendar.

Mutation behavior is atomic from the user's perspective:

1. Build the proposed next event list.
2. Serialize and write it to `localStorage`.
3. Update React state only after the write succeeds.
4. If writing fails, keep the prior state and show a German error toast.

The repository exposes only load, create, update, and delete operations needed by this milestone. No cross-tab storage-event synchronization is added.

## State and component boundaries

### Calendar event repository

Pure storage and validation functions. It has no React dependency and accepts a storage-compatible object in tests.

### `useCalendarEvents`

A focused React hook binds the repository to the current profile ID. It owns the in-memory list, reload initialization, CRUD mutations, sorted results, and recoverable storage errors.

### `CalendarPage`

The page reads the authenticated profile ID, coordinates the visible month and selected date, and owns dialog state. It passes events and selection callbacks into the month calendar and selected-day list.

### `MonthCalendar`

The existing semantic month table remains responsible for month rendering. Each calendar date becomes selectable and exposes event presence in the correct date cell. It does not read storage or own event mutations.

### `CalendarEventDialog`

One responsive form supports both creation and editing. It reuses `ResponsiveDialog`, `FormField`, `Button`, and existing design tokens. The first invalid field receives focus and validation errors are announced in German.

### Selected-day event list

A list beneath the month table exposes the selected day's full events with accessible edit actions. This gives mobile users reliable touch targets without forcing long titles into narrow seven-column cells.

## Month view behavior

- The existing Monday-first, fixed six-week month grid remains.
- The current day remains highlighted with `aria-current="date"`.
- The selected day is visually distinct and exposed through an accessible state.
- Desktop cells show compact event previews containing optional start time and a truncated title.
- Mobile cells show a compact event marker and count.
- Selecting a date updates the detailed list below the grid.
- Selecting an adjacent-month date is allowed; the visible month does not change until the user navigates or saves an event in another month.
- Month navigation selects the first day of the newly visible month so the detailed list always matches a visible date.

## Create, edit, and delete flows

### Create

- A prominent German `Termin erstellen` action appears near the calendar heading.
- The form defaults to the selected calendar date.
- A successful save closes the dialog, selects the saved date, moves the visible month when needed, renders the event in the correct day, and shows a success toast.

### Edit

- Events are opened from the selected-day list.
- The same form is prefilled with the stored values.
- Saving applies the same validation as creation.
- Moving an event to another date selects and reveals that date after saving.

### Delete

- The edit dialog exposes a clearly styled delete action.
- Deletion opens a separate confirmation dialog.
- Only explicit confirmation removes the event.
- Success closes the relevant dialogs, updates the month and day list, and shows a success toast.

## Validation

- Title is required after trimming.
- Date is required and must be a real ISO local calendar date.
- Start and end times, when present, must be valid `HH:mm` values.
- End time is allowed only when start time exists.
- When both times exist, end time must be equal to or later than start time.
- Description is optional and trimmed.
- Validation errors stay in the dialog and do not write to storage.

Same-day events are sufficient for this milestone. Overnight events are intentionally excluded because the model contains only one date.

## Accessibility

- Existing semantic table, caption, weekday headers, and German date labels remain.
- Selectable dates use native buttons with an accessible selected state and a date-specific label that includes the event count.
- Date controls fill their complete calendar cell and keep at least 44 px height; actions outside the seven-column grid keep at least 44-by-44 px touch targets.
- Dialog focus trapping, focus restoration, Escape handling, and mobile sheet gestures come from `ResponsiveDialog`.
- Form controls have explicit labels and associated error text.
- Save, delete, and storage outcomes use the existing toast live regions.
- Event previews are not the only way to access events; the selected-day list provides full text and edit controls.

## Responsive design

- Desktop retains event previews inside roomy day cells.
- Mobile uses count/marker summaries in cells and the detailed selected-day list below the month.
- Long titles and descriptions wrap or truncate only in previews; complete text remains available in the event list and edit dialog.
- The seven-column calendar keeps fixed layout without horizontal page overflow.
- Dialogs become bottom sheets through the existing responsive dialog behavior.

## Error handling

- Invalid form data produces field-level German messages.
- A failed storage write leaves the previous event list untouched and keeps the form open.
- Corrupt stored data produces a non-blocking German warning and an empty usable calendar.
- Unexpected event IDs cannot update or delete unrelated data; the operation fails without changing storage.
- React text rendering is used for user content, so stored titles and descriptions are never injected as HTML.

## Testing

### Unit tests

Repository and model tests cover:

- valid loading and sorting
- profile-specific storage keys
- create, update, and delete persistence
- missing, corrupt, and incompatible storage values
- failed writes retaining prior data
- form validation, including time ordering

### Component tests

Calendar tests cover:

- creating an event
- editing all supported fields
- confirming and completing deletion
- rendering an event on the correct calendar date
- selected-day details
- German validation and storage errors
- accessible dialog and date-selection behavior

### Playwright

Browser tests cover:

- creating an event and seeing it on the selected day
- reloading and confirming persistence
- editing the event
- deleting it through confirmation
- desktop and mobile layouts without horizontal overflow

Existing auth, navigation, personalization, security, build, and PWA checks must remain green. Skips that depend on optional local Supabase or screenshot flags remain unchanged.

## Files and deployment boundaries

Expected changes stay within the calendar feature, its tests, and these Superpowers documents. Existing shared design-system components may be reused but do not require behavior changes. No Supabase, database, Edge Function, secret, Graphify, manifest, service worker, or deployment configuration changes are permitted.
