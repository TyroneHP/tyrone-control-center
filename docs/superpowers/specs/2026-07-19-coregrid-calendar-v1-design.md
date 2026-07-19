# CoreGrid Calendar V1 Design Specification

**Status:** Approved design
**Date:** 2026-07-19
**Target repository:** `TyroneHP/tyrone-control-center`

## 1. Goal

Replace the protected `/calendar` placeholder with the first usable CoreGrid
calendar page: a responsive, accessible German month view with Monday as the
first weekday, a clear current-day marker, and previous/next month navigation.

The existing `Kalender` navigation item remains the entry point. This milestone
does not add events, selection, persistence, synchronization, reminders,
Graphify, Supabase, database access, or new PWA behavior.

## 2. User experience

- The page heading is `Kalender` and the visible month is announced in German,
  for example `Juli 2026`.
- Weekdays run from Monday through Sunday.
- The month uses a stable six-week, seven-column layout. Days from adjacent
  months remain visible but visually subdued so the grid does not jump between
  months.
- Today's date is highlighted with existing CoreGrid accent tokens and marked
  with `aria-current="date"`.
- Icon buttons labeled `Vorheriger Monat` and `Nächster Monat` move exactly one
  month at a time. Navigation anchors calculations to the first day of the
  visible month so short months cannot skip or overflow.
- No date is selectable and no empty event affordance is shown.

## 3. Component structure

- `CalendarPage` owns the currently visible month and connects navigation to the
  month view.
- `MonthCalendar` renders the toolbar, German month label, weekday headings, and
  day cells. It receives the visible month, today's date, and navigation
  callbacks as explicit props.
- Pure date helpers create the Monday-first 6×7 model and compare calendar dates
  without persistence or external dependencies.
- Calendar-specific CSS lives beside the feature and consumes existing color,
  spacing, radius, shadow, focus, and motion tokens. Existing `Button` and
  `Card` components are reused.
- The router replaces only the current calendar placeholder with `CalendarPage`.
  Existing navigation configuration and all other routes remain unchanged.

## 4. Accessibility and responsive behavior

- The month is represented as a semantic table because the cells are read-only
  dates, not an interactive ARIA grid.
- The table has an accessible month caption, native column headers, complete
  date labels on cells, and `aria-current="date"` only for today.
- Month buttons retain the design-system focus ring and a minimum 44-pixel touch
  target.
- Desktop uses the existing elevated card treatment. Mobile reduces spacing and
  typography while keeping all seven columns inside the viewport without
  horizontal page overflow.
- Light and dark themes use only established CoreGrid tokens.

## 5. Testing

- Pure unit tests cover Monday-first alignment, leap-year February, adjacent
  month cells, and stable 42-day output.
- Component tests cover German labels, the current-day marker, previous/next
  navigation across year boundaries, and accessible button/table semantics.
- The protected router test verifies that `/calendar` renders the real calendar
  instead of the placeholder.
- Calendar-only Playwright coverage verifies desktop and mobile rendering,
  month navigation, today's marker, and absence of horizontal overflow.
- Existing test suites must remain green. No unrelated tests or snapshots are
  added.

## 6. Error handling and constraints

The page has no external data source and therefore no loading or network error
state. Date generation uses valid local calendar dates and deterministic helper
inputs in tests. Any failure introduced by this milestone is fixed only within
the calendar scope; unrelated behavior is not refactored.
