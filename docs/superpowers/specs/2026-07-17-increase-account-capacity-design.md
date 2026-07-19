# Ten-Account Capacity Design

**Date:** 2026-07-17
**Status:** Approved

## Objective

Increase the CoreGrid account capacity from four to ten occupied
or reserved accounts. The existing administrator remains one occupied slot, so
an administrator can invite up to nine additional members. Existing accounts,
invitations, roles, permissions, and account lifecycle behavior remain
unchanged.

## Scope

This change covers only the account-capacity rule and the places that display,
enforce, test, or document it. It does not introduce public registration, an
account-capacity settings screen, new roles, new invitation behavior, or any
unrelated user-management changes.

## Architecture

PostgreSQL remains the authoritative source for account capacity. A new
additive migration introduces a database-owned capacity limit of ten and a
database function that returns both the current occupied-slot count and the
maximum. The existing transactional reservation and restoration functions use
the same database-owned limit while retaining the existing advisory lock.

The browser does not define its own maximum. The settings API loads the
database capacity state together with profiles and invitations, and the
settings page uses that state for its counter and local button disabling. A
stale browser can never bypass the limit because every invitation and
restoration is still checked atomically in PostgreSQL.

Edge Functions do not duplicate the number. They continue to call the
database reservation and restoration RPCs and preserve
`ACCOUNT_CAPACITY_REACHED`. Their German error text describes all available
slots as occupied without embedding a second numeric constant.

## Database Design

The additive migration creates these database interfaces:

- `public.account_capacity_limit() returns integer` is the single definition
  of the maximum and returns `10`.
- `public.account_capacity_occupied() returns integer` applies the existing
  counting rule: profiles in `invited` or `active` state plus unclaimed,
  unexpired, pending invitations.
- `public.get_account_capacity() returns table (occupied_slots integer,
  maximum_slots integer)` exposes the state to an active administrator.

The internal limit and counting functions are not executable by `anon` or
`authenticated`. The state RPC is executable by `authenticated`, but it checks
that the caller is an active administrator before returning data. Existing RLS
policies remain unchanged.

The migration replaces the bodies of `public.reserve_invitation` and
`public.restore_profile` without changing their signatures or grants. Both
functions keep `pg_advisory_xact_lock(hashtextextended(
'public.account_capacity', 0))`, count occupied slots after acquiring that
lock, and reject when the occupied count is at least the database-owned limit.
This preserves serialized, atomic admission when invitations or restorations
arrive concurrently.

The migration does not update or delete any account, invitation, profile, or
audit row. It can be applied after the existing Foundation migration and as
part of a fresh database reset. The already-applied Foundation migration is
not edited.

## Capacity Semantics

The following entries consume capacity:

- the active administrator account;
- active member profiles;
- invited member profiles;
- pending, unexpired invitation reservations that do not yet have an auth
  user.

The following entries do not consume capacity, matching existing behavior:

- deactivated profiles;
- revoked invitations;
- expired invitations;
- pending invitations that have already become an invited profile, because
  the profile is counted instead.

Slots one through ten are valid. An attempt to reserve or restore an eleventh
occupied slot fails with `ACCOUNT_CAPACITY_REACHED`. Deactivating a profile,
revoking a reservation, or allowing an unclaimed reservation to expire frees
the slot for reuse.

## Frontend Design

`SettingsApi.listAccounts()` returns profiles, invitations, and the database
capacity state. The settings page displays `<occupied> von <maximum>` and uses
`occupied >= maximum` to disable invitations and restorations. It no longer
recomputes the authoritative occupied count or embeds the maximum in
TypeScript.

Visible German copy is updated to describe ten total accounts and a reserved
slot. At capacity, the page explains that all ten account slots are occupied
or reserved. No layout, navigation, or other visual treatment changes.

The local capacity state is advisory for user experience only. If it becomes
stale, the Edge Function response remains authoritative and the existing
`AccountFunctionError` path displays the safe server error.

## Error Handling

The database continues to raise `ACCOUNT_CAPACITY_REACHED` with SQLSTATE
`P0001`. Edge Functions continue to map it to HTTP 409. The safe German Edge
Function message becomes:

`Alle verfügbaren Kontoplätze sind bereits belegt oder reserviert.`

The settings page uses the database maximum for its normal at-capacity copy.
Unknown service errors remain redacted. No database details or secrets are
returned to the browser.

## Testing Strategy

Database tests prove that:

- the central limit is ten;
- the administrator consumes the first slot;
- nine additional member slots can be reserved;
- the eleventh reservation fails with `ACCOUNT_CAPACITY_REACHED`;
- pending reservations count toward capacity;
- expired, revoked, and deactivated records release capacity;
- released capacity can be reused by a new reservation or restoration;
- the advisory lock remains in both capacity-changing functions.

Frontend unit tests prove that the API loads database capacity state, that
invitations remain enabled at nine of ten, that they are disabled at ten of
ten, and that the counter and German messages use the returned maximum.

The local Auth E2E lifecycle bootstraps the administrator, fills eight member
slots, and sends two invitation requests nearly simultaneously while nine
slots are occupied. Exactly one request must succeed and the other must return
HTTP 409 with `ACCOUNT_CAPACITY_REACHED`; the final state must be ten of ten.
The existing member authorization, deactivation, restoration, and login checks
remain part of the lifecycle.

Deno tests continue to verify safe error mapping and are updated to remove the
old numeric wording. The complete verification includes npm checks, secret
scanning, local database reset, pgTAP database tests, all Deno Edge Function
tests, and the relevant Playwright/Auth E2E tests.

## Documentation

README, hosted/local Supabase setup documentation, the approved product design,
and the Foundation implementation plan are updated to state ten total accounts:
one administrator plus up to nine additional members. The historical
Foundation migration remains unchanged even though it contains the original
numeric check; this is an intentional migration-history occurrence, not a
current requirement.

A repository-wide search classifies every remaining standalone occurrence of
the old number instead of replacing unrelated uses blindly. No current
capacity text or test description may retain the four-account rule.

## Security and Deployment Constraints

- No secret, token, password, or real credential is added to the repository or
  printed in reports.
- No service-role credential is exposed to the frontend.
- Public registration remains disabled and invitation-only onboarding remains
  unchanged.
- Existing RLS, function grants, CORS checks, origin allowlists, and audit
  behavior remain in force.
- The feature is delivered through `feat/increase-account-capacity` and a new
  draft pull request against `main`; it is not merged as part of this work.
- The hosted database and production data are not changed during feature
  implementation or verification.
