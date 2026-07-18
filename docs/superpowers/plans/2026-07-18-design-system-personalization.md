# Design System Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Navy/Slate Foundation with device-local Dark/Light theming, personalized responsive navigation, reusable dialog/toast primitives, and accessible personal Settings without changing Supabase or account-capacity behavior.

**Architecture:** A typed device-preference repository and provider own all browser persistence. A single navigation catalog feeds desktop, mobile, More, and Settings views, while app-level dialog and toast primitives provide reusable UI infrastructure. Existing Auth and Settings APIs remain unchanged and administrator-only account management is split from personal device settings at the component boundary.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5, CSS custom properties/transitions, Lucide React, Vitest, React Testing Library, Playwright, Vite 8, npm, Node.js 22.12.0 or newer.

## Global Constraints

- Work only on `feature/design-system-personalization`, based on `1b607c3f31db58b4599de57f02a47f335411f1e6`.
- Use React and strict TypeScript; visible copy remains German and code/commit messages remain English.
- Preserve the existing Navy/Slate visual language, bright blue accent, compact density, routes, PWA behavior, and ten-account capacity.
- Do not add a UI, animation, drag-and-drop, or state-management dependency.
- Do not add or modify Supabase migrations, database schema, Edge Functions, RLS, account limits, secrets, or remote deployment state.
- Do not implement functional calendar, task, training, nutrition, file, AI, dashboard, ranking, group, notification, Capacitor, or SwiftUI features.
- Keep device preferences local; never synchronize them through Supabase.
- Use semantic tokens, accessible contrast, keyboard operation, visible focus, ARIA names, safe areas, and `prefers-reduced-motion`.
- Follow strict red-green-refactor TDD: test first, observe the expected failure, implement the minimum, rerun, then commit.
- Preserve the GitHub Pages production base path `/tyrone-control-center/` and never commit secret values.

## File Structure

### New preference modules

- `src/preferences/devicePreferences.ts` – schema, defaults, validation, storage adapter.
- `src/preferences/devicePreferences.test.ts` – sanitization and storage tests.
- `src/preferences/DevicePreferencesProvider.tsx` – React state and update operations.
- `src/preferences/DevicePreferencesProvider.test.tsx` – provider and document-theme behavior.
- `src/preferences/useDevicePreferences.ts` – strict consumer hook.
- `src/preferences/ThemeSwitch.tsx` – reusable accessible Dark-mode switch.

### New design-system modules

- `src/design-system/ResponsiveDialog.tsx` – portal, focus management, critical dismissal policy, responsive sheet mode.
- `src/design-system/ResponsiveDialog.test.tsx` – dialog/sheet/focus/dismissal tests.
- `src/design-system/ToastProvider.tsx` – typed toast queue, timers, live regions, actions.
- `src/design-system/ToastProvider.test.tsx` – variants, queue, timer, action, and ARIA tests.

### Shell decomposition

- `src/features/shell/NavigationLink.tsx` – shared route link with accessible collapsed mode.
- `src/features/shell/DesktopSidebar.tsx` – wide/manual and compact/forced desktop states.
- `src/features/shell/MobileNavigation.tsx` – five tabs and complete More sheet.
- `src/features/shell/useMediaQuery.ts` – reactive media-query adapter.
- `src/features/shell/useMediaQuery.test.tsx` – media listener behavior.
- `src/features/shell/navigation.ts` – stable typed navigation catalog.
- `src/features/shell/AppShell.tsx` – composition only.
- `src/features/shell/AppShell.test.tsx` – integrated desktop/mobile navigation behavior.

### Settings decomposition

- `src/features/settings/PersonalSettings.tsx` – appearance and mobile tab controls.
- `src/features/settings/SessionSettings.tsx` – current/all-device session controls and all-device confirmation.
- `src/features/settings/AdminAccountManagement.tsx` – existing admin capacity/invitation/profile UI and deactivation confirmation.
- `src/features/settings/SettingsPage.tsx` – role-aware composition only.
- `src/features/settings/SettingsPage.test.tsx` – personal/admin visibility and existing behavior.

### Integration, tests, and documentation

- `src/app/App.tsx` and `src/app/App.test.tsx` – app provider composition.
- `src/design-system/tokens.css`, `src/design-system/styles.css`, feature CSS files – semantic themes and responsive motion.
- `index.html` and `scripts/theme-bootstrap.test.mjs` – pre-React theme bootstrap.
- `tests/e2e/previewSession.ts` – local preview authentication/network stubs.
- `tests/e2e/personalization.spec.ts` – responsive personalization checks.
- `tests/e2e/screenshots.spec.ts` – PR screenshots.
- `README.md` and `scripts/foundation-docs.test.mjs` – user-facing behavior and milestone boundary.

---

### Task 1: Typed navigation and device-preference foundations

**Files:**
- Modify: `src/features/shell/navigation.ts`
- Create: `src/features/shell/navigation.test.ts`
- Create: `src/preferences/devicePreferences.ts`
- Create: `src/preferences/devicePreferences.test.ts`

**Interfaces:**
- Produces: `NavigationId`, `PinnableNavigationId`, `navigationItems`, `navigationById`, `defaultMobileTabs`, `isPinnableNavigationId`.
- Produces: `ThemePreference`, `DesktopSidebarPreference`, `DevicePreferences`, `DEFAULT_DEVICE_PREFERENCES`, `DEVICE_PREFERENCES_KEY`, `sanitizeDevicePreferences`, `DevicePreferenceStorage`, `createDevicePreferenceStorage`.
- Consumes: existing Lucide icons and route/label definitions.

- [ ] **Step 1: Write failing navigation-catalog tests**

Create `src/features/shell/navigation.test.ts`:

```ts
import {
  defaultMobileTabs,
  isPinnableNavigationId,
  navigationById,
  navigationItems,
} from './navigation'

describe('navigation catalog', () => {
  it('owns ten unique German destinations with stable IDs', () => {
    expect(navigationItems).toHaveLength(10)
    expect(new Set(navigationItems.map((item) => item.id))).toHaveProperty(
      'size',
      10,
    )
    expect(navigationById.get('overview')).toMatchObject({
      label: 'Übersicht',
      path: '/',
    })
    expect(navigationById.get('settings')?.label).toBe('Einstellungen')
  })

  it('defines three distinct defaults and rejects fixed controls', () => {
    expect(defaultMobileTabs).toEqual(['calendar', 'tasks', 'training'])
    expect(new Set(defaultMobileTabs).size).toBe(3)
    expect(isPinnableNavigationId('overview')).toBe(false)
    expect(isPinnableNavigationId('more')).toBe(false)
    expect(isPinnableNavigationId('settings')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the navigation test and confirm RED**

Run: `npm test -- src/features/shell/navigation.test.ts`

Expected: FAIL because `defaultMobileTabs`, `navigationById`, and `isPinnableNavigationId` are not exported.

- [ ] **Step 3: Add stable IDs without changing routes or labels**

Update `src/features/shell/navigation.ts` to expose this contract while retaining every current route and icon:

```ts
export type NavigationId =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'technician'
  | 'school'
  | 'training'
  | 'nutrition'
  | 'files'
  | 'ai'
  | 'settings'

export type PinnableNavigationId = Exclude<NavigationId, 'overview'>

export interface NavigationItem {
  id: NavigationId
  icon: LucideIcon
  label: string
  mobilePrimary: boolean
  path: string
  pinnableOnMobile: boolean
}

export const defaultMobileTabs = [
  'calendar',
  'tasks',
  'training',
] as const satisfies readonly PinnableNavigationId[]

export const navigationById = new Map(
  navigationItems.map((item) => [item.id, item] as const),
)

export function isPinnableNavigationId(
  value: unknown,
): value is PinnableNavigationId {
  return (
    typeof value === 'string' &&
    navigationItems.some(
      (item) => item.id === value && item.pinnableOnMobile,
    )
  )
}
```

Set `pinnableOnMobile: false` only for `overview`; set it to `true` for the other nine destinations. Retain the existing `mobilePrimary` property temporarily so the current AppShell remains type-safe, then remove it after every consumer moves to stable IDs in Task 5.

- [ ] **Step 4: Run the navigation test and confirm GREEN**

Run: `npm test -- src/features/shell/navigation.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Write failing device-preference tests**

Create `src/preferences/devicePreferences.test.ts`:

```ts
import {
  createDevicePreferenceStorage,
  DEFAULT_DEVICE_PREFERENCES,
  DEVICE_PREFERENCES_KEY,
  sanitizeDevicePreferences,
} from './devicePreferences'

describe('device preferences', () => {
  it('uses Dark mode and the confirmed navigation defaults', () => {
    expect(sanitizeDevicePreferences(undefined)).toEqual(
      DEFAULT_DEVICE_PREFERENCES,
    )
    expect(DEFAULT_DEVICE_PREFERENCES).toEqual({
      desktopSidebar: 'expanded',
      mobileTabs: ['calendar', 'tasks', 'training'],
      theme: 'dark',
    })
  })

  it('repairs invalid and duplicate mobile destinations in stable order', () => {
    expect(
      sanitizeDevicePreferences({
        desktopSidebar: 'wide',
        mobileTabs: ['files', 'files', 'overview', 'obsolete'],
        theme: 'system',
      }),
    ).toEqual({
      desktopSidebar: 'expanded',
      mobileTabs: ['files', 'calendar', 'tasks'],
      theme: 'dark',
    })
  })

  it('reads sanitized values and reports storage write failures', () => {
    const values = new Map<string, string>()
    values.set(
      DEVICE_PREFERENCES_KEY,
      JSON.stringify({
        desktopSidebar: 'collapsed',
        mobileTabs: ['settings', 'nutrition', 'ai'],
        theme: 'light',
      }),
    )
    const storage = createDevicePreferenceStorage({
      getItem: (key) => values.get(key) ?? null,
      setItem: () => {
        throw new DOMException('blocked')
      },
    })

    expect(storage.read()).toEqual({
      desktopSidebar: 'collapsed',
      mobileTabs: ['settings', 'nutrition', 'ai'],
      theme: 'light',
    })
    expect(storage.write(DEFAULT_DEVICE_PREFERENCES)).toBe(false)
  })
})
```

- [ ] **Step 6: Run the preference test and confirm RED**

Run: `npm test -- src/preferences/devicePreferences.test.ts`

Expected: FAIL because `src/preferences/devicePreferences.ts` does not exist.

- [ ] **Step 7: Implement the minimal typed repository**

Create `src/preferences/devicePreferences.ts` with this public contract and deterministic fill behavior:

```ts
import {
  defaultMobileTabs,
  isPinnableNavigationId,
  navigationItems,
  type PinnableNavigationId,
} from '../features/shell/navigation'

export const DEVICE_PREFERENCES_KEY = 'tcc.device-preferences.v1'

export type ThemePreference = 'dark' | 'light'
export type DesktopSidebarPreference = 'expanded' | 'collapsed'

export interface DevicePreferences {
  desktopSidebar: DesktopSidebarPreference
  mobileTabs: readonly [
    PinnableNavigationId,
    PinnableNavigationId,
    PinnableNavigationId,
  ]
  theme: ThemePreference
}

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  desktopSidebar: 'expanded',
  mobileTabs: [...defaultMobileTabs],
  theme: 'dark',
}

export interface DevicePreferenceStorage {
  read: () => DevicePreferences
  write: (preferences: DevicePreferences) => boolean
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function sanitizeDevicePreferences(value: unknown): DevicePreferences {
  const record =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const requested = Array.isArray(record.mobileTabs) ? record.mobileTabs : []
  const mobileTabs: PinnableNavigationId[] = []

  for (const candidate of requested) {
    if (
      isPinnableNavigationId(candidate) &&
      !mobileTabs.includes(candidate)
    ) {
      mobileTabs.push(candidate)
    }
  }
  for (const item of navigationItems) {
    if (
      mobileTabs.length < 3 &&
      isPinnableNavigationId(item.id) &&
      !mobileTabs.includes(item.id)
    ) {
      mobileTabs.push(item.id)
    }
  }

  return {
    desktopSidebar:
      record.desktopSidebar === 'collapsed' ? 'collapsed' : 'expanded',
    mobileTabs: mobileTabs.slice(0, 3) as DevicePreferences['mobileTabs'],
    theme: record.theme === 'light' ? 'light' : 'dark',
  }
}

export function createDevicePreferenceStorage(
  storage: StorageLike,
): DevicePreferenceStorage {
  return {
    read() {
      try {
        const raw = storage.getItem(DEVICE_PREFERENCES_KEY)
        return sanitizeDevicePreferences(raw ? JSON.parse(raw) : undefined)
      } catch {
        return DEFAULT_DEVICE_PREFERENCES
      }
    },
    write(preferences) {
      try {
        storage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences))
        return true
      } catch {
        return false
      }
    },
  }
}
```

- [ ] **Step 8: Run both Task 1 test files**

Run: `npm test -- src/features/shell/navigation.test.ts src/preferences/devicePreferences.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/features/shell/navigation.ts src/features/shell/navigation.test.ts src/preferences/devicePreferences.ts src/preferences/devicePreferences.test.ts
git commit -m "test/design: add device preference foundations"
```

---

### Task 2: Dark/Light provider, switch, bootstrap, and semantic tokens

**Files:**
- Create: `src/preferences/DevicePreferencesProvider.tsx`
- Create: `src/preferences/DevicePreferencesProvider.test.tsx`
- Create: `src/preferences/useDevicePreferences.ts`
- Create: `src/preferences/ThemeSwitch.tsx`
- Create: `scripts/theme-bootstrap.test.mjs`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `index.html`
- Modify: `src/design-system/tokens.css`
- Modify: `src/design-system/styles.css`
- Modify: `src/features/auth/auth.css`
- Modify: `src/features/settings/settings.css`
- Modify: `src/features/shell/AppShell.css`
- Modify: `src/routes/routes.css`
- Modify: `src/pwa/reloadPrompt.css`

**Interfaces:**
- Consumes: `DevicePreferenceStorage`, `DevicePreferences`, and defaults from Task 1.
- Produces: `DevicePreferencesProvider`, `useDevicePreferences`, `ThemeSwitch`.
- Produces context operations: `setTheme`, `toggleDesktopSidebar`, `setMobileTab`, `moveMobileTab`.
- Produces optional provider callback: `onPersistenceError(): void`.

- [ ] **Step 1: Write failing provider and ThemeSwitch tests**

Create `src/preferences/DevicePreferencesProvider.test.tsx` covering default, persisted Light mode, root attribute, persistence, invalid fallback, duplicate prevention, movement, and write failure:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { DevicePreferenceStorage } from './devicePreferences'
import { DevicePreferencesProvider } from './DevicePreferencesProvider'
import { ThemeSwitch } from './ThemeSwitch'
import { useDevicePreferences } from './useDevicePreferences'

function Probe() {
  const preferences = useDevicePreferences()
  return <output>{JSON.stringify(preferences.mobileTabs)}</output>
}

function storage(theme: 'dark' | 'light' = 'dark'): DevicePreferenceStorage {
  return {
    read: vi.fn(() => ({
      desktopSidebar: 'expanded',
      mobileTabs: ['calendar', 'tasks', 'training'],
      theme,
    })),
    write: vi.fn(() => true),
  }
}

describe('DevicePreferencesProvider', () => {
  it('starts Dark, switches to Light, persists, and updates the root', async () => {
    const deviceStorage = storage()
    render(
      <DevicePreferencesProvider storage={deviceStorage}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )

    const toggle = screen.getByRole('switch', { name: 'Dunkelmodus' })
    expect(toggle).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await userEvent.click(toggle)

    expect(toggle).not.toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(deviceStorage.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: 'light' }),
    )
  })

  it('restores a stored Light selection', () => {
    render(
      <DevicePreferencesProvider storage={storage('light')}>
        <ThemeSwitch />
      </DevicePreferencesProvider>,
    )
    expect(screen.getByRole('switch', { name: 'Dunkelmodus' })).not.toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('reports failed persistence without losing live state', async () => {
    const onPersistenceError = vi.fn()
    const deviceStorage = storage()
    vi.mocked(deviceStorage.write).mockReturnValue(false)
    render(
      <DevicePreferencesProvider
        onPersistenceError={onPersistenceError}
        storage={deviceStorage}
      >
        <ThemeSwitch />
        <Probe />
      </DevicePreferencesProvider>,
    )

    await userEvent.click(screen.getByRole('switch', { name: 'Dunkelmodus' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(onPersistenceError).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run provider tests and confirm RED**

Run: `npm test -- src/preferences/DevicePreferencesProvider.test.tsx`

Expected: FAIL because provider, hook, and switch modules do not exist.

- [ ] **Step 3: Implement context, provider, and switch**

Implement a strict context with this value shape:

```ts
export interface DevicePreferencesContextValue extends DevicePreferences {
  moveMobileTab: (index: 0 | 1 | 2, direction: -1 | 1) => void
  setMobileTab: (index: 0 | 1 | 2, id: PinnableNavigationId) => void
  setTheme: (theme: ThemePreference) => void
  toggleDesktopSidebar: () => void
}
```

`DevicePreferencesProvider` must initialize synchronously with `storage.read()`,
apply `document.documentElement.dataset.theme` in a layout effect, update live
state before calling `storage.write`, reject a duplicate `setMobileTab`, bound
movement to indices 0–2, and call `onPersistenceError` once per failed update.

Create `ThemeSwitch.tsx` with an explicit German label and native checkbox
semantics:

```tsx
export function ThemeSwitch() {
  const { setTheme, theme } = useDevicePreferences()
  return (
    <label className="theme-switch">
      <span>
        <strong>Dunkelmodus</strong>
        <small>Auf diesem Gerät gespeichert</small>
      </span>
      <input
        aria-label="Dunkelmodus"
        checked={theme === 'dark'}
        onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="theme-switch__track" />
    </label>
  )
}
```

Wrap the existing app providers in `DevicePreferencesProvider` using a browser
adapter created from `window.localStorage`. Tests pass an explicit adapter.

- [ ] **Step 4: Write and run a failing pre-mount bootstrap test**

Create `scripts/theme-bootstrap.test.mjs` using `readFileSync` and Vitest. Assert
that `index.html` references `tcc.device-preferences.v1`, validates only `light`
and `dark`, assigns `document.documentElement.dataset.theme`, catches parse
errors, and appears before `/src/main.tsx`.

Run: `npm test -- scripts/theme-bootstrap.test.mjs`

Expected: FAIL because no preference-theme bootstrap exists.

- [ ] **Step 5: Add the guarded bootstrap before the React entry**

Add this logic before the root element in `index.html`, preserving the existing
GitHub Pages route restoration:

```html
<script>
  ;(function applyStoredTheme() {
    var theme = 'dark'
    try {
      var raw = window.localStorage.getItem('tcc.device-preferences.v1')
      var stored = raw ? JSON.parse(raw).theme : null
      if (stored === 'light' || stored === 'dark') theme = stored
    } catch (_) {
      theme = 'dark'
    }
    document.documentElement.dataset.theme = theme
  })()
</script>
```

- [ ] **Step 6: Replace theme-specific literals with semantic tokens**

Define the Dark contract under `:root, [data-theme='dark']` and Light overrides
under `[data-theme='light']`:

```css
:root,
[data-theme='dark'] {
  color-scheme: dark;
  --color-bg: #071526;
  --color-bg-accent: rgba(50, 106, 193, 0.15);
  --color-bg-elevated: #0c2545;
  --color-surface: #122d4f;
  --color-surface-soft: #193458;
  --color-glass: rgba(7, 21, 38, 0.94);
  --color-input: rgba(7, 21, 38, 0.72);
  --color-primary: #326ac1;
  --color-primary-hover: #3f7bd6;
  --color-primary-soft: rgba(50, 106, 193, 0.16);
  --color-text: #f4f7fb;
  --color-text-muted: #a9b6c6;
  --color-border: rgba(169, 182, 198, 0.16);
  --color-success: #5bd0a4;
  --color-success-soft: rgba(91, 208, 164, 0.12);
  --color-warning: #f2bd5a;
  --color-warning-soft: rgba(242, 189, 90, 0.12);
  --color-danger: #f17b8c;
  --color-danger-soft: rgba(241, 123, 140, 0.12);
  --color-overlay: rgba(2, 10, 22, 0.78);
  --shadow-soft: 0 18px 44px rgba(0, 8, 20, 0.2);
  --shadow-overlay: 0 24px 70px rgba(0, 0, 0, 0.45);
}

[data-theme='light'] {
  color-scheme: light;
  --color-bg: #f3f7fc;
  --color-bg-accent: rgba(50, 106, 193, 0.09);
  --color-bg-elevated: #ffffff;
  --color-surface: #ffffff;
  --color-surface-soft: #e8f0fa;
  --color-glass: rgba(246, 249, 253, 0.94);
  --color-input: #ffffff;
  --color-primary: #326ac1;
  --color-primary-hover: #2859a6;
  --color-primary-soft: rgba(50, 106, 193, 0.11);
  --color-text: #10243c;
  --color-text-muted: #53677d;
  --color-border: rgba(33, 70, 112, 0.16);
  --color-success: #147a5a;
  --color-success-soft: rgba(20, 122, 90, 0.1);
  --color-warning: #956000;
  --color-warning-soft: rgba(149, 96, 0, 0.1);
  --color-danger: #b8334a;
  --color-danger-soft: rgba(184, 51, 74, 0.1);
  --color-overlay: rgba(24, 42, 66, 0.32);
  --shadow-soft: 0 18px 44px rgba(36, 65, 98, 0.14);
  --shadow-overlay: 0 24px 70px rgba(36, 65, 98, 0.2);
}
```

Also define `--radius-card: 22px`, `--radius-control: 16px`,
`--radius-sheet: 24px`, `--motion-fast: 140ms`, `--motion-normal: 220ms`,
and `--motion-ease: cubic-bezier(0.2, 0.8, 0.2, 1)`. Replace direct
theme-specific colors in all listed CSS files with these semantic tokens while
preserving layouts and content density.

- [ ] **Step 7: Run focused and full tests**

Run:

```bash
npm test -- src/preferences/DevicePreferencesProvider.test.tsx scripts/theme-bootstrap.test.mjs src/design-system/design-system.test.tsx src/app/App.test.tsx
npm run typecheck
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit Task 2**

```bash
git add index.html scripts/theme-bootstrap.test.mjs src/app src/preferences src/design-system src/features/auth/auth.css src/features/settings/settings.css src/features/shell/AppShell.css src/routes/routes.css src/pwa/reloadPrompt.css
git commit -m "feat/design: add dark and light theme tokens"
```

---

### Task 3: Reusable responsive dialog and focus management

**Files:**
- Create: `src/features/shell/useMediaQuery.ts`
- Create: `src/features/shell/useMediaQuery.test.tsx`
- Create: `src/design-system/ResponsiveDialog.tsx`
- Create: `src/design-system/ResponsiveDialog.test.tsx`
- Modify: `src/design-system/index.ts`
- Modify: `src/design-system/styles.css`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`.
- Produces: `ResponsiveDialogProps` with `open`, `title`, `children`, `actions`, `dismissible`, `onClose`, and optional `initialFocusRef`.
- Uses: mobile breakpoint `(max-width: 767px)` and no third-party dialog package.

- [ ] **Step 1: Write failing media-query tests**

Create a hook test that installs a controlled `window.matchMedia`, renders a
probe, changes `matches`, dispatches the registered listener, and expects the
probe to update from `false` to `true`.

Run: `npm test -- src/features/shell/useMediaQuery.test.tsx`

Expected: FAIL because `useMediaQuery` does not exist.

- [ ] **Step 2: Implement the media-query hook**

Use `useSyncExternalStore` so rendering and subscription are stable:

```ts
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
```

Run the hook test and expect PASS.

- [ ] **Step 3: Write failing responsive-dialog tests**

Create tests that verify:

```tsx
it('renders labelled desktop dialog semantics and restores focus')
it('uses sheet structure and a drag handle on mobile')
it('closes a non-critical dialog with Escape and backdrop')
it('does not dismiss a critical dialog with Escape, backdrop, or swipe')
it('keeps Tab focus inside and honors the initial focus ref')
```

Use a controlled `matchMedia`, `userEvent.keyboard('{Escape}')`, pointer events
with a downward delta greater than 72 px, and assertions on the opener focus.

Run: `npm test -- src/design-system/ResponsiveDialog.test.tsx`

Expected: FAIL because `ResponsiveDialog` does not exist.

- [ ] **Step 4: Implement the portal-based primitive**

Use this API:

```ts
export interface ResponsiveDialogProps {
  actions?: ReactNode
  children: ReactNode
  dismissible?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  title: string
}
```

Implementation rules:

- render with `createPortal(..., document.body)` only while `open`;
- capture `document.activeElement` on open and restore it on cleanup;
- use a generated title ID for `aria-labelledby`;
- focus `initialFocusRef.current` or the first focusable element;
- cycle Tab/Shift+Tab through enabled buttons, links, inputs, selects, and
  textareas;
- close with Escape/backdrop only when `dismissible` is true;
- render `responsive-dialog--sheet` and a drag handle when `useMediaQuery`
  reports mobile;
- close a dismissible mobile sheet when pointer release is at least 72 px below
  pointer start;
- never invoke `onClose` from Escape, backdrop, or swipe when critical.

Add semantic overlay, centered-dialog, bottom-sheet, entering, and reduced
motion CSS. Do not add a dependency.

- [ ] **Step 5: Verify the dialog in isolation**

Run:

```bash
npm test -- src/features/shell/useMediaQuery.test.tsx src/design-system/ResponsiveDialog.test.tsx
npm run typecheck
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/features/shell/useMediaQuery.ts src/features/shell/useMediaQuery.test.tsx src/design-system/ResponsiveDialog.tsx src/design-system/ResponsiveDialog.test.tsx src/design-system/index.ts src/design-system/styles.css
git commit -m "feat/ui: add responsive dialog foundation"
```

---

### Task 4: Collapsible responsive desktop sidebar

**Files:**
- Create: `src/features/shell/NavigationLink.tsx`
- Create: `src/features/shell/DesktopSidebar.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/features/shell/AppShell.css`
- Modify: `src/features/shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: navigation catalog, `desktopSidebar`, `toggleDesktopSidebar`, and `useMediaQuery`.
- Produces: `DesktopSidebar` with effective state `forcedCompact || manualCollapsed`.
- Preserves: `aria-label="Desktop-Navigation"` and every existing destination.

- [ ] **Step 1: Replace the AppShell test with failing desktop behavior tests**

Add tests that render the provider and shell, then assert:

```tsx
it('toggles the desktop sidebar and persists the manual choice')
it('restores a stored collapsed sidebar')
it('keeps accessible names and German tooltips while collapsed')
it('forces compact mode below 1100px without overwriting manual state')
```

The compact test must change the media query from compact back to wide and
expect the previously stored expanded selection to return.

Run: `npm test -- src/features/shell/AppShell.test.tsx`

Expected: FAIL because no collapse control or effective compact state exists.

- [ ] **Step 2: Extract a shared accessible navigation link**

Create `NavigationLink.tsx` with this contract:

```tsx
export function NavigationLink({
  collapsed = false,
  item,
  onNavigate,
}: {
  collapsed?: boolean
  item: NavigationItem
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx('app-navigation__link', {
          'app-navigation__link--active': isActive,
          'app-navigation__link--collapsed': collapsed,
        })
      }
      end={item.path === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      to={item.path}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  )
}
```

- [ ] **Step 3: Implement the desktop sidebar and composition**

`DesktopSidebar` uses `(max-width: 1099px)` for forced compact mode, renders
all catalog entries, sets `data-collapsed` and `data-forced-compact`, and exposes
a button named either “Seitenleiste einklappen” or “Seitenleiste ausklappen”.
Hide the manual control while forced compact, but retain its state in the
preference provider.

Change `AppShell` to compose `DesktopSidebar`, content, and the unchanged mobile
area. CSS must use `--sidebar-width: 248px` and `--sidebar-collapsed-width: 76px`,
animate width/margin with semantic motion tokens, hide labels visually only in
effective collapsed state, and hide the sidebar entirely below 768 px.

- [ ] **Step 4: Verify desktop behavior and regressions**

Run:

```bash
npm test -- src/features/shell/AppShell.test.tsx src/routes/router.test.tsx
npm run typecheck
```

Expected: all tests PASS; existing protected routing remains green.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/features/shell/NavigationLink.tsx src/features/shell/DesktopSidebar.tsx src/features/shell/AppShell.tsx src/features/shell/AppShell.css src/features/shell/AppShell.test.tsx
git commit -m "feat/navigation: add collapsible desktop sidebar"
```

---

### Task 5: Configurable mobile tabs and complete More sheet

**Files:**
- Create: `src/features/shell/MobileNavigation.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/features/shell/AppShell.css`
- Modify: `src/features/shell/AppShell.test.tsx`
- Modify: `src/features/shell/navigation.ts`

**Interfaces:**
- Consumes: `mobileTabs`, `navigationById`, `navigationItems`, `NavigationLink`, and `ResponsiveDialog`.
- Produces: exactly five mobile positions with fixed Overview/More endpoints.
- Removes: legacy `mobilePrimary` flags after all consumers use stable IDs.

- [ ] **Step 1: Write failing five-tab and More-sheet tests**

Add focused tests:

```tsx
it('renders Overview, three defaults, and More in exactly that order')
it('renders icons and labels for all five positions')
it('uses persisted configured tabs without duplicates')
it('opens a sheet containing all ten destinations including pinned entries')
it('closes the More sheet after destination navigation')
```

Scope assertions to `navigation[name="Mobile Navigation"]`; count links plus the
More button as five direct bar controls. Assert the sheet list has ten links and
contains Übersicht, Kalender, Aufgaben, Training, and Einstellungen even when
those items are pinned.

Run: `npm test -- src/features/shell/AppShell.test.tsx`

Expected: FAIL because current mobile navigation is based on fixed legacy flags
and More omits primary items.

- [ ] **Step 2: Implement MobileNavigation**

Build the bar from:

```ts
const fixedOverview = navigationById.get('overview')!
const pinnedItems = mobileTabs.map((id) => navigationById.get(id)!)
const mobileItems = [fixedOverview, ...pinnedItems]
```

Render `mobileItems`, followed by the labelled Mehr button. Use
`ResponsiveDialog` with `title="Alle Bereiche"`, `dismissible`, and the complete
`navigationItems` list. Close on route link selection. Use the shared link
component so route semantics remain identical.

Update CSS to provide a softly rounded safe-area-aware glass bar, minimum touch
targets, label truncation without hiding names, a drag indicator supplied by the
dialog, and no horizontal overflow.

- [ ] **Step 3: Remove legacy navigation flags**

Delete `mobilePrimary` from the interface and every catalog entry. Confirm no
consumer filters independent navigation lists:

Run: `rg -n "mobilePrimary|primaryItems|moreItems" src`

Expected: no matches.

- [ ] **Step 4: Verify mobile behavior**

Run:

```bash
npm test -- src/features/shell/AppShell.test.tsx src/features/shell/navigation.test.ts
npm run typecheck
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/features/shell
git commit -m "feat/navigation: add configurable mobile tabs and more sheet"
```

---

### Task 6: App-level toast queue and persistence warning

**Files:**
- Create: `src/design-system/ToastProvider.tsx`
- Create: `src/design-system/ToastProvider.test.tsx`
- Modify: `src/design-system/index.ts`
- Modify: `src/design-system/styles.css`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `ToastVariant`, `ToastAction`, `ShowToastInput`, `ToastProvider`, `useToast`.
- Default duration: 5000 ms; maximum visible: 3; FIFO overflow.
- Consumes: `DevicePreferencesProvider.onPersistenceError` without importing toast code into the preference repository.

- [ ] **Step 1: Write failing toast behavior tests with fake timers**

Create a harness using `useToast()` and cover:

```tsx
it.each(['success', 'warning', 'error'] as const)(
  'renders %s with an icon and readable text',
)
it('places the live stack at the top center')
it('removes a toast automatically after five seconds')
it('runs an optional action exactly once and closes the toast')
it('shows no more than three and promotes queued messages FIFO')
it('supports manual close with an accessible label')
```

Use `vi.useFakeTimers()`, `act(() => vi.advanceTimersByTime(5000))`, and reset
real timers after each test. Assert error uses `role="alert"`; other variants
use labelled status semantics.

Run: `npm test -- src/design-system/ToastProvider.test.tsx`

Expected: FAIL because no toast provider exists.

- [ ] **Step 2: Implement the typed queue**

Use this public input:

```ts
export type ToastVariant = 'success' | 'warning' | 'error' | 'neutral'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ShowToastInput {
  action?: ToastAction
  duration?: number
  message: string
  variant?: ToastVariant
}

export interface ToastApi {
  dismiss: (id: string) => void
  show: (input: ShowToastInput) => string
}
```

Keep ordered toast records in the provider, derive the first three as visible,
start one timeout per visible record, and clear timeouts on every removal and
unmount. Use Lucide `CheckCircle2`, `TriangleAlert`, `CircleX`, and `Info`. The
optional action calls its callback once before dismissal.

Render the stack in a portal with `aria-label="Benachrichtigungen"`. Add top
safe-area placement, icon/text/status styling, fade/translate motion, and
reduced-motion overrides.

- [ ] **Step 3: Wire app providers and storage failure feedback**

Nest providers in this order:

```tsx
function PreferenceBoundary({ children }: PropsWithChildren) {
  const toast = useToast()
  const storage = useMemo(
    () => createDevicePreferenceStorage(window.localStorage),
    [],
  )

  return (
    <DevicePreferencesProvider
      onPersistenceError={() =>
        toast.show({
          message:
            'Die Einstellung konnte auf diesem Gerät nicht dauerhaft gespeichert werden.',
          variant: 'warning',
        })
      }
      storage={storage}
    >
      {children}
    </DevicePreferencesProvider>
  )
}

<ToastProvider>
  <PreferenceBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={authClient}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
    <ReloadPrompt />
  </PreferenceBoundary>
</ToastProvider>
```

Keep Query, Auth, Router, and ReloadPrompt behavior otherwise unchanged.

- [ ] **Step 4: Verify toast and app integration**

Run:

```bash
npm test -- src/design-system/ToastProvider.test.tsx src/app/App.test.tsx src/preferences/DevicePreferencesProvider.test.tsx
npm run typecheck
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/design-system/ToastProvider.tsx src/design-system/ToastProvider.test.tsx src/design-system/index.ts src/design-system/styles.css src/app/App.tsx src/app/App.test.tsx
git commit -m "feat/ui: add accessible toast system"
```

---

### Task 7: Personal Settings and protected administrative actions

**Files:**
- Create: `src/features/settings/PersonalSettings.tsx`
- Create: `src/features/settings/SessionSettings.tsx`
- Create: `src/features/settings/AdminAccountManagement.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/features/settings/settings.css`

**Interfaces:**
- Consumes: `ThemeSwitch`, preference context operations, navigation catalog, `ResponsiveDialog`, and `useToast`.
- Preserves: `SettingsApi`, `AuthApi`, account query key, capacity calculation, invitation/restore/deactivate mutations, German errors, and administrator role check.
- Produces: personal Settings for every active profile and admin UI only for active admins.

- [ ] **Step 1: Add failing personal/admin visibility tests**

Update the existing Settings test harness to wrap `ToastProvider` and
`DevicePreferencesProvider`. Replace the member-denial expectation with:

```tsx
it('shows personal settings to a member without loading account management', () => {
  renderPage(member, emptyManagement, settingsApi)
  expect(screen.getByRole('heading', { name: 'Darstellung' })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Dunkelmodus' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mobile Navigation' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Sitzungen' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Kontoverwaltung' })).not.toBeInTheDocument()
  expect(settingsApi.listAccounts).not.toHaveBeenCalled()
})
```

Retain every existing “10 von 10”, loading, error, restore, stale invite, and
deactivation test for admins.

Run: `npm test -- src/features/settings/SettingsPage.test.tsx`

Expected: FAIL because members currently see an admin-only page and no personal
appearance/navigation controls.

- [ ] **Step 2: Add failing mobile selection and ordering tests**

Assert that Settings shows the fixed preview endpoints, three comboboxes,
defaults Calendar/Tasks/Training, unavailable duplicate options, and movement:

```tsx
expect(screen.getByText('Übersicht', { selector: '.mobile-tabs-preview__fixed' }))
expect(screen.getAllByRole('combobox')).toHaveLength(3)
await user.selectOptions(screen.getByLabelText('Tab 2'), 'files')
expect(deviceStorage.write).toHaveBeenLastCalledWith(
  expect.objectContaining({ mobileTabs: ['files', 'tasks', 'training'] }),
)
await user.click(screen.getByRole('button', { name: 'Tab 2 nach rechts' }))
expect(screen.getByLabelText('Tab 3')).toHaveValue('files')
```

Run the focused test and expect FAIL because configuration controls do not
exist.

- [ ] **Step 3: Extract PersonalSettings and mobile controls**

`PersonalSettings` renders:

- heading “Darstellung” and `ThemeSwitch`;
- heading “Mobile Navigation”;
- fixed Übersicht/Mehr preview endpoints;
- three labelled native selects from `navigationItems.filter(pinnableOnMobile)`;
- options already used by another position as disabled;
- “nach links/rechts” buttons mapped to `moveMobileTab` with boundary buttons
  disabled.

All device changes save immediately through context. Do not call Supabase.

- [ ] **Step 4: Add failing critical session-confirmation tests**

Replace the direct all-device expectation with:

```tsx
await user.click(screen.getByRole('button', { name: 'Auf allen Geräten abmelden' }))
expect(authApi.signOutAll).not.toHaveBeenCalled()
const dialog = screen.getByRole('dialog', {
  name: 'Auf allen Geräten abmelden',
})
await user.keyboard('{Escape}')
expect(dialog).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Überall abmelden' }))
expect(authApi.signOutAll).toHaveBeenCalledOnce()
```

Retain the direct current-device sign-out assertion.

Run the focused test and expect FAIL because all-device sign-out currently runs
without confirmation.

- [ ] **Step 5: Extract SessionSettings with critical dialog**

Move existing session state/error logic into `SessionSettings`. Current-device
sign-out remains direct. All-device sign-out opens a critical
`ResponsiveDialog` with “Abbrechen” and “Überall abmelden”; only its confirm
button invokes `signOutAll`.

- [ ] **Step 6: Move admin UI without changing its data path**

Move the current account query, capacity, invitation, profile, reservation,
restore, and mutation logic into `AdminAccountManagement`. Replace the custom
confirmation backdrop with critical `ResponsiveDialog`. Preserve the existing
German deactivation explanation, “Deaktivierung bestätigen” button, capacity
guards, and `AccountFunctionError` messages.

Show success toasts for invitation, restore, and deactivation with plain
messages and no undo action. Keep inline server errors so existing durable error
context remains visible.

`SettingsPage` becomes:

```tsx
export function SettingsPage(props: SettingsPageProps) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' && profile.status === 'active'
  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">Einstellungen</p>
          <h1>Persönliche Einstellungen</h1>
          <p>Darstellung, Navigation und Sitzungen auf diesem Gerät verwalten.</p>
        </div>
      </header>
      <PersonalSettings />
      <SessionSettings authApi={props.authApi} />
      {isAdmin ? <AdminAccountManagement api={props.api} profile={profile} /> : null}
    </section>
  )
}
```

- [ ] **Step 7: Verify Settings and ten-account regression**

Run:

```bash
npm test -- src/features/settings/SettingsPage.test.tsx src/features/settings/settingsApi.test.ts
npm run typecheck
```

Expected: all tests PASS, including “10 von 10”, ninth/tenth capacity behavior,
member API denial, confirmations, and personal controls.

- [ ] **Step 8: Commit Task 7**

```bash
git add src/features/settings
git commit -m "feat/settings: add personal appearance and navigation controls"
```

---

### Task 8: Responsive Playwright coverage and PR screenshots

**Files:**
- Create: `tests/e2e/previewSession.ts`
- Create: `tests/e2e/personalization.spec.ts`
- Modify: `tests/e2e/navigation.spec.ts`
- Modify: `tests/e2e/screenshots.spec.ts`
- Add: `docs/screenshots/design-dark-desktop-expanded.png`
- Add: `docs/screenshots/design-light-desktop-collapsed.png`
- Add: `docs/screenshots/design-mobile-tabs.png`
- Add: `docs/screenshots/design-settings-personalization.png`

**Interfaces:**
- Consumes: preview-only placeholder session and local request stubs.
- Produces: deterministic desktop/mobile/theme/navigation screenshots without remote accounts.
- Preserves: opt-in real Auth E2E behind `E2E_LOCAL_SUPABASE=true`.

- [ ] **Step 1: Extract deterministic preview session helpers**

Move the existing screenshot-session setup to `tests/e2e/previewSession.ts` and
export:

```ts
export type PreviewRole = 'admin' | 'member'
export async function installPreviewSession(page: Page, role: PreviewRole): Promise<void>
```

The helper must:

- install only placeholder auth values;
- fulfill the single-profile request as an object;
- fulfill admin profile-list requests as an array of two active profiles;
- fulfill invitation-list requests as an empty array;
- fulfill `get_account_capacity` as `{ occupied_slots: 2, maximum_slots: 10 }`;
- never call hosted Supabase.

- [ ] **Step 2: Write failing personalization Playwright tests**

Create `tests/e2e/personalization.spec.ts` with project-aware tests:

```ts
test('personalizes desktop theme and sidebar without overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByRole('switch', { name: 'Dunkelmodus' }).uncheck()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Seitenleiste einklappen' }).click()
  await expect(page.getByRole('button', { name: 'Seitenleiste ausklappen' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('configures five mobile tabs and opens every destination', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')
  await installPreviewSession(page, 'member')
  await page.goto('/settings')
  await page.getByLabel('Tab 2').selectOption('files')
  await page.getByRole('button', { name: 'Tab 2 nach rechts' }).click()
  const mobile = page.getByRole('navigation', { name: 'Mobile Navigation' })
  await expect(mobile.getByRole('link')).toHaveCount(4)
  await expect(mobile.getByRole('button', { name: 'Mehr' })).toBeVisible()
  await mobile.getByRole('button', { name: 'Mehr' }).click()
  await expect(page.getByRole('dialog', { name: 'Alle Bereiche' }).getByRole('link')).toHaveCount(10)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
```

Add a reduced-motion test that emulates reduced motion, opens Mehr, and asserts
the dialog remains immediately operable rather than relying on a timeout.

Run: `npm run test:e2e -- tests/e2e/personalization.spec.ts`

Expected: FAIL because Settings personalization and the new navigation controls
are not yet available to Playwright until all selectors/contracts are aligned.

- [ ] **Step 3: Align stable selectors and make Playwright GREEN**

Add stable semantic labels or `data-testid` only where role/name is insufficient.
Do not add test-only production behavior. Update `navigation.spec.ts` to retain
German login and horizontal-overflow coverage on both projects.

Run:

```bash
npm run test:e2e -- tests/e2e/navigation.spec.ts tests/e2e/personalization.spec.ts
```

Expected: all non-opt-in tests PASS on desktop Chromium and iPhone WebKit.

- [ ] **Step 4: Extend and run deterministic screenshots**

Update `screenshots.spec.ts` to use the extracted preview helper and capture the
four exact files listed above. Use Dark/expanded desktop, Light/collapsed
desktop, iPhone configured tab bar, and personal Settings. Keep the existing
`CAPTURE_SCREENSHOTS=true` gate.

Run:

```powershell
$env:CAPTURE_SCREENSHOTS='true'
npm run test:e2e -- tests/e2e/screenshots.spec.ts
Remove-Item Env:CAPTURE_SCREENSHOTS
```

Expected: screenshot tests PASS and all four PNG files exist.

- [ ] **Step 5: Inspect every screenshot**

Open all four images and verify:

- no clipping or horizontal overflow;
- Dark and Light tokens both render correctly;
- desktop expanded/collapsed geometry is stable;
- mobile tab labels and safe area are visible;
- Settings controls remain compact and German;
- no real personal data appears.

If a screenshot reveals a defect, add a failing Playwright/component regression
test before changing production CSS or markup.

- [ ] **Step 6: Commit Task 8**

```bash
git add tests/e2e docs/screenshots
git commit -m "test/e2e: cover responsive personalization"
```

---

### Task 9: Documentation, scope audit, and complete verification

**Files:**
- Modify: `README.md`
- Modify: `scripts/foundation-docs.test.mjs`
- Verify unchanged: `supabase/migrations/**`
- Verify unchanged: `supabase/functions/**`
- Verify unchanged: `.env.example`

**Interfaces:**
- Consumes: completed UI behavior and exact verification commands.
- Produces: user-facing local personalization documentation and final scope evidence.

- [ ] **Step 1: Write failing documentation assertions**

Extend `scripts/foundation-docs.test.mjs` with a test requiring README coverage
for these exact terms:

```js
for (const requiredText of [
  'Dunkelmodus',
  'Light Mode',
  'Seitenleiste',
  'Mobile Navigation',
  'Kalender, Aufgaben und Training',
  'lokal auf dem Gerät',
]) {
  expect(readme).toContain(requiredText)
}
```

Run: `npm test -- scripts/foundation-docs.test.mjs`

Expected: FAIL because README does not yet describe personalization.

- [ ] **Step 2: Document the milestone without deployment instructions**

Add a concise README section stating:

- Dark is the first-start default; Light is selected in Settings;
- theme, manual desktop sidebar, and mobile tabs stay local to the device;
- mobile defaults are Kalender, Aufgaben, Training;
- Übersicht and Mehr are fixed;
- the feature adds no database data or secret;
- placeholders remain non-functional.

Run the documentation test and expect PASS.

- [ ] **Step 3: Run formatting and forbidden-scope searches**

Run:

```bash
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD -- supabase/migrations supabase/functions .env.example
rg -n "localStorage" src --glob '!preferences/**' --glob '!features/auth/AuthContext.tsx'
rg -n "purple|violet|Capacitor|SwiftUI|FullCalendar|dnd-kit" src package.json
```

Expected:

- no whitespace errors;
- no migration, Function, or environment-template paths in the diff;
- no new scattered preference `localStorage` access;
- no out-of-scope dependency or implementation matches.

- [ ] **Step 4: Run the complete required verification**

Run sequentially:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run check
npm run test:e2e
```

Record exact test-file/test counts and every intentionally skipped opt-in test.
Auth lifecycle tests may skip only because `E2E_LOCAL_SUPABASE` is not enabled;
screenshot refresh tests may skip only because `CAPTURE_SCREENSHOTS` is not set.
All ordinary desktop and iPhone personalization tests must pass.

- [ ] **Step 5: Manually verify responsive and accessibility states**

Using the local preview session, verify:

- Dark and Light;
- desktop expanded and collapsed;
- forced compact layout at 768–1099 px;
- iPhone tab bar and safe areas;
- keyboard-only theme, sidebar, tab ordering, More, dialog, and toast controls;
- focus restoration after dialog close;
- reduced motion;
- no horizontal scrollbar;
- admin account management still displays `2 von 10`.

Do not submit invitations, deactivate real accounts, or use hosted Supabase.

- [ ] **Step 6: Commit Task 9**

```bash
git add README.md scripts/foundation-docs.test.mjs
git commit -m "docs: document design-system personalization"
```

- [ ] **Step 7: Request independent code review and address findings**

Compare `origin/main` to `HEAD`. Review security, persistence sanitization,
responsive state, focus management, admin authorization, timer cleanup,
accessibility, tests, scope, and screenshot accuracy. Fix every Critical or
Important finding with a failing regression test and a focused commit. Document
Minor findings in the Draft PR.

- [ ] **Step 8: Perform final verification immediately before publishing**

Re-run:

```bash
npm run check
npm run security:scan
npm run test:e2e
git status --short
```

Expected: every command exits 0 and the worktree is clean.

- [ ] **Step 9: Push and create the Draft PR**

Push `feature/design-system-personalization` and create a Draft PR against
`main` titled:

```text
feat: add responsive design system personalization
```

The PR body must include:

- implementation summary;
- Dark/Light, expanded/collapsed desktop, mobile tabs, and Settings screenshots;
- exact commands and results;
- deliberately skipped tests and reasons;
- known limitations and review points;
- “New dependencies: none”;
- “Database changes: none”;
- “Edge Function changes: none”;
- “Secret changes: none”;
- confirmation that account capacity remains database-owned at ten.

Do not mark ready, merge, deploy, or perform any Supabase remote action.
