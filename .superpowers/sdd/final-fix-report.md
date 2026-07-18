# Final personalization review fix report

## Changed files

- App storage boundary: `src/app/App.tsx`, `src/app/App.test.tsx`
- Theme contrast and mappings: `src/design-system/tokens.css`,
  `src/design-system/styles.css`, `src/design-system/design-system.test.tsx`,
  `src/features/auth/auth.css`, `src/features/shell/AppShell.css`,
  `src/features/settings/settings.css`, `src/pwa/reloadPrompt.css`
- Responsive dialog close control and scroll lock:
  `src/design-system/ResponsiveDialog.tsx`,
  `src/design-system/ResponsiveDialog.test.tsx`
- Personal Settings current-tab icons:
  `src/features/settings/PersonalSettings.tsx`,
  `src/features/settings/SettingsPage.test.tsx`
- Responsive E2E coverage: `tests/e2e/personalization.spec.ts`
- Refreshed screenshot diffs:
  `docs/screenshots/design-dark-desktop-expanded.png`,
  `docs/screenshots/design-light-desktop-collapsed.png`,
  `docs/screenshots/design-mobile-tabs.png`, and
  `docs/screenshots/design-settings-personalization.png`

No backend, Supabase migration, Edge Function, environment, dependency, or
deployment file changed.

## RED/GREEN evidence

| Finding | RED | GREEN |
| --- | --- | --- |
| On-primary contrast and mappings | `npm.cmd test -- src/design-system/design-system.test.tsx`: 1 failed, 3 passed; missing `--color-on-primary`. A final hover audit then failed at 4.1869:1. | Same command: 4 passed. Both themes now provide `--color-on-primary`; primary and hover combinations are at least 4.5:1, and primary controls/brand marks use the token. |
| Throwing `localStorage` getter | `npm.cmd test -- src/app/App.test.tsx`: 1 failed, 3 passed; render threw `DOMException`. | Same command: 4 passed; App resolves browser storage behind a guard and uses inert storage when unavailable. |
| Blocked-storage persistence warning follow-up | `npm.cmd test -- src/app/App.test.tsx`: 1 failed, 3 passed. With the `localStorage` getter throwing, the real preference action changed the live theme from dark to light, but the warning status was absent because fallback writes reported success. | Same command: 4 passed. Fallback writes now throw inside the supplied storage boundary, the adapter reports `false`, live state remains updated, and the existing German warning toast appears. |
| Visible dismissible-dialog close control | `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx`: 1 failed, 5 passed; no labelled close button. | Same command: 6 passed after adding the visible `Dialog schliessen` icon control and keeping critical dialogs without it. |
| Modal background scroll lock | `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx`: 1 failed, 6 passed; root overflow stayed `scroll`. | `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx src/design-system/ResponsiveDialog.ssr.test.tsx`: 8 passed; html/body styles lock while open and exact prior values return on close/unmount. |
| Personal Settings current icon/label | `npm.cmd test -- src/features/settings/SettingsPage.test.tsx`: 1 failed, 18 passed; no current-tab rows were found. | Same command: 19 passed; all three rows expose the current Lucide icon and label. |
| Responsive E2E gaps | Coverage-only additions exercised already-implemented behavior. The 900px forced-compact case passed on its first behavior run. The first exact mobile-label run exposed a mojibake test literal, which was corrected without a production change. | `npm.cmd run test:e2e -- tests/e2e/personalization.spec.ts`: 4 passed, 4 intentional cross-project skips. Exact order is asserted after selection/reorder and again after reload. The misleading title was renamed. |

## Full verification

Final sequential run after the blocked-storage follow-up:

- `npm.cmd run lint`: exit 0, no warnings.
- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run test`: 31 files passed, 115 tests passed.
- `npm.cmd run build`: exit 0; PWA assets generated. Vite retained its
  informational warning for the existing JavaScript chunk above 500 kB.
- `npm.cmd run security:scan`: exit 0; no secret values found.
- `npm.cmd run test:e2e`: 6 passed, 14 expected skips, 0 failed. The skips are
  the opt-in local-Supabase lifecycle, screenshot capture gate, and deliberate
  wrong-project branches.
- `npm.cmd run test:e2e -- tests/e2e/screenshots.spec.ts` with
  `CAPTURE_SCREENSHOTS=true`: 4 passed, 4 deliberate cross-project skips.

## Screenshot status

All four screenshot targets were refreshed, visually inspected, and have
committed diffs. Dark expanded, Light collapsed, configured mobile tabs, and
personal/admin Settings show no clipping or horizontal overflow. Labels,
safe-area spacing, contrast, and the new Settings icons are visible. Data is
limited to deterministic `example.test` preview placeholders; no personal data
is present.

## Remaining minor items

- `devicePreferences.ts` retains the runtime-safe double assertion used to
  construct the fixed three-item mobile-tab tuple.
- Tests still do not explicitly assert `matchMedia` unsubscription or
  pointer-cancel swipe prevention; both cleanup paths remain implemented.
- `ToastProvider.tsx` retains the focused Fast Refresh lint suppression for the
  co-located `useToast` export.

## Accessibility follow-up root causes (before implementation)

- **Modal focus containment:** `ResponsiveDialog` traps `Tab` only through an
  `onKeyDown` handler on the dialog node. Toasts are rendered by a separate
  portal directly under `document.body` and sit above the dialog overlay, so a
  Toast button can receive programmatic or pointer focus and invoke its action
  outside the active modal. The fix must coordinate every modal through one
  document-level guard, preserve the Toast live-region message, and restore
  listeners and focus when the last modal closes.
- **Dark focus contrast:** `--color-primary-hover` is reused as the focus-ring
  color. Its contrast against `--color-surface-soft` is about 2.649:1, and no
  test evaluates focus visibility against every relevant theme surface. The
  fix should introduce a dedicated theme-specific focus token, map both global
  and ThemeSwitch outlines to it, and calculate at least 3:1 in both themes.

### Modal focus RED evidence

- Command: `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx
  src/design-system/ResponsiveDialog.ssr.test.tsx
  src/design-system/ToastProvider.test.tsx`.
- Result before production changes: 2 failed, 16 passed. Programmatic focus
  stayed on the external Toast action instead of returning to the active
  dialog, and focus outside two stacked dialogs did not return to the topmost
  dialog. Both failures reproduce the document-level containment gap.

### Focus contrast RED evidence

- Command: `npm.cmd test -- src/design-system/design-system.test.tsx`.
- Result before token changes: 1 failed, 4 passed. The test resolved the
  focus variable actually used by both the global rule and ThemeSwitch, then
  measured `--color-primary-hover` against every adjacent surface. Dark
  `--color-surface-soft` produced 2.649:1, below the required 3:1.

### Accessibility follow-up GREEN evidence

- Modal focus uses one document-level modal stack. `focusin` returns direct or
  programmatic focus to the topmost dialog, and capture-phase pointer/click
  guards suppress every external action while preserving the Toast live
  region. Closing an underlying dialog keeps the remaining modal and scroll
  lock active; closing the last dialog removes listeners, restores exact
  scroll styles and opener focus, and makes the Toast action usable again.
  The focused Dialog/Toast/SSR command passes 18/18 tests.
- Both themes now define `--color-focus-ring`; global focus and ThemeSwitch
  outlines consume it. Dark uses `#75aaff` and measures 5.348:1 at its weakest
  adjacent surface. Light keeps the blue `#2859a6` and measures 5.953:1 at its
  weakest adjacent surface. The focused design-system command passes 5/5
  tests, while existing on-primary assertions remain green.

## Accessibility follow-up full verification

- Focused Dialog, Toast, SSR, contrast, Settings, and preference-provider run:
  6 files passed, 48 tests passed.
- Focused personalization Playwright run: 4 passed, 4 deliberate
  cross-project skips, 0 failed.
- `npm.cmd ci`: exit 0; 539 packages installed from the lockfile.
- `npm.cmd run check`: exit 0. ESLint and both TypeScript projects passed;
  Vitest passed 31 files and 118 tests; the production/PWA build generated all
  assets. Vite retained only the known informational chunk-size warning above
  500 kB.
- `npm.cmd run security:scan`: exit 0; tracked files and `dist` contain no
  secret values.
- `npm.cmd run test:e2e`: 6 passed, 14 expected skips, 0 failed. The skips are
  2 local-Supabase lifecycle cases without `E2E_LOCAL_SUPABASE`, 8 opt-in
  screenshot captures without `CAPTURE_SCREENSHOTS`, and 4 deliberate
  cross-project branches in the responsive personalization suite.

## Accessibility follow-up manual verification

A temporary, untracked local review harness used the real Dialog, Toast, and
theme CSS modules and was removed immediately after inspection. No screenshot
baseline changed because the committed screenshots contain no visible focused
control.

- Desktop Dark and Light: both focus-ring colors were visibly distinct;
  computed outlines were `#75aaff` and `#2859a6`, each 3 px with a 3 px offset.
- Desktop modal/Toast: the Toast status remained visible and exposed as a
  labelled status. Pointer activation of its action left the action count at
  zero and focus inside the critical dialog. Tab and Shift+Tab wrapped from
  last to first and first to last. Escape left the critical dialog open.
- Closing the modal restored focus to its opener; the same Toast action then
  executed once and dismissed normally. Root and body scroll locks were active
  only while the modal was open.
- The dismissible desktop dialog retained its labelled close control and
  Escape policy.
- Mobile at 390 x 844: the critical dialog rendered as a bottom sheet with
  safe-area action spacing. Its simultaneous Toast remained visible, its action
  stayed blocked, and focus remained inside. The document width and scroll
  width were both 390 px, so no horizontal overflow occurred.
- The existing Dark expanded-sidebar, Light collapsed-sidebar, mobile tab-bar,
  and Settings screenshots were inspected and remain current.

## Independent review follow-up RED evidence

The first independent review found that closing the underlying dialog before
the top dialog discarded the only still-connected focus restoration target.
The stacked-dialog regression was strengthened to open dialog one from an
outside button, open dialog two from dialog one, remove dialog one, then close
dialog two without manually focusing the opener.

- Command: `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx`.
- RED result: 1 failed, 8 passed. After the final dialog closed, focus was on
  `body` instead of the original `Ersten Dialog öffnen` button. This confirms
  the review finding and shows the old test's manual `outside.focus()` masked
  the broken restoration chain.

### Independent review follow-up GREEN evidence

Each modal-stack entry now retains its immediate focus target together with
the restoration chain of the dialog below it. Removing the lower dialog no
longer destroys the original outside opener. Closing the top dialog first
restores focus only to a connected target inside the remaining dialog; closing
the last dialog selects the first still-connected target in the full chain.

- Command: `npm.cmd test -- src/design-system/ResponsiveDialog.test.tsx
  src/design-system/ResponsiveDialog.ssr.test.tsx
  src/design-system/ToastProvider.test.tsx`.
- GREEN result: 3 files passed, 19 tests passed.
- The Toast regression now independently proves that capture-phase
  `pointerdown` is cancelled before a target listener runs, in addition to the
  separate click/action assertion.
- A second stacked-dialog path now closes the top dialog first, verifies focus
  returns to its opener inside the underlying dialog while scroll lock remains,
  then verifies the original outside opener and scroll styles after the final
  close.

### Post-review full verification

- `npm.cmd run check`: exit 0. ESLint passed with zero warnings, both
  TypeScript projects passed, Vitest passed 31 files and 119 tests, and the
  production/PWA build completed. The known informational chunk-size warning
  above 500 kB remains.
- `npm.cmd run security:scan`: exit 0; tracked files and `dist` contain no
  secret values.
- `npm.cmd run test:e2e`: 6 passed, 14 expected skips, 0 failed, with the same
  documented local-Supabase, screenshot-gate, and cross-project skip reasons.

## Accessibility follow-up independent review

Three fresh read-only reviews examined the complete working diff from
`5a4f3e4e72ffa26baea5e999c352a979fc35f4db`: the main accessibility review,
test-quality review, and security/scope audit all report zero Critical and zero
Important findings after the restoration-chain follow-up. The main review and
scope audit report no Minor findings and consider the change ready. The
test-quality review also considers it ready and records these non-blocking
coverage notes for later work:

- Two older scroll-lock test paths could make failure cleanup more defensive by
  explicitly unmounting before restoring synthetic inline styles.
- Listener cleanup is proven behaviorally after close, but the tests do not spy
  directly on document-level `removeEventListener` calls.
- The contrast matrix enumerates the four opaque adjacent surfaces; translucent
  and status-soft composites are not explicitly calculated even though the
  current focus colors have ample measured reserve.
