# CoreGrid Calendar V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the protected calendar placeholder with an accessible, responsive German month view that highlights today and supports previous/next month navigation.

**Architecture:** A pure date-model module produces a deterministic Monday-first 42-day grid. `MonthCalendar` renders the read-only semantic table, while `CalendarPage` owns only the visible-month state and the router supplies the protected page.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Testing Library, Playwright, existing CoreGrid design-system components and CSS tokens.

## Global Constraints

- Node.js must remain `>=22.12.0`; use npm and add no dependencies.
- All visible copy is German; code, identifiers, and commit messages remain English.
- Reuse `Button`, `Card`, Lucide icons, and existing CoreGrid tokens.
- The week begins on Monday and the grid always contains 42 days.
- Do not add events, selection, persistence, synchronization, reminders, Graphify, Supabase, database access, secrets, or PWA behavior.
- Keep all existing routes and navigation behavior unchanged except replacing the `/calendar` placeholder.
- Add or modify tests only when they directly verify the calendar milestone.

---

### Task 1: Deterministic month model

**Files:**
- Create: `src/features/calendar/calendarModel.ts`
- Create: `src/features/calendar/calendarModel.test.ts`

**Interfaces:**
- Produces: `CalendarDay`, `CALENDAR_WEEKDAYS`, `buildMonthGrid(visibleMonth, today)`, `formatMonthLabel(date)`, and `shiftMonth(date, offset)`.
- Consumes: native `Date` and `Intl.DateTimeFormat`; no application state or browser APIs.

- [ ] **Step 1: Write the failing model tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  formatMonthLabel,
  shiftMonth,
} from './calendarModel'

describe('calendar month model', () => {
  it('builds a Monday-first six-week grid with adjacent dates', () => {
    const days = buildMonthGrid(new Date(2026, 6, 1), new Date(2026, 6, 16))

    expect(days).toHaveLength(42)
    expect(days[0]).toMatchObject({
      isoDate: '2026-06-29',
      isCurrentMonth: false,
    })
    expect(days[41].isoDate).toBe('2026-08-09')
    expect(days.find((day) => day.isToday)?.isoDate).toBe('2026-07-16')
  })

  it('includes leap day in February 2028', () => {
    const days = buildMonthGrid(new Date(2028, 1, 1), new Date(2028, 1, 29))

    expect(days).toContainEqual(
      expect.objectContaining({
        isoDate: '2028-02-29',
        isCurrentMonth: true,
        isToday: true,
      }),
    )
  })

  it('moves across year boundaries from the first of the month', () => {
    expect(shiftMonth(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1))
    expect(shiftMonth(new Date(2026, 0, 31), -1)).toEqual(new Date(2025, 11, 1))
    expect(formatMonthLabel(new Date(2026, 6, 1))).toBe('Juli 2026')
  })
})
```

- [ ] **Step 2: Run the model tests and confirm RED**

Run: `npm test -- src/features/calendar/calendarModel.test.ts`

Expected: FAIL because `./calendarModel` does not exist.

- [ ] **Step 3: Implement the minimal date model**

```ts
const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

const dateLabelFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})

export const CALENDAR_WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const

export interface CalendarDay {
  date: Date
  dateLabel: string
  dayNumber: number
  isoDate: string
  isCurrentMonth: boolean
  isToday: boolean
}

function sameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function toLocalIsoDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildMonthGrid(
  visibleMonth: Date,
  today: Date,
): CalendarDay[] {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const monthStart = new Date(year, month, 1)
  const daysBeforeMonday = (monthStart.getDay() + 6) % 7

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - daysBeforeMonday + index)
    return {
      date,
      dateLabel: dateLabelFormatter.format(date),
      dayNumber: date.getDate(),
      isoDate: toLocalIsoDate(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: sameCalendarDate(date, today),
    }
  })
}

export function formatMonthLabel(date: Date) {
  return monthFormatter.format(date)
}

export function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}
```

- [ ] **Step 4: Run the model tests and confirm GREEN**

Run: `npm test -- src/features/calendar/calendarModel.test.ts`

Expected: 1 file and 3 tests pass.

- [ ] **Step 5: Commit the month model**

```bash
git add src/features/calendar/calendarModel.ts src/features/calendar/calendarModel.test.ts
git commit -m "feat(calendar): add month grid model"
```

---

### Task 2: Accessible month calendar component

**Files:**
- Create: `src/features/calendar/MonthCalendar.tsx`
- Create: `src/features/calendar/MonthCalendar.test.tsx`
- Create: `src/features/calendar/calendar.css`

**Interfaces:**
- Consumes: Task 1 exports plus `Button`, `Card`, `ChevronLeft`, and `ChevronRight`.
- Produces: `MonthCalendar({ month, today, onPreviousMonth, onNextMonth })`.

- [ ] **Step 1: Write the failing component tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar } from './MonthCalendar'

describe('MonthCalendar', () => {
  it('renders a German semantic month table and marks today', () => {
    render(
      <MonthCalendar
        month={new Date(2026, 6, 1)}
        onNextMonth={vi.fn()}
        onPreviousMonth={vi.fn()}
        today={new Date(2026, 6, 16)}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Monatskalender Juli 2026' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent('16')
  })

  it('exposes accessible previous and next month actions', async () => {
    const user = userEvent.setup()
    const onPreviousMonth = vi.fn()
    const onNextMonth = vi.fn()
    render(
      <MonthCalendar
        month={new Date(2026, 6, 1)}
        onNextMonth={onNextMonth}
        onPreviousMonth={onPreviousMonth}
        today={new Date(2026, 6, 16)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(onPreviousMonth).toHaveBeenCalledOnce()
    expect(onNextMonth).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the component tests and confirm RED**

Run: `npm test -- src/features/calendar/MonthCalendar.test.tsx`

Expected: FAIL because `./MonthCalendar` does not exist.

- [ ] **Step 3: Implement the semantic month table**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card } from '../../design-system'
import {
  buildMonthGrid,
  CALENDAR_WEEKDAYS,
  formatMonthLabel,
} from './calendarModel'
import './calendar.css'

export interface MonthCalendarProps {
  month: Date
  onNextMonth: () => void
  onPreviousMonth: () => void
  today: Date
}

export function MonthCalendar({
  month,
  onNextMonth,
  onPreviousMonth,
  today,
}: MonthCalendarProps) {
  const days = buildMonthGrid(month, today)
  const monthLabel = formatMonthLabel(month)
  const weeks = Array.from({ length: 6 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  )

  return (
    <Card className="calendar-card">
      <div className="calendar-toolbar">
        <Button
          aria-label="Vorheriger Monat"
          className="calendar-toolbar__button"
          onClick={onPreviousMonth}
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Button>
        <h2 aria-live="polite" className="calendar-toolbar__title">
          {monthLabel}
        </h2>
        <Button
          aria-label="Nächster Monat"
          className="calendar-toolbar__button"
          onClick={onNextMonth}
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </Button>
      </div>

      <div className="month-calendar__viewport">
        <table className="month-calendar">
          <caption className="calendar-visually-hidden">
            {`Monatskalender ${monthLabel}`}
          </caption>
          <thead>
            <tr>
              {CALENDAR_WEEKDAYS.map((weekday) => (
                <th key={weekday} scope="col">
                  <abbr title={weekday}>{weekday.slice(0, 2)}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].isoDate}>
                {week.map((day) => (
                  <td
                    className="month-calendar__day"
                    data-outside-month={!day.isCurrentMonth}
                    key={day.isoDate}
                  >
                    <time
                      aria-current={day.isToday ? 'date' : undefined}
                      aria-label={day.dateLabel}
                      dateTime={day.isoDate}
                    >
                      {day.dayNumber}
                    </time>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Add token-based responsive styles**

```css
.calendar-card {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow: hidden;
}

.calendar-toolbar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 0.75rem;
}

.calendar-toolbar__button {
  width: 44px;
  min-height: 44px;
  padding: 0;
}

.calendar-toolbar__title {
  margin: 0;
  text-align: center;
  font-size: clamp(1.15rem, 3vw, 1.6rem);
  text-transform: capitalize;
}

.month-calendar__viewport {
  min-width: 0;
  overflow: hidden;
}

.calendar-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.month-calendar {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0.35rem;
}

.month-calendar th {
  padding-block: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.month-calendar th abbr {
  text-decoration: none;
}

.month-calendar__day {
  height: clamp(3.25rem, 7vw, 5.75rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-bg-elevated);
  padding: 0.4rem;
  text-align: center;
  vertical-align: top;
}

.month-calendar__day[data-outside-month='true'] {
  background: transparent;
  color: var(--color-text-muted);
  opacity: 0.58;
}

.month-calendar time {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 50%;
}

.month-calendar time[aria-current='date'] {
  background: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
  color: var(--color-on-primary);
  font-weight: 800;
}

@media (max-width: 767px) {
  .calendar-card {
    gap: 0.65rem;
    padding: 0.7rem;
  }

  .calendar-toolbar {
    gap: 0.35rem;
  }

  .month-calendar {
    border-spacing: 0.12rem;
  }

  .month-calendar th {
    font-size: 0.68rem;
  }

  .month-calendar__day {
    height: 3rem;
    border-radius: 10px;
    padding: 0.12rem;
  }

  .month-calendar time {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 0.86rem;
  }
}
```

- [ ] **Step 5: Run the component and model tests and confirm GREEN**

Run: `npm test -- src/features/calendar/calendarModel.test.ts src/features/calendar/MonthCalendar.test.tsx`

Expected: 2 files and 5 tests pass.

- [ ] **Step 6: Commit the month component**

```bash
git add src/features/calendar/MonthCalendar.tsx src/features/calendar/MonthCalendar.test.tsx src/features/calendar/calendar.css
git commit -m "feat(calendar): add accessible month view"
```

---

### Task 3: Calendar page, protected route, and responsive browser coverage

**Files:**
- Create: `src/features/calendar/CalendarPage.tsx`
- Create: `src/features/calendar/CalendarPage.test.tsx`
- Modify: `src/features/calendar/calendar.css`
- Modify: `src/routes/router.tsx`
- Modify: `src/routes/router.test.tsx`
- Create: `tests/e2e/calendar.spec.ts`

**Interfaces:**
- Consumes: `MonthCalendar` and `shiftMonth` from Tasks 1–2.
- Produces: `CalendarPage({ today?: Date })`, used by the protected `/calendar` route.

- [ ] **Step 1: Write the failing page state test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CalendarPage } from './CalendarPage'

describe('CalendarPage', () => {
  it('navigates across a year boundary without changing today', async () => {
    const user = userEvent.setup()
    render(<CalendarPage today={new Date(2026, 11, 18)} />)

    expect(screen.getByRole('heading', { name: 'Dezember 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(screen.getByRole('heading', { name: 'Januar 2027' })).toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }))
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent('18')
  })
})
```

- [ ] **Step 2: Update the calendar router assertion before implementation**

Replace the placeholder-specific protected calendar test with:

```tsx
it('renders the protected calendar page for an active profile', async () => {
  renderRoute('/calendar', activeClient())

  expect(
    await screen.findByRole('heading', { name: 'Kalender' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('table', { name: /Monatskalender/ }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Bereich vorbereitet')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Add the calendar-only Playwright test before route integration**

```ts
import { expect, test } from '@playwright/test'
import { installPreviewSession } from './previewSession'

test('renders and navigates the responsive month calendar without overflow', async ({
  page,
}) => {
  await installPreviewSession(page, 'member')
  await page.goto('/calendar')

  await expect(page.getByRole('heading', { name: 'Kalender' })).toBeVisible()
  const calendar = page.getByRole('table', { name: /Monatskalender/ })
  await expect(calendar).toBeVisible()
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1)

  const initialMonth = await page.locator('.calendar-toolbar__title').innerText()
  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(page.locator('.calendar-toolbar__title')).not.toHaveText(initialMonth)

  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fitsViewport).toBe(true)
})
```

- [ ] **Step 4: Run page, router, and desktop browser tests and confirm RED**

Run: `npm test -- src/features/calendar/CalendarPage.test.tsx src/routes/router.test.tsx`

Expected: FAIL because `CalendarPage` does not exist and the router still renders the placeholder.

Run: `npm run test:e2e -- tests/e2e/calendar.spec.ts --project=desktop-chromium`

Expected: FAIL because the `/calendar` route has no calendar table.

- [ ] **Step 5: Implement `CalendarPage`**

```tsx
import { useState } from 'react'
import { MonthCalendar } from './MonthCalendar'
import { shiftMonth } from './calendarModel'
import './calendar.css'

export interface CalendarPageProps {
  today?: Date
}

export function CalendarPage({ today = new Date() }: CalendarPageProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), 1),
  )

  return (
    <section className="calendar-page">
      <header className="calendar-page__header">
        <p>Planung</p>
        <h1>Kalender</h1>
        <p>Deine Monatsübersicht.</p>
      </header>
      <MonthCalendar
        month={visibleMonth}
        onNextMonth={() => setVisibleMonth((month) => shiftMonth(month, 1))}
        onPreviousMonth={() => setVisibleMonth((month) => shiftMonth(month, -1))}
        today={today}
      />
    </section>
  )
}
```

- [ ] **Step 6: Add page layout styles**

```css
.calendar-page {
  display: grid;
  width: min(100%, 72rem);
  gap: clamp(1.25rem, 3vw, 2rem);
  margin: 0 auto;
}

.calendar-page__header {
  display: grid;
  gap: 0.35rem;
}

.calendar-page__header p,
.calendar-page__header h1 {
  margin: 0;
}

.calendar-page__header > p:first-child {
  color: var(--color-accent-text);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.calendar-page__header h1 {
  font-size: clamp(2rem, 5vw, 3.75rem);
  letter-spacing: -0.045em;
}

.calendar-page__header > p:last-child {
  color: var(--color-text-muted);
}
```

- [ ] **Step 7: Replace only the calendar placeholder route**

Add the import and route element in `src/routes/router.tsx`:

```tsx
import { CalendarPage } from '../features/calendar/CalendarPage'

// Within the protected shell children:
{ path: 'calendar', element: <CalendarPage /> },
```

- [ ] **Step 8: Run calendar unit, route, and E2E tests and confirm GREEN**

Run: `npm test -- src/features/calendar src/routes/router.test.tsx`

Expected: calendar model/component/page tests and protected routing pass.

Run: `npm run test:e2e -- tests/e2e/calendar.spec.ts`

Expected: 2 tests pass, one in desktop Chromium and one in iPhone WebKit.

- [ ] **Step 9: Commit page integration and browser coverage**

```bash
git add src/features/calendar/CalendarPage.tsx src/features/calendar/CalendarPage.test.tsx src/features/calendar/calendar.css src/routes/router.tsx src/routes/router.test.tsx tests/e2e/calendar.spec.ts
git commit -m "feat(calendar): integrate responsive calendar page"
```

---

### Task 4: Full verification and publication

**Files:**
- Verify only; modify calendar-scoped files if a failure was introduced by this milestone.

**Interfaces:**
- Consumes: complete calendar implementation from Tasks 1–3.
- Produces: a clean, pushed feature branch and a Draft PR targeting `main`.

- [ ] **Step 1: Install the exact dependency graph**

Run: `npm ci`

Expected: installation succeeds without lockfile changes.

- [ ] **Step 2: Run the complete quality gate**

Run: `npm run check`

Expected: ESLint, TypeScript, all Vitest tests, and the production/PWA build pass.

- [ ] **Step 3: Run the security scan**

Run: `npm run security:scan`

Expected: tracked files and `dist/` contain no secret values.

- [ ] **Step 4: Run the full browser suite**

Run: `npm run test:e2e`

Expected: all runnable Playwright tests pass; only environment-gated existing skips remain.

- [ ] **Step 5: Verify scope and repository state**

```bash
git diff --check origin/main...HEAD
git status --short --branch
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors, only calendar/design/plan changes, and no secrets, Supabase, database, Graphify, or PWA capability changes.

- [ ] **Step 6: Push and create the Draft PR**

```bash
git push -u origin codex/calendar-v1
gh pr create --draft --base main --head codex/calendar-v1 --title "feat: add CoreGrid calendar month view" --body "Adds the tested German month grid, accessible month navigation, responsive CoreGrid styling, and protected calendar route without persistence or backend changes."
```

The PR body must summarize the date model, accessible responsive month view,
route integration, RED/GREEN evidence, and complete test results. Do not merge
or deploy.
