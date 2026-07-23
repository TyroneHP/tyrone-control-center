# CoreGrid Local Calendar Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add profile-isolated local event creation, display, editing, deletion, and reload persistence to the existing CoreGrid month calendar.

**Architecture:** A versioned local-storage repository validates and atomically persists events per authenticated profile. A focused React hook exposes sorted event state and mutations, while calendar components remain presentational and existing CoreGrid dialogs, forms, buttons, cards, toasts, and tokens provide the responsive accessible UI.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Testing Library, Playwright, Zod, React Hook Form, existing CoreGrid design system, browser `localStorage`.

## Global Constraints

- Keep all visible user text in German; code, types, storage keys, and commit messages remain English.
- Store events only in the browser under `coregrid:calendar-events:v1:<profile-id>`.
- Do not change Supabase, database migrations, Edge Functions, secrets, Graphify, the PWA manifest, service worker behavior, or deployment configuration.
- Do not add synchronization, recurring events, reminders, week views, day views, or new dependencies.
- Reuse the existing `ResponsiveDialog`, `FormField`, `Button`, `Card`, `ToastProvider`, and design tokens.
- Keep the production GitHub Pages base path `/tyrone-control-center/` unchanged.
- Use Node.js `>=22.12.0` and npm.
- Every implementation task follows RED, confirmed failure, minimal GREEN implementation, full relevant test run, then commit.
- Do not modify or remove the untracked `debug.log` in another worktree.

## File Structure

- Create `src/features/calendar/calendarEvents.ts`: event types, form validation, storage validation, sorting, profile key generation, and atomic CRUD repository functions.
- Create `src/features/calendar/calendarEvents.test.ts`: domain, validation, isolation, persistence, corruption, and failed-write tests.
- Create `src/features/calendar/useCalendarEvents.ts`: React state adapter for the repository.
- Create `src/features/calendar/useCalendarEvents.test.tsx`: hook initialization, CRUD state, identity, and failure tests.
- Create `src/features/calendar/CalendarEventDialog.tsx`: accessible create/edit form using the shared responsive dialog.
- Create `src/features/calendar/CalendarEventDialog.test.tsx`: form prefilling, validation, save, delete-request, and focus tests.
- Create `src/features/calendar/SelectedDayEvents.tsx`: accessible full event list for the selected date.
- Create `src/features/calendar/SelectedDayEvents.test.tsx`: empty state, ordering, full content, and edit-action tests.
- Modify `src/features/calendar/MonthCalendar.tsx`: selectable dates plus desktop previews and mobile summaries.
- Modify `src/features/calendar/MonthCalendar.test.tsx`: correct date placement, selected state, and event-count interaction tests.
- Modify `src/features/calendar/CalendarPage.tsx`: authenticated profile binding, event workflow, toasts, and delete confirmation.
- Modify `src/features/calendar/CalendarPage.test.tsx`: end-to-end component CRUD and storage-error tests.
- Modify `src/features/calendar/calendar.css`: responsive event cells, selected-day list, and form layout.
- Modify `tests/e2e/calendar.spec.ts`: persisted create/edit/delete lifecycle and mobile overflow coverage.

---

### Task 1: Event domain and atomic local repository

**Files:**
- Create: `src/features/calendar/calendarEvents.ts`
- Create: `src/features/calendar/calendarEvents.test.ts`

**Interfaces:**
- Produces: `CalendarEvent`, `CalendarEventDraft`, `CalendarEventFormValues`, `CalendarStorage`, `LoadCalendarEventsResult`, `calendarEventFormSchema`, `toCalendarEventDraft`, `calendarEventsStorageKey`, `sortCalendarEvents`, `loadCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, and `deleteCalendarEvent`.
- Storage mutation functions accept the current event array and return a new sorted array only after `setItem` succeeds.

- [ ] **Step 1: Write failing repository and validation tests**

Create `src/features/calendar/calendarEvents.test.ts` with concrete tests:

```ts
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
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm test -- src/features/calendar/calendarEvents.test.ts
```

Expected: FAIL because `./calendarEvents` does not exist.

- [ ] **Step 3: Implement the event domain and repository**

Create `src/features/calendar/calendarEvents.ts` with:

```ts
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
```

- [ ] **Step 4: Run repository tests and confirm GREEN**

Run:

```bash
npm test -- src/features/calendar/calendarEvents.test.ts
```

Expected: all repository and validation tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/calendar/calendarEvents.ts src/features/calendar/calendarEvents.test.ts
git diff --cached --check
git commit -m "feat(calendar): add local event repository"
```

---

### Task 2: Profile-bound React event state

**Files:**
- Create: `src/features/calendar/useCalendarEvents.ts`
- Create: `src/features/calendar/useCalendarEvents.test.tsx`

**Interfaces:**
- Consumes: Task 1 repository functions and types.
- Produces: `useCalendarEvents({ profileId, storage?, createId? })` returning `{ events, warning, createEvent, updateEvent, deleteEvent }`.
- Mutation methods synchronously return the new event list or throw without updating state.

- [ ] **Step 1: Write failing hook tests**

Create `src/features/calendar/useCalendarEvents.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calendarEventsStorageKey, type CalendarStorage } from './calendarEvents'
import { useCalendarEvents } from './useCalendarEvents'

function memoryStorage() {
  const values = new Map<string, string>()
  const storage: CalendarStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
  return { storage, values }
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
})
```

- [ ] **Step 2: Run hook tests and confirm RED**

Run:

```bash
npm test -- src/features/calendar/useCalendarEvents.test.tsx
```

Expected: FAIL because `./useCalendarEvents` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/features/calendar/useCalendarEvents.ts`:

```ts
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

export function useCalendarEvents({
  createId,
  profileId,
  storage = getBrowserStorage() ?? undefined,
}: UseCalendarEventsOptions) {
  const [loaded] = useState(() =>
    storage
      ? loadCalendarEvents(storage, profileId)
      : { events: [], warning: 'Lokale Termine sind in diesem Browser nicht verfügbar.' },
  )
  const [events, setEvents] = useState(loaded.events)
  const eventsRef = useRef(loaded.events)

  const requireStorage = useCallback(() => {
    if (!storage) throw new Error('Termine konnten nicht lokal gespeichert werden.')
    return storage
  }, [storage])

  const createEvent = useCallback(
    (draft: CalendarEventDraft) => {
      const nextEvents = createCalendarEvent(
        requireStorage(),
        profileId,
        eventsRef.current,
        draft,
        createId,
      )
      eventsRef.current = nextEvents
      setEvents(nextEvents)
      return nextEvents
    },
    [createId, profileId, requireStorage],
  )

  const updateEvent = useCallback(
    (eventId: string, draft: CalendarEventDraft) => {
      const nextEvents = updateCalendarEvent(
        requireStorage(),
        profileId,
        eventsRef.current,
        eventId,
        draft,
      )
      eventsRef.current = nextEvents
      setEvents(nextEvents)
      return nextEvents
    },
    [profileId, requireStorage],
  )

  const deleteEvent = useCallback(
    (eventId: string) => {
      const nextEvents = deleteCalendarEvent(
        requireStorage(),
        profileId,
        eventsRef.current,
        eventId,
      )
      eventsRef.current = nextEvents
      setEvents(nextEvents)
      return nextEvents
    },
    [profileId, requireStorage],
  )

  return { createEvent, deleteEvent, events, updateEvent, warning: loaded.warning }
}
```

- [ ] **Step 4: Run hook and repository tests and confirm GREEN**

Run:

```bash
npm test -- src/features/calendar/calendarEvents.test.ts src/features/calendar/useCalendarEvents.test.tsx
```

Expected: all event repository and hook tests pass with one storage write per mutation.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/features/calendar/useCalendarEvents.ts src/features/calendar/useCalendarEvents.test.tsx
git diff --cached --check
git commit -m "feat(calendar): add profile event state"
```

---

### Task 3: Accessible event form and selected-day list

**Files:**
- Create: `src/features/calendar/CalendarEventDialog.tsx`
- Create: `src/features/calendar/CalendarEventDialog.test.tsx`
- Create: `src/features/calendar/SelectedDayEvents.tsx`
- Create: `src/features/calendar/SelectedDayEvents.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent`, `CalendarEventDraft`, `CalendarEventFormValues`, `calendarEventFormSchema`, and `toCalendarEventDraft` from Task 1.
- Produces: `CalendarEventDialog` with `{ event?, initialDate, onClose, onRequestDelete?, onSave, open }` and `SelectedDayEvents` with `{ date, events, onEdit }`.

- [ ] **Step 1: Write failing dialog and list tests**

Test create validation and save, edit prefilling/delete request, and selected-day full content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalendarEventDialog } from './CalendarEventDialog'

describe('CalendarEventDialog', () => {
  it('validates and submits a trimmed create draft', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CalendarEventDialog
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))
    expect(await screen.findByText('Bitte gib einen Titel ein.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Titel'), '  Arzt  ')
    await user.type(screen.getByLabelText('Startzeit'), '10:00')
    await user.type(screen.getByLabelText('Endzeit'), '09:00')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))
    expect(
      await screen.findByText('Die Endzeit darf nicht vor der Startzeit liegen.'),
    ).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Endzeit'))
    await user.type(screen.getByLabelText('Endzeit'), '11:00')
    await user.click(screen.getByRole('button', { name: 'Termin speichern' }))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Arzt',
      date: '2026-07-20',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('prefills editing and exposes delete separately', async () => {
    const user = userEvent.setup()
    const onRequestDelete = vi.fn()
    render(
      <CalendarEventDialog
        event={{ id: 'event-1', title: 'Arzt', date: '2026-07-20' }}
        initialDate="2026-07-20"
        onClose={vi.fn()}
        onRequestDelete={onRequestDelete}
        onSave={vi.fn()}
        open
      />,
    )
    expect(screen.getByLabelText('Titel')).toHaveValue('Arzt')
    await user.click(screen.getByRole('button', { name: 'Termin löschen' }))
    expect(onRequestDelete).toHaveBeenCalledOnce()
  })
})
```

Create `SelectedDayEvents.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectedDayEvents } from './SelectedDayEvents'

it('shows full selected-day details and edits the chosen event', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const events = [
    { id: 'untimed', title: 'Einkaufen', date: '2026-07-20', description: 'Milch' },
    { id: 'timed', title: 'Arzt', date: '2026-07-20', startTime: '10:00', endTime: '11:00' },
  ]
  render(<SelectedDayEvents date="2026-07-20" events={events} onEdit={onEdit} />)

  expect(screen.getByRole('heading', { name: 'Termine am 20. Juli 2026' }))
    .toBeInTheDocument()
  expect(screen.getByText('Milch')).toBeInTheDocument()
  expect(screen.getByText('10:00–11:00')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Arzt bearbeiten' }))
  expect(onEdit).toHaveBeenCalledWith(events[1])
})
```

- [ ] **Step 2: Run UI tests and confirm RED**

Run:

```bash
npm test -- src/features/calendar/CalendarEventDialog.test.tsx src/features/calendar/SelectedDayEvents.test.tsx
```

Expected: FAIL because both components do not exist.

- [ ] **Step 3: Implement `CalendarEventDialog`**

Use `useForm<CalendarEventFormValues>`, `zodResolver(calendarEventFormSchema)`, `ResponsiveDialog`, `FormField`, and `Button`. Reset the form whenever `open`, `event`, or `initialDate` changes. Associate every error through `aria-describedby`, place initial focus on the title field, and render actions with the form's generated `id`:

```tsx
const defaults = (event: CalendarEvent | undefined, initialDate: string) => ({
  title: event?.title ?? '',
  date: event?.date ?? initialDate,
  startTime: event?.startTime ?? '',
  endTime: event?.endTime ?? '',
  description: event?.description ?? '',
})
```

The dialog title is `Termin erstellen` or `Termin bearbeiten`. Actions are `Abbrechen`, edit-only `Termin löschen`, and `Termin speichern`. `onSave` receives only `toCalendarEventDraft(values)` after schema validation.

- [ ] **Step 4: Implement `SelectedDayEvents`**

Render a `Card` labelled by a German formatted date heading. Empty state: `Für diesen Tag sind keine Termine eingetragen.` Each event article shows optional time range, full title, optional description, and a 44 px `Bearbeiten` button whose accessible name includes the event title.

- [ ] **Step 5: Run UI tests and confirm GREEN**

Run:

```bash
npm test -- src/features/calendar/CalendarEventDialog.test.tsx src/features/calendar/SelectedDayEvents.test.tsx
```

Expected: both test files pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/features/calendar/CalendarEventDialog.tsx src/features/calendar/CalendarEventDialog.test.tsx src/features/calendar/SelectedDayEvents.tsx src/features/calendar/SelectedDayEvents.test.tsx
git diff --cached --check
git commit -m "feat(calendar): add event editing surfaces"
```

---

### Task 4: Event-aware month grid

**Files:**
- Modify: `src/features/calendar/MonthCalendar.tsx`
- Modify: `src/features/calendar/MonthCalendar.test.tsx`
- Modify: `src/features/calendar/calendar.css`

**Interfaces:**
- Consumes: `CalendarEvent[]` from Task 1.
- Changes `MonthCalendarProps` to include `events: CalendarEvent[]`, `onSelectDate(date: string): void`, and `selectedDate: string`.
- Existing month navigation and today highlighting remain unchanged.

- [ ] **Step 1: Add failing month placement and selection tests**

Update every existing `MonthCalendar` render with `events={[]}`, `selectedDate="2026-07-16"`, and `onSelectDate={vi.fn()}`. Add:

```tsx
it('renders events on the correct date and exposes date selection', async () => {
  const user = userEvent.setup()
  const onSelectDate = vi.fn()
  render(
    <MonthCalendar
      events={[
        { id: 'event-1', title: 'Arzt', date: '2026-07-16', startTime: '10:00' },
        { id: 'event-2', title: 'Training', date: '2026-07-17' },
      ]}
      month={new Date(2026, 6, 1)}
      onNextMonth={vi.fn()}
      onPreviousMonth={vi.fn()}
      onSelectDate={onSelectDate}
      selectedDate="2026-07-16"
      today={new Date(2026, 6, 16)}
    />,
  )

  const selectedDay = screen.getByRole('button', {
    name: /Donnerstag, 16. Juli 2026, 1 Termin/,
  })
  expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
  expect(within(selectedDay).getByText('Arzt')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Freitag, 17. Juli 2026, 1 Termin/ }))
    .not.toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Freitag, 17. Juli 2026/ }))
  expect(onSelectDate).toHaveBeenCalledWith('2026-07-17')
})
```

Import `within` from Testing Library.

- [ ] **Step 2: Run the month test and confirm RED**

Run:

```bash
npm test -- src/features/calendar/MonthCalendar.test.tsx
```

Expected: TypeScript/runtime failure because the month component does not accept or render events.

- [ ] **Step 3: Implement event grouping, selectable cells, and summaries**

Build a memo-free `Map<string, CalendarEvent[]>` for the small local array. For each day, compute its events and an accessible label ending in `kein Termin`, `1 Termin`, or `<n> Termine`. Replace the static cell content with one native button filling the cell:

```tsx
<button
  aria-label={`${day.dateLabel}, ${eventCountLabel(dayEvents.length)}`}
  aria-pressed={selectedDate === day.isoDate}
  className="month-calendar__day-button"
  data-date={day.isoDate}
  onClick={() => onSelectDate(day.isoDate)}
  type="button"
>
  <time aria-current={day.isToday ? 'date' : undefined} dateTime={day.isoDate}>
    {day.dayNumber}
  </time>
  <span className="month-calendar__event-previews" aria-hidden="true">
    {dayEvents.slice(0, 2).map((event) => (
      <span className="month-calendar__event-preview" key={event.id}>
        {event.startTime ? <span>{event.startTime}</span> : null}
        <span>{event.title}</span>
      </span>
    ))}
  </span>
  {dayEvents.length > 0 ? (
    <span className="month-calendar__event-count" aria-hidden="true">
      {dayEvents.length}
    </span>
  ) : null}
</button>
```

- [ ] **Step 4: Add responsive CoreGrid styles**

In `calendar.css`, keep the table fixed-width and move existing day padding/background/selected states to the full-cell button. Desktop previews use token colors, one-line ellipsis, and no pointer behavior. Under 768 px hide previews, show the compact count marker, keep the date button at least 44 px tall, and prevent horizontal overflow. Add visible `:focus-visible` using the existing focus token or primary color.

- [ ] **Step 5: Run all calendar component tests and confirm GREEN**

Run:

```bash
npm test -- src/features/calendar/MonthCalendar.test.tsx src/features/calendar/calendarModel.test.ts
```

Expected: all month rendering, navigation, today, event placement, and selection tests pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/features/calendar/MonthCalendar.tsx src/features/calendar/MonthCalendar.test.tsx src/features/calendar/calendar.css
git diff --cached --check
git commit -m "feat(calendar): render events in month view"
```

---

### Task 5: Calendar page CRUD workflow

**Files:**
- Modify: `src/features/calendar/CalendarPage.tsx`
- Modify: `src/features/calendar/CalendarPage.test.tsx`
- Modify: `src/features/calendar/calendar.css`
- Modify: `tests/e2e/calendar.spec.ts`

**Interfaces:**
- Consumes: `useAuth`, `useToast`, `ResponsiveDialog`, Tasks 1–4 components and types.
- Extends `CalendarPageProps` with optional `storage?: CalendarStorage` and `createId?: () => string` for deterministic tests; production uses browser storage and `crypto.randomUUID()`.

- [ ] **Step 1: Add failing integrated CRUD tests**

Wrap `CalendarPage` with `AuthContext.Provider` containing active `profile.id = 'profile-a'` and `ToastProvider`. Use a memory storage implementation. Add separate tests that:

1. select July 20, create `Arzt`, and assert the event appears in that cell and selected-day list;
2. edit title, date, times, and description and assert the event moves to July 21;
3. request deletion, assert confirmation, confirm, and assert the event disappears;
4. use a throwing storage object, submit, assert the German error toast, open dialog, and unchanged calendar.

The create assertion must query the day button by the German full-date accessible name and use `within(dayButton)` so an event on the wrong day cannot satisfy the test.

Also extend `tests/e2e/calendar.spec.ts` before implementing the page. The new test must clear only `coregrid:calendar-events:v1:22222222-2222-2222-2222-222222222222`, create a complete event, assert it in the correct date cell, reload and assert persistence, edit its title/date, cancel deletion once, confirm deletion, and assert no horizontal overflow. Keep the existing month navigation test and run the lifecycle in both configured browser projects.

- [ ] **Step 2: Run page tests and confirm RED**

Run:

```bash
npm test -- src/features/calendar/CalendarPage.test.tsx
npm run test:e2e -- tests/e2e/calendar.spec.ts
```

Expected: both commands FAIL because `CalendarPage` has no event controls or local storage integration.

- [ ] **Step 3: Integrate profile state and calendar event UI**

In `CalendarPage`:

- read `profile` from `useAuth()` and guard the impossible protected-route null profile;
- initialize `useCalendarEvents({ profileId: profile.id, storage, createId })`;
- store selected date as local ISO string, initially `today`;
- store create/edit dialog state and delete confirmation state;
- filter the sorted event array for the selected day;
- render `Termin erstellen`, `MonthCalendar`, and `SelectedDayEvents`;
- show the hook load warning once through `useToast`;
- catch mutation errors, leave dialogs open, and show the exact error through an error toast;
- on successful create/update, select the saved date and set the visible month from it;
- on successful delete, close confirmation and edit dialogs while preserving a valid selected day;
- show success toasts `Termin wurde erstellt.`, `Termin wurde gespeichert.`, and `Termin wurde gelöscht.`.

Render the delete confirmation as a second `ResponsiveDialog` titled `Termin löschen`, with German explanatory text including the event title and actions `Abbrechen` and `Termin endgültig löschen`.

- [ ] **Step 4: Style page controls, list, and form**

Add only calendar-scoped classes to `calendar.css`: header actions wrap on mobile; selected-day cards and event rows use existing surfaces/borders; form fields use a one-column mobile layout and two-column time row on desktop; descriptions wrap safely; all external action buttons retain at least 44 px height.

- [ ] **Step 5: Run the complete calendar unit/component suite and confirm GREEN**

Run:

```bash
npm test -- src/features/calendar
npm run test:e2e -- tests/e2e/calendar.spec.ts
```

Expected: every calendar repository, hook, dialog, list, page, month, and model test passes, plus the persisted desktop and iPhone browser lifecycle.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/features/calendar/CalendarPage.tsx src/features/calendar/CalendarPage.test.tsx src/features/calendar/calendar.css tests/e2e/calendar.spec.ts
git diff --cached --check
git commit -m "feat(calendar): manage local calendar events"
```

---

### Task 6: Complete verification and Draft PR

**Files:**
- No product files change unless a verification failure is proven to be caused by this feature.

**Interfaces:**
- Verifies the complete branch against `origin/main` and publishes it only after all checks pass.

- [ ] **Step 1: Run complete required verification**

Run from the feature worktree:

```bash
npm ci
npm run check
npm run security:scan
npm run test:e2e
```

Expected:

- npm clean install succeeds;
- ESLint reports 0 errors and 0 warnings;
- TypeScript succeeds;
- all Vitest files and tests pass;
- production/PWA build succeeds without changing PWA scope;
- secret scan succeeds;
- Playwright reports zero failures, with only the repository's existing environment-flag and browser-project skips.

- [ ] **Step 2: Verify scope and repository hygiene**

Run:

```bash
git diff --check origin/main...HEAD
git diff --name-status origin/main...HEAD
git status --short --branch
git grep -n "coregrid:calendar-events:v1:" -- src tests docs
```

Confirm:

- only calendar feature files, calendar tests, and the approved spec/plan changed;
- no Supabase, migrations, Edge Functions, Graphify, manifest, service worker, secret, or deployment files changed;
- no secret values appear in tracked files or `dist`;
- the feature worktree is clean;
- the separate `debug.log` remains untouched.

- [ ] **Step 3: Review, push, and open a Draft PR**

Use `superpowers:requesting-code-review` on `origin/main...HEAD`. Fix only genuine Critical or Important findings with regression tests and rerun affected checks. Then:

```bash
git push -u origin codex/local-calendar-events
```

Create a Draft PR against `main` titled:

```text
feat: add local CoreGrid calendar events
```

The PR description must summarize local profile isolation, CRUD UI, atomic persistence, responsive accessibility, RED/GREEN evidence, complete test results, and explicit absence of Supabase, Graphify, PWA, secret, and deployment changes. Do not merge or deploy.
