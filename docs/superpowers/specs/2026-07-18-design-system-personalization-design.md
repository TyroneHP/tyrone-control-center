# Design System Personalization – Design Specification

**Status:** Approved for implementation planning

**Date:** 2026-07-18

**Repository:** `TyroneHP/tyrone-control-center`

**Base commit:** `1b607c3f31db58b4599de57f02a47f335411f1e6`
**Milestone:** Design-system and responsive-navigation personalization

## 1. Goal

Extend the existing CoreGrid Foundation with reusable, accessible
UI foundations while preserving the confirmed compact Navy/Slate design and all
existing behavior. The milestone adds:

- explicit Dark and Light modes;
- a persistent, collapsible desktop sidebar;
- a persistent, configurable five-position mobile tab bar;
- a complete mobile “Mehr” menu as a bottom sheet;
- reusable responsive dialog and toast primitives;
- restrained iOS-like motion and stronger semantic design tokens;
- personal settings for every authenticated user, without exposing
  administrator-only account management.

Calendar, tasks, training, nutrition, files, AI, and dashboard content remain
disabled placeholders. This milestone does not add business functionality to
those modules.

## 2. Non-goals and invariants

The implementation must not:

- redesign the application with purple or unrelated visual language;
- increase the current compact information density without a functional need;
- implement calendar, task, training, nutrition, file, AI, dashboard, ranking,
  group, notification, Capacitor, or SwiftUI features;
- add a Supabase migration, Edge Function, remote deployment, or secret;
- change authentication, RLS, invitation, role, account-capacity, or cleanup
  behavior;
- change the database-owned ten-account limit or its “2 von 10” presentation;
- add a large UI, animation, drag-and-drop, or state-management dependency;
- remove existing German copy or working account/session actions.

The existing GitHub Pages base path, SPA fallback, PWA shell, protected routes,
and offline app-shell behavior remain intact.

## 3. Architectural approach

Use small typed React providers backed by a replaceable device-preference
repository. Do not scatter direct `localStorage` access through UI components.
The repository is the single browser-storage boundary; React components consume
typed state and update functions.

The main layers are:

1. **Device preference repository** – parses, sanitizes, defaults, and persists
   versioned device-local preferences.
2. **Preference provider** – owns the live React state and applies the theme to
   the document root.
3. **Central navigation catalog** – owns stable destination IDs, routes, labels,
   icons, and mobile-pinning eligibility.
4. **Responsive App Shell** – derives visible desktop/mobile navigation from
   preferences and responsive state.
5. **Design-system providers** – expose responsive dialog and toast APIs.
6. **Settings composition** – presents personal settings to every active user
   and mounts account management only for active administrators.

No visual component performs direct Supabase operations. Existing Settings API
and Auth API calls stay behind their current feature boundaries.

## 4. Device preferences

### 4.1 Schema

Use a versioned device-local value under one stable key such as
`tcc.device-preferences.v1`:

```ts
interface DevicePreferences {
  theme: 'dark' | 'light'
  desktopSidebar: 'expanded' | 'collapsed'
  mobileTabs: readonly [NavigationId, NavigationId, NavigationId]
}
```

Defaults:

- `theme`: `dark`;
- `desktopSidebar`: `expanded`;
- `mobileTabs`: `calendar`, `tasks`, `training`.

The storage adapter exposes typed `read()` and `write()` operations and may be
replaced later by a Capacitor-backed adapter. No Capacitor code is added now.

### 4.2 Validation and recovery

Reading preferences must:

- catch unavailable storage, invalid JSON, and unsupported object shapes;
- accept only `dark` or `light` as theme values;
- accept only `expanded` or `collapsed` as manual desktop choices;
- remove unknown, non-pinnable, overview, more, and duplicate mobile IDs;
- preserve the order of the remaining valid IDs;
- fill missing positions from the default pinnable destinations without
  creating duplicates;
- return a complete valid preference object in every case.

If storage writes fail, the live UI continues with the selected value for the
current session and shows a neutral warning toast explaining that the setting
may not persist on this device.

### 4.3 Theme bootstrap

Dark mode is the default for first load and invalid stored values. A minimal
inline bootstrap in `index.html` reads only the versioned theme value, validates
it, and sets `data-theme="dark|light"` on `<html>` before React and styles mount.
It catches all storage and parsing errors. The React provider reapplies the
sanitized value after mount. Tests keep the inline storage key and accepted
values aligned with the typed repository.

## 5. Semantic visual system

### 5.1 Theme tokens

`tokens.css` defines semantic tokens under `:root` / `[data-theme="dark"]` and
`[data-theme="light"]`. Required roles include:

- app background and background accent;
- sidebar/glass surface;
- normal, elevated, and soft surfaces;
- primary and primary-hover;
- text and muted text;
- border and focus ring;
- success, warning, danger/error, and their soft surfaces;
- overlay, glass blur, and soft shadow;
- large-card, control, sheet, and pill radii;
- fast and normal motion durations and easing.

Dark mode keeps the current `#071526` Navy base and established blue accent.
Light mode uses cool white and pale Slate-blue surfaces with the same blue
identity. Success stays green; warning stays amber; destructive/error states
stay red or rose. Component CSS consumes semantic variables instead of direct
theme-specific colors.

### 5.2 Shape, depth, and density

- Major cards use roughly 20–24 px radii.
- Controls and smaller cards use roughly 14–18 px radii.
- Mobile navigation and sheets use soft, larger rounding.
- Content cards remain predominantly opaque.
- Blur is limited to sidebar, mobile tab bar, overlays, sheets, dialogs, and
  pop-ups.
- Shadows remain subtle in Dark mode and slightly clearer in Light mode.
- Existing type scale, content density, and main layout widths remain compact.

## 6. Central navigation model

Each real destination has one stable ID and one catalog entry containing:

- German label;
- route;
- Lucide icon;
- whether it may occupy a configurable mobile slot.

The destinations remain:

1. Übersicht
2. Kalender
3. Aufgaben
4. Technikerarbeit
5. Schule
6. Training
7. Ernährung
8. Dateien
9. KI-Chat
10. Einstellungen

“Übersicht” is fixed separately as the first mobile tab. “Mehr” is a navigation
control, not a destination, and is fixed as the fifth tab. All destinations
except Übersicht are eligible for the three configurable positions. Mehr is
never offered as a choice. Desktop navigation, configured mobile tabs, the Mehr
sheet, and Settings choices all derive from this single catalog.

## 7. Desktop navigation

### 7.1 Manual states

At wide desktop sizes the fixed sidebar supports:

- **expanded:** brand, icons, and labels;
- **collapsed:** brand mark and icons only.

A labelled button switches state. The manual selection is stored per device.
Collapsed links retain accessible names and expose concise German tooltips. The
tooltip is supplementary; no important action depends on hover.

### 7.2 Responsive override

Layout ranges are explicit:

- mobile: below 768 px, desktop sidebar hidden;
- compact desktop/tablet: 768–1099 px, sidebar forced to icon-only;
- wide desktop: 1100 px and above, manual preference applies.

The responsive override does not overwrite the stored manual preference. When
the viewport returns to wide desktop, the prior manual choice returns. The
provider initializes before the shell chooses its manual state, and CSS owns
the compact geometry, avoiding uncontrolled width jumps.

## 8. Mobile navigation

The mobile bar renders exactly five labelled positions:

1. Übersicht;
2. configured destination 1;
3. configured destination 2;
4. configured destination 3;
5. Mehr.

Every position always shows both icon and German label. The bar includes iPhone
bottom safe-area padding and does not create horizontal page overflow.

### 8.1 Mehr bottom sheet

Mehr opens a non-critical responsive bottom sheet containing all ten
destinations, including Übersicht and destinations already pinned in the tab
bar. Navigating closes the sheet. Escape, backdrop click, the close control,
and a downward swipe beyond a tested threshold may close it. The sheet includes
a visible drag indicator but remains fully operable without gestures.

### 8.2 Configuration UI

Personal Settings displays three ordered position rows. Each row contains:

- its position number and current icon/label;
- a native select listing eligible destinations not selected in another row;
- accessible “Nach links” and “Nach rechts” buttons where movement is possible.

The buttons reorder positions without drag-and-drop. Übersicht and Mehr are
shown as fixed endpoints in a concise preview but cannot be changed. Changes
save immediately through the preference provider.

## 9. Settings composition

The route remains `/settings`, but the page becomes a composition of focused
sections:

1. **Darstellung** – Dark-mode switch for every authenticated active user.
2. **Mobile Navigation** – three configurable, reorderable tabs for every
   authenticated active user.
3. **Sitzungen** – existing current-device and all-device sign-out behavior for
   every authenticated active user.
4. **Kontoverwaltung** – existing capacity, invitations, profiles,
   reservations, restore, and deactivate controls only for an active admin.

Members never trigger `listAccounts` and do not receive administrator controls.
Existing server-side role enforcement remains authoritative. Admin users retain
the exact capacity state and existing “2 von 10” behavior.

## 10. Responsive dialog primitive

Create a reusable portal-based `ResponsiveDialog` rather than adding a dialog
library. It accepts a title, content, actions, open state, initial-focus target,
and dismissal policy.

Desktop and larger screens render a centered modal. Mobile renders the same
content as a bottom sheet with a drag indicator. Both variants provide:

- `role="dialog"`, `aria-modal="true"`, and labelled title semantics;
- initial focus inside the dialog;
- focus containment while open;
- restoration to the opener after close;
- background interaction blocking;
- visible keyboard focus;
- restrained overlay blur and motion.

Non-critical dialogs may close by Escape, backdrop, close button, and on mobile
a downward swipe. Critical dialogs set `dismissible=false`; Escape, backdrop,
and swipe do not close them. They always offer an explicit cancel action and a
clearly labelled destructive or confirming action.

Apply the primitive to at least:

- account deactivation as a critical confirmation;
- “Auf allen Geräten abmelden” as a critical confirmation.

Current-device sign-out remains a direct, reversible session action. Neither
the dialog primitive nor its presentation changes existing Auth API or Settings
API semantics.

## 11. Toast system

An app-level `ToastProvider` exposes an imperative typed hook. Toast variants
are `success`, `warning`, `error`, and optional `neutral`. Each toast contains:

- a variant-specific icon;
- visible German text;
- an optional close control;
- an optional labelled action callback;
- status-specific styling in addition to the icon and text.

Toasts appear in a safe-area-aware stack at the top center on all breakpoints.
At most three are visible; additional messages wait in FIFO order. Default
duration is five seconds. An action toast remains actionable for its configured
duration, invokes its callback once, and then closes. Timers are centrally
cleaned up on action, manual close, automatic close, or provider unmount.

Success and neutral messages use polite live announcements. Errors use an alert
announcement; warnings use explicit icon/text and a polite status announcement
unless immediate attention is required. Color is never the sole status cue.

The system supports a future “Termin gelöscht” / “Rückgängig” flow without
implementing calendar deletion now. Irreversible account deactivation never
offers undo.

## 12. Motion and accessibility

Use only CSS transitions and keyframes already supported by the application:

- quick fades and small translations for dialogs, sheets, and toasts;
- smooth width/label transitions for the desktop sidebar;
- subtle active, hover, and pressed states for controls and navigation.

No transition should feel slow or playful. Under `prefers-reduced-motion:
reduce`, animation and transition durations become effectively immediate and
swipe behavior remains optional rather than required.

All controls must support keyboard and touch operation, minimum practical touch
targets, visible focus, accessible names, and sufficient contrast in both
themes. Important behavior must not rely solely on hover, motion, or color.

## 13. Component boundaries

Expected focused modules include:

- `src/preferences/devicePreferences.ts` – schema, defaults, sanitizer, storage;
- `src/preferences/DevicePreferencesProvider.tsx` – state and document theme;
- `src/preferences/useDevicePreferences.ts` – typed consumer hook;
- `src/features/shell/navigation.ts` – central catalog and ID helpers;
- desktop/sidebar and mobile/tab/sheet shell components;
- `src/design-system/ResponsiveDialog.tsx`;
- `src/design-system/ToastProvider.tsx` and toast types/hooks;
- personal Settings sections separated from admin account management.

Exact file splits may follow existing conventions, but no single visual
component should also own storage validation, Supabase logic, and presentation.

## 14. Error handling

- Preference read errors fall back to complete defaults without breaking render.
- Preference write errors preserve current UI state and produce a neutral toast.
- Unknown navigation IDs never render broken links.
- Duplicate mobile selections are prevented in the UI and sanitized on load.
- Dialog callbacks retain existing pending/disabled/error behavior.
- Existing invitation and account errors remain server-derived and safe.
- Toast errors never include raw internal or Supabase error details.

## 15. Test strategy

### 15.1 Unit and component tests

Tests must cover:

- default Dark mode, Light-mode switching and persistence;
- persisted theme restoration and invalid-theme fallback;
- correct document root theme attribute;
- preference write failures;
- sidebar toggle, persistence, restoration, accessible collapsed links,
  tooltips, and forced compact layout;
- fixed overview/more positions and exactly three configurable mobile tabs;
- default tabs, deduplication, invalid-value repair, icons, labels, and
  persistence;
- complete Mehr sheet contents, including pinned destinations;
- member access to personal settings without account API access;
- admin-only account management and unchanged capacity behavior;
- theme switch and selection/reordering controls;
- desktop dialog semantics, mobile sheet structure, focus handling, Escape,
  backdrop, swipe, and critical dismissal protection;
- confirmation before account deactivation and all-device sign-out;
- toast icons/text, placement, ARIA live behavior, fake-timer removal, manual
  close, queueing, and optional action execution.

Every behavior change follows red-green-refactor TDD. Tests must fail for the
expected missing behavior before production code is added.

### 15.2 Playwright

Extend the existing preview-session approach without real accounts or remote
requests. Playwright covers:

- wide desktop expanded and collapsed navigation;
- compact desktop/tablet forced sidebar state;
- iPhone WebKit five-position tab bar and complete Mehr sheet;
- Dark/Light switching and reload persistence;
- tab selection and button-based reordering;
- Settings visibility for member and admin preview profiles;
- no horizontal overflow on mobile;
- reduced-motion behavior;
- unchanged protected-route and German navigation behavior.

Authentication lifecycle tests remain opt-in through their existing local
Supabase flag. Screenshot tests generate Dark/Light desktop expanded/collapsed,
mobile tab-bar, and Settings images for the Draft PR.

## 16. Acceptance criteria

The milestone is complete when:

- both themes meet the confirmed visual direction and are device-local;
- first load is Dark and avoids a visible wrong-theme flash;
- desktop and mobile navigation meet every fixed/configurable rule;
- Settings personal controls work for members and admins while admin account
  controls remain admin-only;
- the reusable dialog and toast primitives meet accessibility and responsive
  behavior requirements;
- existing account/session behavior and ten-account capacity are unchanged;
- all required unit, build, security, and Playwright checks pass or documented
  opt-in tests are explicitly reported as skipped;
- no migrations, Edge Functions, secrets, deployments, or out-of-scope modules
  are changed;
- a Draft PR contains the required screenshots, tests, limitations, and scope
  confirmations.
