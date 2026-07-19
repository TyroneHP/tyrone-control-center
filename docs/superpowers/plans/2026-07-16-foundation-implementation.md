# CoreGrid Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Milestone 1 as a deployable Slate-style React PWA with GitHub Pages CI, Supabase e-mail/password authentication, invitation-only onboarding, a transactionally enforced ten-account limit, administrator user management, baseline RLS/auditing, and offline application-shell loading.

**Architecture:** The browser runs a static React + TypeScript application from GitHub Pages. Public Supabase configuration is supplied at build time; all privileged account operations run through Supabase Edge Functions using the project secret key. PostgreSQL owns account-capacity enforcement, invitation state, profiles, and audit records so browser checks cannot bypass the ten-user rule.

**Tech Stack:** Node.js 22.12+, npm, React, TypeScript, Vite, React Router, TanStack Query, Supabase JS/CLI, React Hook Form, Zod, Vitest, React Testing Library, Playwright, vite-plugin-pwa, GitHub Actions.

## Global Constraints

- Repository: `TyroneHP/tyrone-control-center`.
- Production base path: `/tyrone-control-center/`.
- Node.js floor: `22.12.0`; npm only.
- User-facing copy is German; code/database identifiers and commits are English.
- Entire UI uses the approved dark Navy/Slate design with lighter blue accents.
- Exactly ten occupied or reserved account slots, enforced transactionally in PostgreSQL.
- First account can only be bootstrapped for `BOOTSTRAP_ADMIN_EMAIL`.
- Public registration remains disabled; all later users require administrator invitations.
- Admin rights never expose another user’s future private content.
- No service key, provider key, encryption key, or private push key may enter the browser bundle or repository.
- Every client-visible table uses RLS with deny-by-default access.
- Every privileged mutation writes an audit event.
- Use TDD and commit after each task.
- Calendar, tasks, AI providers, file handling, and push delivery are outside this milestone; navigation placeholders are allowed.

---

## Planned Repository Structure

```text
.github/workflows/ci.yml
.github/workflows/deploy-pages.yml
public/404.html
public/icon.svg
src/app/
src/config/env.ts
src/design-system/
src/features/auth/
src/features/settings/
src/features/shell/
src/lib/supabase/
src/pwa/
src/routes/
src/test/
supabase/config.toml
supabase/functions/_shared/
supabase/functions/bootstrap-admin/
supabase/functions/invite-user/
supabase/functions/manage-user/
supabase/functions/cleanup-deactivated-users/
supabase/migrations/202607160001_foundation.sql
supabase/tests/202607160001_foundation.sql
tests/e2e/
.env.example
playwright.config.ts
vite.config.ts
README.md
```

---

### Task 1: Scaffold React, TypeScript, Vite, and Testing

**Files:** Vite root files, `src/test/setup.ts`, `src/app/App.tsx`, `src/app/App.test.tsx`, `package.json`, `vite.config.ts`.

- [ ] Run:

```bash
npm create vite@latest . -- --template react-ts --no-interactive
npm install
npm install react-router-dom @tanstack/react-query @supabase/supabase-js react-hook-form zod @hookform/resolvers lucide-react clsx
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test vite-plugin-pwa workbox-window supabase
```

- [ ] Add Node engine and scripts:

```json
{
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint . --max-warnings=0",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc -b --pretty false",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:test": "supabase test db"
  }
}
```

- [ ] Add a failing test asserting the heading `CoreGrid`, configure Vitest with `jsdom`, then implement the minimal `App` component.
- [ ] Run `npm run check`; expected PASS.
- [ ] Commit: `chore: scaffold React foundation`.

---

### Task 2: Configure Public Environment, Supabase Client, and GitHub Pages Routing

**Files:** `.env.example`, `src/config/env.ts`, tests, `src/lib/supabase/client.ts`, `public/404.html`, `index.html`, `vite.config.ts`.

- [ ] Write failing tests for missing/valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Parse public configuration with Zod:

```ts
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  BASE_URL: z.string().min(1).default('/'),
})
```

- [ ] Create one browser client with session persistence, token refresh, and URL session detection. Never use a secret key in the frontend.
- [ ] Configure Vite production base:

```ts
base: mode === 'production' ? '/tyrone-control-center/' : '/'
```

- [ ] Add a committed GitHub Pages SPA `404.html` redirect and matching route restoration script in `index.html`.
- [ ] Verify production output references `/tyrone-control-center/assets/`.
- [ ] Commit: `feat: configure Supabase client and Pages base`.

---

### Task 3: Build the Slate Design System and Responsive Shell

**Files:** `src/design-system/*`, `src/features/shell/*`, tests.

- [ ] Add approved tokens:

```css
:root {
  color-scheme: dark;
  --color-bg: #071526;
  --color-bg-elevated: #0c2545;
  --color-surface: #122d4f;
  --color-surface-soft: #193458;
  --color-primary: #326ac1;
  --color-primary-hover: #3f7bd6;
  --color-text: #f4f7fb;
  --color-text-muted: #a9b6c6;
  --color-border: rgba(169, 182, 198, 0.16);
  --radius-card: 18px;
  --radius-control: 12px;
}
```

- [ ] Create typed `Button`, `Card`, `FormField`, `InlineAlert`, and loading primitives.
- [ ] Create one shared navigation model for Übersicht, Kalender, Aufgaben, Technikerarbeit, Schule, Training, Ernährung, Dateien, KI-Chat, Einstellungen.
- [ ] Desktop: persistent left sidebar. Mobile: bottom navigation plus safe-area padding.
- [ ] Add shell tests proving desktop/mobile navigation share the same labels and links.
- [ ] Commit: `feat: add responsive Slate app shell`.

---

### Task 4: Initialize Supabase and Implement the Foundation Schema

**Files:** `supabase/config.toml`, migration, seed, pgTAP tests, generated database types.

- [ ] Run:

```bash
npx supabase init
npx supabase start
```

- [ ] First write failing pgTAP tests for the required tables, functions, and exact policies.
- [ ] Migration creates:
  - enums `app_role`, `profile_status`, `invitation_status`;
  - `profiles`, `invitations`, `activity_log`;
  - updated-at trigger;
  - helper functions `current_user_role`, `current_user_is_active`;
  - service-only `reserve_invitation`;
  - auth-user trigger that rejects users without a valid invitation;
  - authenticated `accept_current_invitation`;
  - service-only `deactivate_profile`, `restore_profile`, `list_cleanup_candidates`.
- [ ] Account capacity is protected by `pg_advisory_xact_lock`. Count:

```sql
select
  (select count(*) from public.profiles where status in ('invited', 'active'))
  +
  (select count(*) from public.invitations
    where status = 'pending' and expires_at > now() and auth_user_id is null)
into v_reserved_count;

if v_reserved_count >= public.account_capacity_limit() then
  raise exception using errcode = 'P0001', message = 'ACCOUNT_CAPACITY_REACHED';
end if;
```

- [ ] `profiles` grants authenticated users select and only column-level update of `display_name`; role/status cannot be edited from the client.
- [ ] RLS policies:
  - profiles: own row or admin;
  - invitations: active admin only;
  - audit: own actor events or active admin.
- [ ] Prevent deactivation of the last active administrator.
- [ ] Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

- [ ] Commit: `feat: add invitation-only account schema`.

---

### Task 5: Implement Secure Bootstrap and Invitation Edge Functions

**Files:** `supabase/functions/_shared/*`, `bootstrap-admin/index.ts`, `invite-user/index.ts`, Deno tests.

- [ ] Add pure tested helpers for e-mail normalization, allowed redirect origins, CORS, redacted errors, and admin/client Supabase creation.
- [ ] `bootstrap-admin`:
  - POST only;
  - no JWT, but e-mail must equal `BOOTSTRAP_ADMIN_EMAIL`;
  - reserve admin invitation through service-only RPC;
  - send invite with `auth.admin.inviteUserByEmail`;
  - redirect to `/update-password`;
  - revoke reservation if e-mail sending fails;
  - return metadata only.
- [ ] Set:

```toml
[functions.bootstrap-admin]
verify_jwt = false
```

- [ ] `invite-user`:
  - require JWT;
  - authenticate caller via network-verified Supabase user;
  - require active admin profile;
  - reserve a member invitation transactionally;
  - send invite e-mail;
  - write `invitation.created` audit event;
  - never expose secret/service errors.
- [ ] Local secrets remain in ignored `supabase/.env.local`.
- [ ] Run Deno tests and `npx supabase functions serve`.
- [ ] Commit: `feat: add secure account invitation functions`.

---

### Task 6: Implement Authentication State and Pages

**Files:** `src/features/auth/*`, tests, feedback/loading components.

- [ ] Add Zod schemas for login, setup, forgot password, and 12-character minimum new password.
- [ ] Wrap:

```ts
supabase.auth.signInWithPassword(...)
supabase.auth.resetPasswordForEmail(...)
supabase.auth.updateUser(...)
supabase.auth.signOut({ scope: 'local' })
supabase.rpc('accept_current_invitation')
supabase.functions.invoke('bootstrap-admin', ...)
```

- [ ] `AuthContext`:
  - obtains initial session;
  - subscribes to `onAuthStateChange`;
  - loads profile by authenticated user ID;
  - accepts an invited profile exactly once;
  - rejects/deauthenticates deactivated profiles;
  - never authorizes using user metadata.
- [ ] Public pages: `/login`, `/setup`, `/forgot-password`, `/update-password`.
- [ ] `ProtectedRoute` only renders for active profile/session; otherwise redirects to `/login`.
- [ ] Add component tests for valid/invalid German forms and redirect behavior.
- [ ] Commit: `feat: add invitation-based authentication UI`.

---

### Task 7: Add Providers, Routing, and Protected Placeholders

**Files:** `src/app/*`, `src/routes/router.tsx`, tests, placeholder pages.

- [ ] Add one TanStack `QueryClient` with five-minute stale time, one query retry, no mutation retry.
- [ ] Create public routes and protected shell routes.
- [ ] Use `createBrowserRouter` basename derived from `import.meta.env.BASE_URL`.
- [ ] Protected paths:

```text
/
/calendar
/tasks
/technician
/school
/training
/nutrition
/files
/ai
/settings
```

- [ ] Placeholder text: `Dieses Modul wird in einem späteren Meilenstein aktiviert.`
- [ ] Route tests prove protected redirection and public login rendering.
- [ ] Commit: `feat: add protected application routing`.

---

### Task 8: Implement Administrator User Management and Grace-Period Deactivation

**Files:** `manage-user` and cleanup Edge Functions, `src/features/settings/*`, tests.

- [ ] Admin page shows active/invited/deactivated profiles, invitation state, and occupied/reserved slots.
- [ ] Invite button disables at the database-reported maximum of ten occupied or reserved slots.
- [ ] `manage-user` request union:

```ts
type ManageUserRequest =
  | { action: 'deactivate'; userId: string }
  | { action: 'restore'; userId: string }
```

- [ ] Reject self-deactivation and last-admin deactivation.
- [ ] Deactivation frees slot immediately, sets 30-day deletion grace period, revokes refresh sessions where supported, and writes audit.
- [ ] Restore clears grace-period fields and consumes a free slot transactionally.
- [ ] Cleanup function requires `x-cron-secret`, processes due users idempotently, deletes auth users server-side, and returns counts without e-mails.
- [ ] Admin tests show member access denied and explicit confirmation required for deactivation.
- [ ] Commit: `feat: add ten-account administrator controls`.

---

### Task 9: Add Installable PWA and Offline Application Shell

**Files:** `public/icon.svg`, `src/pwa/ReloadPrompt.tsx`, tests, `vite.config.ts`.

- [ ] Configure `VitePWA` with:

```ts
{
  registerType: 'prompt',
  manifest: {
    name: 'CoreGrid',
    short_name: 'CoreGrid',
    theme_color: '#071526',
    background_color: '#071526',
    display: 'standalone',
    start_url: '/tyrone-control-center/',
    scope: '/tyrone-control-center/'
  },
  workbox: {
    navigateFallback: 'index.html',
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    runtimeCaching: []
  }
}
```

- [ ] Cache app shell/static assets only. Do not broadly cache API responses yet.
- [ ] Update prompt shows `Eine neue Version ist verfügbar.` and explicit `Aktualisieren`/`Später` actions.
- [ ] Offline-ready prompt is visible once; never auto-reload while editing.
- [ ] Verify service worker, manifest, icon, and offline shell.
- [ ] Commit: `feat: add installable offline PWA shell`.

---

### Task 10: Add CI, Pages Deployment, and Secret Scanning

**Files:** `.github/workflows/*`, `scripts/check-secrets.mjs`, package scripts.

- [ ] Secret scanner checks tracked files and `dist/` for actual secret-value patterns, including `sb_secret_...`, assigned Supabase secret keys, `sk-...`, and private keys. Documentation words alone must not fail.
- [ ] CI on pushes/PRs:
  - `actions/checkout@v6`;
  - `actions/setup-node@v6`, Node `22.12.0`, npm cache;
  - `npm ci`;
  - lint, typecheck, unit tests, secret scan, production build.
- [ ] Pages deployment:
  - `actions/configure-pages@v5`;
  - `actions/upload-pages-artifact@v4` from `dist`;
  - `actions/deploy-pages@v4`;
  - `contents: read`, `pages: write`, `id-token: write`;
  - concurrency group `pages`;
  - secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`;
  - fail clearly when secrets are missing.
- [ ] Run `npm run check` and secret scan.
- [ ] Commit: `ci: add quality checks and Pages deployment`.

---

### Task 11: Add End-to-End Tests and Setup Documentation

**Files:** `playwright.config.ts`, `tests/e2e/*`, `README.md`, `docs/setup-supabase.md`.

- [ ] Playwright runs desktop Chromium and iPhone WebKit profiles.
- [ ] Navigation E2E proves login page branding and no horizontal overflow.
- [ ] Local-Supabase auth E2E covers:
  1. bootstrap configured administrator;
  2. consume local Mailpit invite and set password;
  3. login and enter protected shell;
  4. fill the first ten occupied or reserved slots, including the administrator;
  5. eleventh reservation fails with `ACCOUNT_CAPACITY_REACHED`;
  6. member cannot use admin controls;
  7. deactivate and restore member.
- [ ] Setup guide includes:
  - create hosted Supabase project;
  - disable public signup;
  - configure localhost and GitHub Pages redirect URLs;
  - configure production SMTP;
  - `supabase login`, `link`, `db push`;
  - set `BOOTSTRAP_ADMIN_EMAIL`, `APP_ORIGIN`, `ALLOWED_ORIGINS`, `CLEANUP_CRON_SECRET`;
  - deploy functions;
  - add GitHub public Supabase secrets;
  - select GitHub Actions as Pages source;
  - run `/setup` and accept invite.
- [ ] Final verification:

```bash
npm run check
npx supabase db reset
npx supabase test db
deno test supabase/functions/_shared/accountRules.test.ts
npm run test:e2e -- --project=desktop-chromium tests/e2e/navigation.spec.ts
npm run security:scan
```

- [ ] Commit: `test: verify foundation onboarding and navigation`.

---

## Milestone 1 Completion Gate

- [ ] Clean clone succeeds with Node 22.12+ and `npm ci`.
- [ ] All unit, type, lint, build, database, Deno, and selected E2E checks pass.
- [ ] Only configured bootstrap address can become first admin.
- [ ] Uninvited/direct signup is rejected and hosted public signup is disabled.
- [ ] Ten account slots work; the eleventh reservation fails transactionally.
- [ ] Admin can invite, deactivate, and restore; member cannot.
- [ ] Client cannot modify role/status or read disallowed rows.
- [ ] Bundle/repository contains no secret values.
- [ ] Root and deep links work on GitHub Pages.
- [ ] Desktop sidebar, mobile bottom navigation, and iPhone safe-area behavior are correct.
- [ ] PWA app shell reloads offline after a successful visit.
- [ ] No Milestone 2–5 implementation is included.

## Self-Review

- Milestone 1 requirements are mapped to explicit tasks.
- Account states, roles, RPC names, Edge Function request shapes, and routes are consistent.
- No unresolved implementation placeholders remain.
- Milestones 2–5 require separate implementation plans after this completion gate passes.

## Official References

- Vite: `https://vite.dev/guide/`
- Supabase CLI: `https://supabase.com/docs/guides/local-development/cli/getting-started`
- Supabase Auth: `https://supabase.com/docs/guides/auth/passwords`
- Supabase Edge Functions: `https://supabase.com/docs/guides/functions`
- Supabase invitations: `https://supabase.com/docs/guides/auth/users`
- GitHub Pages workflows: `https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`
- Vite PWA React: `https://vite-pwa-org.netlify.app/frameworks/react`
