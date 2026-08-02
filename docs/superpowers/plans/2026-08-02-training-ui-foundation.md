# Training UI Foundation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible Training area with a mobile-first, iOS-inspired CoreGrid experience driven only by in-memory mock state.

**Architecture:** `TrainingDemoProvider` owns a typed reset-on-reload UI domain and is the only source for new training routes. New screens compose scoped primitives and local SVGs. IndexedDB and analytics stay physically intact but are removed from the visible runtime tree. A catch-all replaces every legacy deep training URL with the dashboard.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Playwright, existing Lucide icons and local SVG illustrations; no new dependencies.

## Global Constraints

- Work only in `redesign/training-ui-foundation`. Leave the root worktree’s untracked `debug.log` untouched.
- Node.js minimum is `22.12.0`. Use npm, Vite and already installed dependencies.
- Visible copy is German. Code identifiers, data identifiers and commit messages are English.
- Preserve CoreGrid desktop sidebar, mobile bottom navigation, authentication and non-training routes.
- Do not read, write, migrate, delete or synchronize IndexedDB training data. Do not change Supabase, Graphify, secrets, PWA configuration or production data.
- Reuse local `public/training/exercises/*.svg` only. No external images, APIs, pagination or capped exercise results.
- Catalog filters/search/favorites cover exactly all 50 built-in exercises. Favorites are independent of filters.
- Visible training routes are Dashboard, Pläne, Bibliothek and active training. All retired nested training routes use `Navigate replace` to `/training`.
- Each task follows TDD: failing focused test, confirmed RED, minimal code, confirmed GREEN, scoped commit.
- `ResponsiveDialog` is only an accessibility primitive for newly styled sheets/dialogs; do not retain old training card/form/editor styles.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/features/training/demo/trainingDemoTypes.ts` | UI-only exercise, plan, session, set and wizard types. |
| `src/features/training/demo/mockTrainingData.ts` | Stable 50-exercise catalog adapter and deterministic mock seed. |
| `src/features/training/demo/trainingDemoReducer.ts` | Pure immutable mock-state transitions. |
| `src/features/training/demo/TrainingDemoProvider.tsx` | Context and typed UI actions. |
| `src/features/training/demo/useTrainingDemo.ts` | Guarded context consumer. |
| `src/features/training/components/ui/*` | New header/list/chip/sheet/wizard/FAB/set/empty-state primitives. |
| `src/features/training/components/TrainingDemoLayout.tsx` | Provider, three-item navigation and outlet. |
| `src/features/training/pages/TrainingDashboardPage.tsx` | Dashboard and start choice. |
| `src/features/training/pages/TrainingPlanDetailPage.tsx` | Compact plan detail and actions. |
| `src/features/training/pages/TrainingPlanWizardPage.tsx` | Four-step transient plan creator. |
| `src/features/training/pages/TrainingExerciseLibraryPage.tsx` | Complete catalog/filter/favorites UI. |
| `src/features/training/pages/TrainingActiveSessionPage.tsx` | Single-exercise active workout. |
| `src/features/training/training-ui.css` | Scoped dark/light mobile-first styles. |
| `src/routes/router.tsx` and `src/routes/ProtectedShell.tsx` | New route tree and old provider removal. |
| `tests/e2e/training-ui-foundation.spec.ts` | Responsive acceptance, redirect and screenshot evidence. |

Keep the existing provider, IndexedDB repository, analytics and historic pages on disk so data and existing non-UI tests survive. No new visible route may import `useTraining()`, `TrainingProvider` or the repository.

## Task 1: Add the typed in-memory demo domain

**Files:**
- Create: `src/features/training/demo/trainingDemoTypes.ts`
- Create: `src/features/training/demo/mockTrainingData.ts`
- Create: `src/features/training/demo/trainingDemoReducer.ts`
- Create: `src/features/training/demo/trainingDemoReducer.test.ts`
- Create: `src/features/training/demo/TrainingDemoProvider.tsx`
- Create: `src/features/training/demo/TrainingDemoProvider.test.tsx`
- Create: `src/features/training/demo/useTrainingDemo.ts`

**Interfaces:** consumes `STANDARD_EXERCISES` as a read-only source. Produces `TrainingDemoState`, `TrainingDemoPlan`, `TrainingDemoSession`, `createInitialTrainingDemoState()` and `useTrainingDemo()`.

- [ ] **Step 1: Write RED reducer tests**

```ts
it('exposes all 50 local exercises', () => {
  expect(createInitialTrainingDemoState().exercises).toHaveLength(50)
})

it('uses 3 × 8–12 defaults for a selected exercise', () => {
  const next = trainingDemoReducer(createInitialTrainingDemoState(), {
    type: 'wizard/toggle-exercise',
    exerciseId: 'bench-press',
  })
  expect(next.wizard.draft.exercises[0]).toMatchObject({
    targetSets: 3,
    repMin: 8,
    repMax: 12,
  })
})

it('keeps the selected IDs when visible library filters change', () => {
  const next = trainingDemoReducer(createInitialTrainingDemoState(), {
    type: 'wizard/toggle-exercise',
    exerciseId: 'bench-press',
  })
  expect(next.wizard.selectedExerciseIds).toContain('bench-press')
})

it('removes the one active session only after explicit discard', () => {
  const active = trainingDemoReducer(createInitialTrainingDemoState(), {
    type: 'session/start',
    planId: 'upper-body',
  })
  expect(active.activeSession).toBeDefined()
  expect(trainingDemoReducer(active, { type: 'session/discard' }).activeSession).toBeUndefined()
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/features/training/demo/trainingDemoReducer.test.ts src/features/training/demo/TrainingDemoProvider.test.tsx`

Expected: FAIL because demo modules do not exist.

- [ ] **Step 3: Implement the small domain boundary**

```ts
export interface TrainingDemoExercise {
  id: string
  name: string
  muscle: string
  equipment: string
  illustrationPath: string
  gripOptions: readonly string[]
}

export interface TrainingDemoState {
  exercises: readonly TrainingDemoExercise[]
  favoriteExerciseIds: readonly string[]
  plans: readonly TrainingDemoPlan[]
  activeSession?: TrainingDemoSession
  wizard: TrainingDemoWizardState
}

export function createInitialTrainingDemoState(): TrainingDemoState {
  return {
    exercises: createDemoExercises(STANDARD_EXERCISES),
    favoriteExerciseIds: ['bench-press', 'lat-pulldown'],
    plans: createDemoPlans(),
    activeSession: createDemoActiveSession(),
    wizard: createEmptyWizardState(),
  }
}
```

Implement immutable actions for favorite toggling, wizard choice/order/value edits, plan create/duplicate/delete, session start, set change/add/remove, active-exercise navigation, finish and discard. Provider mounts a fresh initial state once and never imports the old provider, `idb` or any repository.

- [ ] **Step 4: Add provider reset proof and confirm GREEN**

```tsx
it('resets deterministic demo data after remount', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<TrainingDemoProvider><Probe /></TrainingDemoProvider>)
  await user.click(screen.getByRole('button', { name: 'Bankdrücken als Favorit entfernen' }))
  rerender(<TrainingDemoProvider key="fresh"><Probe /></TrainingDemoProvider>)
  expect(screen.getByRole('button', { name: 'Bankdrücken als Favorit entfernen' })).toBeVisible()
})
```

Run: `npx vitest run src/features/training/demo/trainingDemoReducer.test.ts src/features/training/demo/TrainingDemoProvider.test.tsx`

Expected: PASS; 50 entries, defaults, one active session and reset-on-remount are proven.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/demo
git commit -m "feat(training): add demo state foundation"
```

## Task 2: Build scoped iOS-style primitives

**Files:**
- Create: `src/features/training/components/ui/TrainingScreenHeader.tsx`
- Create: `src/features/training/components/ui/TrainingList.tsx`
- Create: `src/features/training/components/ui/TrainingChip.tsx`
- Create: `src/features/training/components/ui/TrainingFab.tsx`
- Create: `src/features/training/components/ui/TrainingBottomSheet.tsx`
- Create: `src/features/training/components/ui/TrainingWizardHeader.tsx`
- Create: `src/features/training/components/ui/TrainingStickyActionBar.tsx`
- Create: `src/features/training/components/ui/CompactExerciseRow.tsx`
- Create: `src/features/training/components/ui/TrainingSetRow.tsx`
- Create: `src/features/training/components/ui/TrainingEmptyState.tsx`
- Create: `src/features/training/components/ui/TrainingBottomSheet.test.tsx`
- Create: `src/features/training/components/ui/TrainingSetRow.test.tsx`
- Create: `src/features/training/training-ui.css`

**Interfaces:** consumes `ResponsiveDialog` focus/keyboard/pointer-cancel support and CoreGrid tokens. Produces presentation-only primitives with explicit props.

- [ ] **Step 1: Write RED accessibility tests**

```tsx
it('returns focus to its opener after a dismissible sheet closes', async () => {
  const user = userEvent.setup()
  render(<SheetHarness />)
  await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Planaktionen öffnen' })).toHaveFocus()
})

it('labels numeric fields and exposes completed state without color alone', () => {
  render(<TrainingSetRow setNumber={1} value={demoSet} onChange={vi.fn()} />)
  expect(screen.getByLabelText('Satz 1 Gewicht')).toHaveAttribute('inputmode', 'decimal')
  expect(screen.getByLabelText('Satz 1 abgeschlossen')).toHaveAttribute('aria-pressed', 'false')
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/features/training/components/ui/TrainingBottomSheet.test.tsx src/features/training/components/ui/TrainingSetRow.test.tsx`

Expected: FAIL because primitives are absent.

- [ ] **Step 3: Implement components and scoped CSS**

```tsx
export function TrainingBottomSheet({ children, open, onClose, title }: Props) {
  return (
    <ResponsiveDialog onClose={onClose} open={open} title={title}>
      <div className="training-sheet__content">{children}</div>
    </ResponsiveDialog>
  )
}
```

```css
.training-demo {
  --training-accent: #ff7a45;
  --training-fab: #326ac1;
  width: min(100%, 70rem);
  margin-inline: auto;
  padding: 1rem 1rem calc(6.5rem + env(safe-area-inset-bottom));
}

.training-demo__sticky-action,
.training-demo__fab {
  bottom: calc(5rem + env(safe-area-inset-bottom));
}

@media (prefers-reduced-motion: reduce) {
  .training-demo *, .training-demo *::before, .training-demo *::after { transition-duration: 0ms; }
}
```

Use semantic buttons for chips/toggles, labeled numeric inputs, 44px targets, orange actions/blue FAB, glass separators and readable status text. Do not use global selectors, visible native select/checkbox controls or old training cards/forms.

- [ ] **Step 4: Confirm GREEN**

Run: `npx vitest run src/features/training/components/ui/TrainingBottomSheet.test.tsx src/features/training/components/ui/TrainingSetRow.test.tsx`

Expected: PASS; Escape restores focus and set controls are screen-reader and mobile-keyboard safe.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/components/ui src/features/training/training-ui.css
git commit -m "feat(training): add iOS training primitives"
```

## Task 3: Replace visible route tree and redirect legacy paths

**Files:**
- Create: `src/features/training/components/TrainingDemoLayout.tsx`
- Create: `src/features/training/components/TrainingDemoLayout.test.tsx`
- Create: `src/features/training/pages/TrainingDashboardPage.tsx` as initial accessible route target
- Create: `src/features/training/pages/TrainingPlanDetailPage.tsx` as an accessible route stub
- Create: `src/features/training/pages/TrainingPlanWizardPage.tsx` as an accessible route stub
- Create: `src/features/training/pages/TrainingExerciseLibraryPage.tsx` as an accessible route stub
- Create: `src/features/training/pages/TrainingActiveSessionPage.tsx` as an accessible route stub
- Modify: `src/routes/router.tsx`
- Modify: `src/routes/router.test.tsx`
- Modify: `src/routes/ProtectedShell.tsx`

**Interfaces:** consumes `TrainingDemoProvider`, `Outlet` and `Navigate`. Produces only `/training`, `/training/plans/new`, `/training/plans/:planId`, `/training/library` and `/training/active` plus a catch-all redirect.

- [ ] **Step 1: Write RED route tests**

```tsx
it.each([
  '/training/history',
  '/training/progress',
  '/training/progress/records',
  '/training/templates/old/edit',
])('replaces obsolete training route %s with the dashboard', async (path) => {
  renderRoute(path)
  expect(await screen.findByRole('heading', { name: 'Training' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Verlauf' })).not.toBeInTheDocument()
})

it('shows only Dashboard, Pläne and Bibliothek internally', () => {
  render(<TrainingDemoLayout />)
  expect(screen.getByRole('navigation', { name: 'Training' })).toHaveTextContent(
    'DashboardPläneBibliothek',
  )
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/routes/router.test.tsx src/features/training/components/TrainingDemoLayout.test.tsx`

Expected: FAIL because legacy pages still render.

- [ ] **Step 3: Implement new training routes**

```tsx
{
  path: 'training',
  element: <TrainingDemoLayout />,
  children: [
    { index: true, element: <TrainingDashboardPage /> },
    { path: 'plans/new', element: <TrainingPlanWizardPage /> },
    { path: 'plans/:planId', element: <TrainingPlanDetailPage /> },
    { path: 'library', element: <TrainingExerciseLibraryPage /> },
    { path: 'active', element: <TrainingActiveSessionPage /> },
    { path: '*', element: <Navigate replace to="/training" /> },
  ],
}
```

Layout wraps the outlet in `TrainingDemoProvider`, imports `training-ui.css` and renders exactly three German internal links. Remove `TrainingProvider` and `TrainingRecoveryDialog` from `ProtectedShell` but do not delete their sources or data.

- [ ] **Step 4: Confirm GREEN**

Run: `npx vitest run src/routes/router.test.tsx src/features/training/components/TrainingDemoLayout.test.tsx`

Run: `rg -n "TrainingProvider|TrainingRecoveryDialog|useTraining\\(" src/routes src/features/training/components/TrainingDemoLayout.tsx src/features/training/pages/Training*.tsx`

Expected: tests PASS and no old provider/recovery import appears in the new runtime boundary.

- [ ] **Step 5: Commit**

```bash
git add src/routes/router.tsx src/routes/router.test.tsx src/routes/ProtectedShell.tsx src/features/training/components/TrainingDemoLayout.tsx src/features/training/components/TrainingDemoLayout.test.tsx src/features/training/pages/TrainingDashboardPage.tsx src/features/training/pages/TrainingPlanDetailPage.tsx src/features/training/pages/TrainingPlanWizardPage.tsx src/features/training/pages/TrainingExerciseLibraryPage.tsx src/features/training/pages/TrainingActiveSessionPage.tsx
git commit -m "feat(training): replace visible training routes"
```

## Task 4: Deliver Dashboard, start sheet and Plan Detail

**Files:**
- Modify: `src/features/training/pages/TrainingDashboardPage.tsx`
- Create: `src/features/training/pages/TrainingDashboardPage.test.tsx`
- Modify: `src/features/training/pages/TrainingPlanDetailPage.tsx`
- Create: `src/features/training/pages/TrainingPlanDetailPage.test.tsx`
- Create: `src/features/training/components/StartTrainingSheet.tsx`
- Create: `src/features/training/components/StartTrainingSheet.test.tsx`

**Interfaces:** consumes `useTrainingDemo()` and Task 2 primitives. Produces dashboard navigation only to new approved routes and mock session actions.

- [ ] **Step 1: Write RED page tests**

```tsx
it('continues one active session rather than creating another', async () => {
  renderDashboard()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Training fortsetzen' }))
  expect(navigate).toHaveBeenCalledWith('/training/active')
  expect(readDemoState().activeSession).toBeDefined()
})

it('offers today plan, another plan and free workout', async () => {
  renderDashboard()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Training starten' }))
  expect(screen.getByRole('dialog', { name: 'Training starten' })).toHaveTextContent(
    'Heutigen PlanAnderen PlanFreies Training',
  )
})

it('requires a second confirmation before plan deletion', async () => {
  renderPlanDetail('upper-body')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Planaktionen öffnen' }))
  await user.click(screen.getByRole('button', { name: 'Plan löschen' }))
  expect(screen.getByRole('dialog', { name: 'Plan wirklich löschen?' })).toBeVisible()
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/features/training/pages/TrainingDashboardPage.test.tsx src/features/training/pages/TrainingPlanDetailPage.test.tsx src/features/training/components/StartTrainingSheet.test.tsx`

Expected: FAIL because the compact UI behavior is missing.

- [ ] **Step 3: Implement page behavior**

```tsx
<TrainingList aria-label="Weitere Trainingspläne">
  {state.plans.map((plan) => (
    <TrainingListRow
      detail={plan.exercises.length + ' Übungen · ' + plan.estimatedMinutes + ' Min.'}
      key={plan.id}
      onClick={() => navigate('/training/plans/' + plan.id)}
      title={plan.name}
    />
  ))}
</TrainingList>
```

Dashboard order is active compact row, large weekday-assigned plan, additional plan rows, free workout, library row and safe-area blue FAB. Start sheet omits today-plan choice if no plan applies. Detail shows back action, weekdays, count, duration, compact exercises and action sheet with edit/duplicate/double-confirm delete. All changes call reducer actions only.

- [ ] **Step 4: Confirm GREEN**

Run: `npx vitest run src/features/training/pages/TrainingDashboardPage.test.tsx src/features/training/pages/TrainingPlanDetailPage.test.tsx src/features/training/components/StartTrainingSheet.test.tsx`

Expected: PASS; active conflict, no-today state, actions and deletion confirmation are covered.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/pages/TrainingDashboardPage.tsx src/features/training/pages/TrainingDashboardPage.test.tsx src/features/training/pages/TrainingPlanDetailPage.tsx src/features/training/pages/TrainingPlanDetailPage.test.tsx src/features/training/components/StartTrainingSheet.tsx src/features/training/components/StartTrainingSheet.test.tsx
git commit -m "feat(training): add dashboard and plan details"
```

## Task 5: Implement Plan wizard and complete Exercise Library

**Files:**
- Modify: `src/features/training/pages/TrainingPlanWizardPage.tsx`
- Create: `src/features/training/pages/TrainingPlanWizardPage.test.tsx`
- Modify: `src/features/training/pages/TrainingExerciseLibraryPage.tsx`
- Create: `src/features/training/pages/TrainingExerciseLibraryPage.test.tsx`
- Create: `src/features/training/components/ExerciseFilterSheet.tsx`
- Create: `src/features/training/components/ExerciseFilterSheet.test.tsx`
- Create: `src/features/training/components/PlanExerciseEditorRow.tsx`
- Create: `src/features/training/components/PlanExerciseEditorRow.test.tsx`

**Interfaces:** consumes `toggleWizardExercise`, `moveWizardExercise`, `updateWizardExercise`, `saveWizardPlan` and `toggleFavorite`. Produces four accessible steps and a library with all 50 exercises.

- [ ] **Step 1: Write RED wizard/library tests**

```tsx
it('keeps Bankdrücken selected while switching to Favorites', async () => {
  renderWizardAtExerciseStep()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Bankdrücken auswählen' }))
  await user.click(screen.getByRole('button', { name: 'Favoriten filtern' }))
  expect(screen.getByRole('button', { name: 'Bankdrücken abwählen' })).toBeVisible()
})

it('searches all 50 exercises without a cap', async () => {
  renderLibrary()
  expect(screen.getAllByRole('button', { name: /Übung öffnen:/ })).toHaveLength(50)
  await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Übungen suchen' }), 'Klimmzug')
  expect(screen.getAllByRole('button', { name: /Übung öffnen:/ })).toHaveLength(1)
})

it('moves a selected exercise up through its accessible action', async () => {
  renderWizardAtAdjustmentStep(['bench-press', 'lat-pulldown'])
  await userEvent.setup().click(
    screen.getByRole('button', { name: 'Latziehen zur Brust nach oben verschieben' }),
  )
  expect(screen.getAllByTestId('plan-exercise-row').first()).toHaveTextContent('Latziehen zur Brust')
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/features/training/pages/TrainingPlanWizardPage.test.tsx src/features/training/pages/TrainingExerciseLibraryPage.test.tsx src/features/training/components/ExerciseFilterSheet.test.tsx src/features/training/components/PlanExerciseEditorRow.test.tsx`

Expected: FAIL because new wizard/filter/list components are absent.

- [ ] **Step 3: Implement all four steps**

```tsx
const steps = ['Grundlagen', 'Übungen', 'Anpassen', 'Vorschau'] as const

<TrainingWizardHeader currentStep={step} onClose={requestClose} steps={steps} />
{step === 1 && <PlanBasicsStep draft={wizard.draft} onChange={updateWizardBasics} />}
{step === 2 && <PlanExerciseSelection exercises={visibleExercises} selectedIds={wizard.selectedExerciseIds} />}
{step === 3 && <PlanExerciseAdjustment exercises={wizard.draft.exercises} />}
{step === 4 && <PlanPreview plan={wizard.draft} />}
<TrainingStickyActionBar primaryAction={nextOrSaveAction} secondaryAction={backAction} />
```

Step 1 validates non-empty plan name and weekday chips. Step 2 has search and muscle/equipment/favorites sheet; filter changes do not erase IDs. Step 3 uses existing `@dnd-kit` only for pointer sorting plus permanent accessible up/down buttons and controls for sets, rep min/max, optional start weight, grip and remove. Step 4 previews the exact plan. Dirty close prompts to discard. Library shares this catalog/filter model, local illustration and favorite/details sheet; no visible native select or checkbox.

- [ ] **Step 4: Confirm GREEN**

Run: `npx vitest run src/features/training/pages/TrainingPlanWizardPage.test.tsx src/features/training/pages/TrainingExerciseLibraryPage.test.tsx src/features/training/components/ExerciseFilterSheet.test.tsx src/features/training/components/PlanExerciseEditorRow.test.tsx`

Expected: PASS; full catalog, independent favorites, retained selection, 3 × 8–12 and accessible sorting are proven.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/pages/TrainingPlanWizardPage.tsx src/features/training/pages/TrainingPlanWizardPage.test.tsx src/features/training/pages/TrainingExerciseLibraryPage.tsx src/features/training/pages/TrainingExerciseLibraryPage.test.tsx src/features/training/components/ExerciseFilterSheet.tsx src/features/training/components/ExerciseFilterSheet.test.tsx src/features/training/components/PlanExerciseEditorRow.tsx src/features/training/components/PlanExerciseEditorRow.test.tsx
git commit -m "feat(training): add plan wizard and exercise library"
```

## Task 6: Implement the focused Active Training flow

**Files:**
- Modify: `src/features/training/pages/TrainingActiveSessionPage.tsx`
- Create: `src/features/training/pages/TrainingActiveSessionPage.test.tsx`
- Create: `src/features/training/components/ActiveExerciseNavigator.tsx`
- Create: `src/features/training/components/ActiveExerciseNavigator.test.tsx`
- Create: `src/features/training/components/FinishDiscardSheet.tsx`
- Create: `src/features/training/components/FinishDiscardSheet.test.tsx`
- Modify: `src/features/training/components/ui/TrainingSetRow.tsx` only if active callbacks need extension.

**Interfaces:** consumes `updateActiveSet`, `addActiveSet`, `removeActiveSet`, `setCurrentExercise`, `finishSession` and `discardSession`. Produces controlled one-exercise state with no persistence side effect.

- [ ] **Step 1: Write RED active-session tests**

```tsx
it('changes only the current in-memory set', async () => {
  renderActiveSession()
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Satz 1 Gewicht'))
  await user.type(screen.getByLabelText('Satz 1 Gewicht'), '62.5')
  await user.click(screen.getByLabelText('Satz 1 abgeschlossen'))
  expect(readDemoState().activeSession?.exercises[0].sets[0]).toMatchObject({
    weight: 62.5,
    completed: true,
  })
})

it('moves on a horizontal content swipe but ignores an input swipe', () => {
  renderActiveSession()
  fireEvent.pointerDown(screen.getByTestId('active-exercise-content'), { pointerId: 1, clientX: 280, clientY: 100 })
  fireEvent.pointerUp(screen.getByTestId('active-exercise-content'), { pointerId: 1, clientX: 80, clientY: 100 })
  expect(screen.getByText('2 von 3 Übungen')).toBeVisible()
  fireEvent.pointerDown(screen.getByLabelText('Satz 1 Gewicht'), { pointerId: 2, clientX: 280, clientY: 100 })
  fireEvent.pointerUp(screen.getByLabelText('Satz 1 Gewicht'), { pointerId: 2, clientX: 80, clientY: 100 })
  expect(screen.getByText('2 von 3 Übungen')).toBeVisible()
})

it('requires confirmation before discard', async () => {
  renderActiveSession()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Training verwerfen' }))
  expect(screen.getByRole('dialog', { name: 'Training wirklich verwerfen?' })).toBeVisible()
})
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/features/training/pages/TrainingActiveSessionPage.test.tsx src/features/training/components/ActiveExerciseNavigator.test.tsx src/features/training/components/FinishDiscardSheet.test.tsx`

Expected: FAIL because focused active session is absent.

- [ ] **Step 3: Implement session view and gesture boundary**

```tsx
function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, button, [contenteditable="true"]'))
}

function onPointerUp(event: React.PointerEvent<HTMLElement>) {
  if (!swipeStart || isEditableTarget(event.target)) return
  const deltaX = event.clientX - swipeStart.x
  const deltaY = event.clientY - swipeStart.y
  if (Math.abs(deltaX) >= 72 && Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX < 0 ? 1 : -1)
}
```

Render header/duration/progress, local SVG, muscle/goal/last values, grip sheet, mock note and compact set rows. Support value/rating/completion/add/delete and visible previous/next buttons. Finish/discard have German confirmation sheets, clear only mock `activeSession` and go to `/training`; never create history.

- [ ] **Step 4: Confirm GREEN**

Run: `npx vitest run src/features/training/pages/TrainingActiveSessionPage.test.tsx src/features/training/components/ActiveExerciseNavigator.test.tsx src/features/training/components/FinishDiscardSheet.test.tsx`

Expected: PASS; controlled values, safe swipe, keyboard controls and finish/discard confirmation are covered.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/pages/TrainingActiveSessionPage.tsx src/features/training/pages/TrainingActiveSessionPage.test.tsx src/features/training/components/ActiveExerciseNavigator.tsx src/features/training/components/ActiveExerciseNavigator.test.tsx src/features/training/components/FinishDiscardSheet.tsx src/features/training/components/FinishDiscardSheet.test.tsx src/features/training/components/ui/TrainingSetRow.tsx
git commit -m "feat(training): add focused active workout flow"
```

## Task 7: Replace obsolete E2E expectations and create visual QA evidence

**Files:**
- Create: `tests/e2e/training-ui-foundation.spec.ts`
- Modify: `tests/e2e/training.spec.ts` only to remove intentionally retired history/persistence assertions.
- Modify: `tests/e2e/training-analytics.spec.ts` to assert redirects rather than old analytics.
- Modify: `tests/e2e/screenshots.spec.ts` only if it is the existing capture convention.
- Create: `docs/screenshots/training-ui-foundation/` only through the documented screenshot capture gate; never commit cache/output directories.

**Interfaces:** consumes `installPreviewSession`, new German labels and new routes. Produces iPhone WebKit/Desktop Chromium acceptance evidence.

- [ ] **Step 1: Write RED E2E flow and redirect tests**

```ts
test('creates a mock plan, starts it, edits a set and finishes on iPhone WebKit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'Runs once in iPhone WebKit.')
  await installPreviewSession(page, 'member')
  await page.goto(trainingPath())
  await page.getByRole('button', { name: 'Neuen Trainingsplan erstellen' }).click()
  await page.getByLabel('Planname').fill('Mobil-Test')
  await page.getByRole('button', { name: 'Weiter zu Übungen' }).click()
  await page.getByRole('button', { name: 'Bankdrücken auswählen' }).click()
  await page.getByRole('button', { name: 'Plan speichern' }).click()
  await page.getByRole('button', { name: 'Training starten: Mobil-Test' }).click()
  await page.getByLabel('Satz 1 Gewicht').fill('60')
  await page.getByLabel('Satz 1 abgeschlossen').click()
  await page.getByRole('button', { name: 'Training abschließen' }).click()
  await page.getByRole('button', { name: 'Training abschließen bestätigen' }).click()
  await expect(page).toHaveURL(/\/training$/)
})

test.each(['/training/history', '/training/progress', '/training/progress/bodyweight'])(
  'redirects %s to dashboard',
  async ({ page }, oldPath) => {
    await page.goto(oldPath)
    await expect(page).toHaveURL(/\/training$/)
  },
)
```

- [ ] **Step 2: Confirm RED**

Run: `npx playwright test tests/e2e/training-ui-foundation.spec.ts --project=iphone-webkit`

Expected: FAIL until routes, labels and mock flow exist.

- [ ] **Step 3: Add responsive assertions and screenshots**

Assert tap targets at least 44px, `documentElement.scrollWidth <= innerWidth` on iPhone, FAB/sticky actions above `.mobile-navigation` and `.desktop-sidebar` visible on desktop. Use the existing screenshot environment gate:

```ts
await expect(page).toHaveScreenshot('training-dashboard-mobile.png', { fullPage: true })
await page.goto(trainingPath('/library'))
await expect(page).toHaveScreenshot('training-library-mobile.png', { fullPage: true })
```

Capture active dashboard, plan detail, four wizard steps, library, filter sheet, active session and desktop dashboard. Retain non-training auth/navigation/PWA checks.

- [ ] **Step 4: Confirm GREEN on both projects**

Run: `npx playwright test tests/e2e/training-ui-foundation.spec.ts`

Expected: PASS for desktop Chromium and iPhone WebKit; environment-gated screenshot skips are reported.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/training-ui-foundation.spec.ts tests/e2e/training.spec.ts tests/e2e/training-analytics.spec.ts tests/e2e/screenshots.spec.ts docs/screenshots/training-ui-foundation
git commit -m "test(training): cover responsive demo flows"
```

## Task 8: Document limits, verify fully and open the Draft PR

**Files:**
- Modify: `README.md` only if it claims visible training persistence, history or analytics.
- Modify: `docs/training.md` only if it describes a visible Phase-1/Phase-2 route.
- Modify: this plan to check off completed items.
- Modify: `src/routes/router.test.tsx` only to retain the legacy redirect contract.

**Interfaces:** consumes complete feature branch and existing scripts. Produces evidence-backed documentation and a draft PR; never deploys or merges.

- [ ] **Step 1: Keep the redirect contract in a test**

```tsx
it('redirects progress instead of rendering an analytics screen', async () => {
  renderRoute('/training/progress')
  expect(await screen.findByRole('heading', { name: 'Training' })).toBeVisible()
  expect(screen.queryByText('Fortschritts-Dashboard')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Verify this test before docs**

Run: `npx vitest run src/routes/router.test.tsx`

Expected: PASS after Task 3; repair routing before docs if it fails.

- [ ] **Step 3: Write only truthful existing-doc corrections**

Document where a Training section already exists: UI state resets after reload; existing IndexedDB data is preserved but unused; only Dashboard/Pläne/Bibliothek and active training are visible; deep routes redirect to `/training`; no Supabase synchronization exists. Do not create a second guide when no existing text requires correction.

- [ ] **Step 4: Run every mandatory command separately**

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run test:e2e
git diff --check
git status --short
```

Expected: lint, typecheck, Vitest, build/PWA, security scan and runnable Playwright checks pass. Record exact totals and expected E2E skips. Do not run `npm audit fix`, Supabase, Graphify or deployment commands.

- [ ] **Step 5: Commit docs only if changed**

```bash
git add README.md docs/training.md docs/superpowers/plans/2026-08-02-training-ui-foundation.md src/routes/router.test.tsx
git commit -m "docs(training): clarify UI foundation limits"
```

If no README/docs change is needed, stage only completed plan items and route-contract test with `docs(training): record UI foundation validation`.

- [ ] **Step 6: Push and create the requested Draft PR**

```bash
git push -u origin redesign/training-ui-foundation
gh pr create --draft --base main --head redesign/training-ui-foundation --title "feat: rebuild training experience with iOS-first UI" --body-file .github/pull-request-training-ui-foundation.md
```

The PR text must list new components/routes, replaced visible legacy UI, all 50 mock exercises and independent filters/favorites, reset-on-reload limitation, no IndexedDB migration, no Supabase/Graphify action, full command results, expected E2E skips and mobile/desktop screenshots. Delete the temporary body file after PR creation and verify it is not staged. Do not merge or deploy.

## Plan Self-Review

**Spec coverage:** Task 1 delivers mock state/catalog; Task 2 visual and accessible primitives; Task 3 runtime replacement and redirects; Task 4 dashboard/detail/start; Task 5 wizard/library; Task 6 active training; Task 7 responsive E2E/screenshots; Task 8 documentation, validation and draft PR.

**Placeholder scan:** Every task names exact files, contracts, test examples, RED/GREEN commands and commit scope. No storage, analytics, Supabase, Graphify or production work is introduced.

**Type consistency:** Task 3 creates compile-safe accessible route stubs for every new route, and Tasks 4–6 replace those stubs with their complete screen. All pages consume `useTrainingDemo()` and Task 1 types. No new route uses `useTraining()`.
