# Ten-Account Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the transactionally enforced account capacity to ten total occupied or reserved accounts, with the administrator consuming one slot and up to nine additional invited members.

**Architecture:** PostgreSQL defines the maximum once and exposes an administrator-only capacity-state RPC. Reservation and restoration reuse the database limit under the existing advisory lock; the frontend reads the RPC state instead of embedding a number, while Edge Functions keep database enforcement authoritative and use number-neutral safe copy.

**Tech Stack:** PostgreSQL/Supabase migrations and pgTAP, Supabase Edge Functions with Deno and TypeScript, React 19, TypeScript, TanStack Query, Vitest, Playwright, npm, Docker.

## Global Constraints

- Work only on `feat/increase-account-capacity`; never change `main` directly and do not merge.
- Use Node.js `>=22.12.0`, npm, React, TypeScript, Vite, Supabase, and Deno already present in the repository.
- Keep all visible application copy in German; keep code, SQL identifiers, and commit messages in English.
- Do not edit `supabase/migrations/202607160001_foundation.sql`; add a new migration.
- Do not modify existing hosted or production data and do not deploy the migration or Edge Functions remotely.
- Do not add dependencies, configuration UI, roles, registration paths, or unrelated refactors.
- Never print, store, or commit secrets; never expose a service-role key to the browser.
- Preserve invitation-only onboarding, RLS, grants, auditing, CORS, rate limiting, and the account-capacity advisory lock.
- Execute every implementation task test-first: RED, confirm the expected failure, GREEN, rerun affected tests, then commit.

---

### Task 1: Centralize and raise database capacity

**Files:**
- Create: `supabase/migrations/202607170001_increase_account_capacity.sql`
- Create: `supabase/tests/202607170001_increase_account_capacity.sql`
- Modify: `supabase/tests/202607160001_foundation.sql`

**Interfaces:**
- Consumes: existing `public.profiles`, `public.invitations`, `public.reserve_invitation(...)`, `public.restore_profile(...)`, `public.current_user_is_active()`, and `public.current_user_role()`.
- Produces: `public.account_capacity_limit() returns integer`, `public.account_capacity_occupied() returns integer`, and administrator-only `public.get_account_capacity() returns table (occupied_slots integer, maximum_slots integer)`.

- [ ] **Step 1: Write the failing pgTAP capacity contract**

Create a transactional pgTAP test that asserts the three functions exist, the
limit is ten, an accepted administrator plus nine pending member reservations
produce ten occupied slots, the next reservation throws
`ACCOUNT_CAPACITY_REACHED`, revocation and deactivation release slots, and an
active member cannot call the state RPC. Use deterministic `example.test`
addresses and UUIDs only.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_function('public', 'account_capacity_limit', array[]::text[]);
select has_function('public', 'account_capacity_occupied', array[]::text[]);
select has_function('public', 'get_account_capacity', array[]::text[]);
select is(public.account_capacity_limit(), 10, 'database owns a ten-account limit');

select lives_ok(
  $$select public.reserve_invitation('admin@example.test', 'admin', null, now() + interval '7 days')$$,
  'administrator reserves slot one'
);
select lives_ok(
  $test$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
      'authenticated', 'authenticated', 'admin@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $test$,
  'reserved administrator becomes the first profile'
);
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';
select lives_ok(
  $$select public.accept_current_invitation()$$,
  'administrator activates slot one'
);
select lives_ok(
  $test$
    do $$
    begin
      for slot_number in 1..9 loop
        perform public.reserve_invitation(
          format('member%s@example.test', slot_number),
          'member',
          '11111111-1111-1111-1111-111111111111',
          now() + interval '7 days'
        );
      end loop;
    end
    $$
  $test$,
  'member slots two through ten can be reserved'
);
select is(public.account_capacity_occupied(), 10, 'administrator and nine reservations fill ten slots');
select throws_ok(
  $$select public.reserve_invitation('member10@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'P0001',
  'ACCOUNT_CAPACITY_REACHED',
  'the eleventh occupied or reserved account is rejected'
);

select * from finish();
rollback;
```

Update the Foundation test's capacity fixture from three to nine member
reservations and change its affected audit counts and descriptions so it
asserts the current contract after all migrations are applied.

- [ ] **Step 2: Run the database test and confirm RED**

Run:

```powershell
npx supabase db reset
npx supabase test db
```

Expected: `supabase db reset` succeeds with the existing Foundation migration;
`supabase test db` fails because `public.account_capacity_limit`,
`public.account_capacity_occupied`, and `public.get_account_capacity` do not yet
exist.

- [ ] **Step 3: Add the additive migration**

Create the central functions with the exact semantics below:

```sql
create or replace function public.account_capacity_limit()
returns integer
language sql
immutable
security definer
set search_path = ''
as $$
  select 10
$$;

create or replace function public.account_capacity_occupied()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.profiles where status in ('invited', 'active'))
    +
    (select count(*) from public.invitations
      where status = 'pending'
        and expires_at > now()
        and auth_user_id is null)
  )::integer
$$;

create or replace function public.get_account_capacity()
returns table (occupied_slots integer, maximum_slots integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_active()
    or public.current_user_role() <> 'admin'
  then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  return query
  select public.account_capacity_occupied(), public.account_capacity_limit();
end;
$$;
```

Copy the complete current `reserve_invitation` and `restore_profile` definitions
into the additive migration without changing their signatures. In each copied
body, preserve the existing advisory lock and replace only the duplicated
count/threshold block:

```diff
-  select ... into v_reserved_count;
-  if v_reserved_count >= 4 then
+  v_reserved_count := public.account_capacity_occupied();
+  if v_reserved_count >= public.account_capacity_limit() then
     raise exception using errcode = 'P0001', message = 'ACCOUNT_CAPACITY_REACHED';
   end if;
```

Apply least-privilege grants:

```sql
revoke execute on function public.account_capacity_limit() from public, anon, authenticated;
revoke execute on function public.account_capacity_occupied() from public, anon, authenticated;
revoke execute on function public.get_account_capacity() from public, anon;
grant execute on function public.account_capacity_limit() to service_role;
grant execute on function public.account_capacity_occupied() to service_role;
grant execute on function public.get_account_capacity() to authenticated, service_role;
```

Do not insert, update, or delete application rows in the migration.

- [ ] **Step 4: Verify fresh and additive migration paths GREEN**

Run:

```powershell
npx supabase db reset
npx supabase test db
npx supabase db reset --version 202607160001
npx supabase migration up --local
npx supabase test db
```

Expected: both a fresh reset and applying the new migration after the Foundation
version succeed; all pgTAP files pass. If the installed CLI spells an option
differently, inspect `npx supabase db reset --help` and use the documented local
equivalent without contacting the hosted project.

- [ ] **Step 5: Commit the database task**

```powershell
git add supabase/migrations/202607170001_increase_account_capacity.sql supabase/tests/202607170001_increase_account_capacity.sql supabase/tests/202607160001_foundation.sql
git commit -m "feat: centralize ten-account database capacity"
```

---

### Task 2: Read database capacity in account settings

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/features/settings/settingsApi.ts`
- Modify: `src/features/settings/settingsApi.test.ts`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `public.get_account_capacity()` from Task 1.
- Produces: `AccountCapacity { occupiedSlots: number; maximumSlots: number }` and `AccountManagement.capacity` used by `SettingsPage`.

- [ ] **Step 1: Write failing API and UI tests**

Extend `database.types.ts` with the RPC result:

```ts
get_account_capacity: {
  Args: Record<PropertyKey, never>
  Returns: {
    maximum_slots: number
    occupied_slots: number
  }[]
}
```

Write the tests before changing production TypeScript:

```ts
it('loads the authoritative database capacity with the account lists', async () => {
  // Mock profiles/invitations selects and rpc('get_account_capacity').single().
  await expect(api.listAccounts()).resolves.toMatchObject({
    capacity: { occupiedSlots: 9, maximumSlots: 10 },
  })
  expect(client.rpc).toHaveBeenCalledWith('get_account_capacity')
})

it('allows the tenth slot and disables invitations only at ten of ten', async () => {
  // Render once with capacity 9/10 and assert enabled; render at 10/10 and assert disabled.
})
```

Update existing fixture objects to include `capacity`. Assert the exact German
counter `9 von 10` or `10 von 10` and the exact at-capacity copy
`Alle zehn Kontoplätze sind belegt oder reserviert.`

- [ ] **Step 2: Run targeted tests and confirm RED**

Run:

```powershell
npm run test -- src/features/settings/settingsApi.test.ts src/features/settings/SettingsPage.test.tsx
```

Expected: failures show that `listAccounts()` does not call
`get_account_capacity`, `AccountManagement` has no capacity state, and the page
still embeds four.

- [ ] **Step 3: Implement the typed API state**

Add these exact types:

```ts
export interface AccountCapacity {
  maximumSlots: number
  occupiedSlots: number
}

export interface AccountManagement {
  capacity: AccountCapacity
  invitations: Invitation[]
  profiles: Profile[]
}
```

Load all three sources together and map the RPC row:

```ts
const [profilesResult, invitationsResult, capacityResult] = await Promise.all([
  client.from('profiles').select('*').order('created_at'),
  client.from('invitations').select('*').order('created_at'),
  client.rpc('get_account_capacity').single(),
])

if (profilesResult.error) throw profilesResult.error
if (invitationsResult.error) throw invitationsResult.error
if (capacityResult.error) throw capacityResult.error

return {
  capacity: {
    maximumSlots: capacityResult.data.maximum_slots,
    occupiedSlots: capacityResult.data.occupied_slots,
  },
  invitations: invitationsResult.data,
  profiles: profilesResult.data,
}
```

- [ ] **Step 4: Implement dynamic UI capacity**

Replace the local profile/invitation count and hard-coded maximum with:

```ts
const occupiedSlots = data?.capacity.occupiedSlots ?? 0
const maximumSlots = data?.capacity.maximumSlots ?? 0
const capacityReached = data !== undefined && occupiedSlots >= maximumSlots
```

Render `{occupiedSlots} von {maximumSlots}`. Use German copy that states ten
total accounts and `Alle zehn Kontoplätze sind belegt oder reserviert.` Keep the
existing layout and use `capacityReached` for invite and restore buttons.

- [ ] **Step 5: Run targeted and full frontend tests GREEN**

```powershell
npm run test -- src/features/settings/settingsApi.test.ts src/features/settings/SettingsPage.test.tsx
npm run typecheck
```

Expected: targeted tests and TypeScript pass with no warnings or skipped tests.

- [ ] **Step 6: Commit the frontend task**

```powershell
git add src/lib/supabase/database.types.ts src/features/settings/settingsApi.ts src/features/settings/settingsApi.test.ts src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.test.tsx
git commit -m "feat: use database account capacity in settings"
```

---

### Task 3: Keep Edge Function capacity errors consistent

**Files:**
- Modify: `supabase/functions/_shared/accountRules.ts`
- Modify: `supabase/functions/_shared/accountRules.test.ts`
- Modify: `supabase/functions/invite-user/index.test.ts`

**Interfaces:**
- Consumes: unchanged database error code `ACCOUNT_CAPACITY_REACHED`.
- Produces: safe HTTP 409 response with number-neutral German text.

- [ ] **Step 1: Write failing Deno assertions**

Add an exact safe-message assertion:

```ts
assertEquals(
  capacity.message,
  'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
  'capacity message',
)
```

Rename the invitation test to `invite-user maps the eleventh reservation to a
safe conflict` and assert the response payload contains the same message and
`ACCOUNT_CAPACITY_REACHED`.

- [ ] **Step 2: Run the affected Deno tests and confirm RED**

```powershell
npx deno@2.9.3 test supabase/functions/_shared/accountRules.test.ts supabase/functions/invite-user/index.test.ts
```

Expected: failure because the old safe message still says four.

- [ ] **Step 3: Change only the safe capacity copy**

```ts
ACCOUNT_CAPACITY_REACHED: {
  message: 'Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.',
  status: 409,
},
```

- [ ] **Step 4: Run all Edge Function tests GREEN**

```powershell
npx deno@2.9.3 test supabase/functions
```

Expected: all Deno tests pass; unknown error redaction and all other safe codes
remain unchanged.

- [ ] **Step 5: Commit the Edge Function task**

```powershell
git add supabase/functions/_shared/accountRules.ts supabase/functions/_shared/accountRules.test.ts supabase/functions/invite-user/index.test.ts
git commit -m "fix: generalize account capacity errors"
```

---

### Task 4: Prove the ten-slot and concurrency boundary through Auth E2E

**Files:**
- Modify: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: local Supabase stack, four locally served Edge Functions, Mailpit, and the browser settings UI.
- Produces: a full account lifecycle proving administrator slot one, nine successful member slots, atomic rejection of slot eleven, member authorization, deactivation, restoration, and login.

- [ ] **Step 1: Update the Auth E2E expectation before implementation is available**

Change the lifecycle title to `bootstraps, enforces ten slots concurrently,
denies members, and restores a user`, increase its timeout to 180 seconds, and
define eight sequential member addresses. After those invitations, assert
`9 von 10` and an enabled invite button.

Add this concurrent boundary step:

```ts
const responses = await Promise.all([
  invokeFunction(request, 'invite-user', token, {
    email: 'member-nine-a@example.test',
  }),
  invokeFunction(request, 'invite-user', token, {
    email: 'member-nine-b@example.test',
  }),
])

expect(responses.map((response) => response.status()).sort()).toEqual([201, 409])
const rejected = responses.find((response) => response.status() === 409)
await expect(rejected!.json()).resolves.toMatchObject({
  code: 'ACCOUNT_CAPACITY_REACHED',
})

await page.reload()
await expect(page.getByText('10 von 10')).toBeVisible()
await expect(page.getByRole('button', { name: 'Einladung senden' })).toBeDisabled()
```

- [ ] **Step 2: Run Auth E2E against the pre-change behavior and confirm RED**

Start the local stack and Functions using the repository's documented local
environment, never printing their values, then run:

```powershell
$env:E2E_LOCAL_SUPABASE='true'
npm run test:e2e -- tests/e2e/auth.spec.ts --project=desktop-chromium
```

This is a test-only acceptance task: the database boundary was already driven
from RED to GREEN in Task 1 before any capacity implementation was written.
The first run here must demonstrate the additional near-simultaneous request
path without changing production code.

- [ ] **Step 3: Run the Auth E2E GREEN**

Reset local Supabase, serve all functions with the existing ignored local env
file, and run the same Playwright command. Expected: eight sequential member
invitations succeed, exactly one of the two concurrent boundary requests
succeeds, one returns HTTP 409 with `ACCOUNT_CAPACITY_REACHED`, and all later
authorization/lifecycle steps pass.

- [ ] **Step 4: Commit the Auth E2E task**

```powershell
git add tests/e2e/auth.spec.ts
git commit -m "test: cover concurrent ten-account invitations"
```

---

### Task 5: Update all capacity documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/setup-supabase.md`
- Modify: `docs/superpowers/specs/2026-07-16-tyrone-control-center-design.md`
- Modify: `docs/superpowers/plans/2026-07-16-foundation-implementation.md`
- Modify: `scripts/foundation-docs.test.mjs`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-17-increase-account-capacity-design.md`.
- Produces: current documentation that consistently states ten total accounts, one administrator plus nine additional members.

- [ ] **Step 1: Make the documentation test fail on old capacity wording**

Change the required README text from `maximal vier` to `maximal zehn`, add
`bis zu neun weitere`, and assert current docs do not contain the capacity
phrases `maximal vier`, `vier Konten`, `four-account`, or `four active` outside
the immutable migration and the explicit historical comparison in the new
design spec.

- [ ] **Step 2: Run the documentation test and confirm RED**

```powershell
npm run test -- scripts/foundation-docs.test.mjs
```

Expected: failure because README and current design/setup documents still
describe four accounts.

- [ ] **Step 3: Update the documentation**

Apply these exact semantics everywhere:

```text
Maximum: ten occupied or reserved accounts in total.
Composition: one administrator plus up to nine additional invited members.
Boundary: the eleventh reservation is rejected transactionally.
```

Update Foundation plan examples to call the central database limit rather than
showing `>= 4`, and rename old capacity-specific test/commit descriptions to
ten-account wording. Preserve unrelated uses such as four domain modules.

- [ ] **Step 4: Run documentation and repository search GREEN**

```powershell
npm run test -- scripts/foundation-docs.test.mjs
rg -n -i --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' "maximal vier|vier Konten|four-account|four active|fifth reservation|fifth account|>= 4|occupiedSlots >= 4" .
```

Expected: the documentation test passes. Search hits are limited to explicitly
approved historical explanation or immutable migration history; every hit is
reviewed rather than blindly replaced.

- [ ] **Step 5: Commit the documentation task**

```powershell
git add README.md docs/setup-supabase.md docs/superpowers/specs/2026-07-16-tyrone-control-center-design.md docs/superpowers/plans/2026-07-16-foundation-implementation.md scripts/foundation-docs.test.mjs
git commit -m "docs: update account capacity to ten"
```

---

### Task 6: Full verification, final search, push, and Draft PR

**Files:**
- Verify only: complete repository and generated build output.

**Interfaces:**
- Consumes: all previous task commits.
- Produces: a clean pushed feature branch and one Draft PR against `main`.

- [ ] **Step 1: Install exactly the lockfile dependencies**

```powershell
npm ci
```

Expected: exit code 0 under Node.js 22.12.0 or newer.

- [ ] **Step 2: Run the complete JavaScript/TypeScript verification**

```powershell
npm run check
npm run security:scan
```

Expected: lint, typecheck, all Vitest tests, production build, and secret scan
pass.

- [ ] **Step 3: Run local database verification**

```powershell
docker version
npx supabase db reset
npx supabase test db
```

Expected: Docker is reachable; all migrations apply to an empty database; all
pgTAP tests pass.

- [ ] **Step 4: Run all Edge Function tests**

```powershell
npx deno@2.9.3 test supabase/functions
```

Expected: every Deno test passes.

- [ ] **Step 5: Run relevant Playwright and Auth E2E tests**

With the local stack and four Functions running from the ignored local env
file, set only the documented local E2E variables in the process and run:

```powershell
$env:E2E_LOCAL_SUPABASE='true'
npm run test:e2e -- --project=desktop-chromium
```

Expected: navigation and full local Auth lifecycle pass, including the
concurrent ten/eleven boundary. Run the normal multi-project suite as well when
the local browser binaries are available:

```powershell
npm run test:e2e
```

- [ ] **Step 6: Audit the old limit and secrets**

```powershell
rg -n -i --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' "ACCOUNT_CAPACITY_REACHED|account_capacity|maximal vier|vier Konten|four-account|four active|fifth reservation|fifth account|>= 4|occupiedSlots >= 4" .
git grep -n -I -E "(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|password[[:space:]]*=)"
git diff --check main...HEAD
git status --short --branch
```

Expected: no unintended current four-account rule, no real secret value, no
whitespace error, and no unrelated working-tree change. The immutable
Foundation migration's old threshold and the new design's historical
comparison are documented as intentional search results.

- [ ] **Step 7: Push the feature branch**

```powershell
git push -u origin feat/increase-account-capacity
```

- [ ] **Step 8: Create one Draft PR against main**

Use a concise English title such as `Increase account capacity to ten` and a
body that lists the central database source, migration, boundary and concurrency
tests, all verification results, intentional historical search hits, and the
fact that no hosted database or production data was changed.

```powershell
$body = @'
## Summary
- Centralizes the ten-account limit in PostgreSQL.
- Adds an additive migration and updates settings to read database capacity.
- Covers the eleventh-slot and concurrent-invitation boundary.

## Verification
- Include every executed command and result from Steps 1–6.

## Deployment
- No hosted database or production data was changed.
'@
gh pr create --draft --base main --head feat/increase-account-capacity --title "Increase account capacity to ten" --body $body
```

Expected: exactly one new Draft PR; do not mark ready and do not merge.
