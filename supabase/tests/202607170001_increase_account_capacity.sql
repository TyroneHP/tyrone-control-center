begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_function(
  'public',
  'account_capacity_limit',
  array[]::text[],
  'central account capacity limit function exists'
);
select has_function(
  'public',
  'account_capacity_occupied',
  array[]::text[],
  'central occupied account count function exists'
);
select has_function(
  'public',
  'get_account_capacity',
  array[]::text[],
  'administrator account capacity state function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.account_capacity_limit()',
    'execute'
  ),
  'authenticated users cannot execute the internal capacity limit function'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.account_capacity_occupied()',
    'execute'
  ),
  'authenticated users cannot execute the internal occupied count function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_account_capacity()',
    'execute'
  ),
  'anonymous users cannot read account capacity state'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_account_capacity()',
    'execute'
  ),
  'authenticated administrators can invoke account capacity state'
);

select is(
  public.account_capacity_limit(),
  10,
  'database owns a ten-account limit'
);
select is(
  public.account_capacity_occupied(),
  0,
  'empty database starts with no occupied account slots'
);

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
select is(
  (select occupied_slots from public.get_account_capacity()),
  1,
  'administrator consumes the first occupied slot'
);
select is(
  (select maximum_slots from public.get_account_capacity()),
  10,
  'administrator capacity state returns the central maximum'
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
    $$;
  $test$,
  'member slots two through ten can be reserved'
);
select is(
  public.account_capacity_occupied(),
  10,
  'administrator and nine reservations fill ten slots'
);
select is(
  (select count(*) from public.profiles where status in ('invited', 'active')),
  1::bigint,
  'administrator profile is included in occupied capacity'
);
select is(
  (
    select count(*)
    from public.invitations
    where status = 'pending'
      and expires_at > now()
      and auth_user_id is null
  ),
  9::bigint,
  'nine pending invitation reservations consume capacity'
);
select throws_ok(
  $$select public.reserve_invitation('member10@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'P0001',
  'ACCOUNT_CAPACITY_REACHED',
  'the eleventh occupied or reserved account is rejected'
);

select lives_ok(
  $test$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '22222222-2222-2222-2222-222222222222',
      'authenticated', 'authenticated', 'member1@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $test$,
  'reserved member can create an auth user without consuming a second slot'
);

set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$select public.accept_current_invitation()$$,
  'reserved member can activate the existing occupied slot'
);
select throws_ok(
  $$select * from public.get_account_capacity()$$,
  '42501',
  'ADMIN_REQUIRED',
  'active members cannot read administrator capacity state'
);

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$select public.deactivate_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'administrator can deactivate a member at capacity'
);
select is(
  public.account_capacity_occupied(),
  9,
  'deactivated member releases an occupied slot'
);
select lives_ok(
  $$select public.reserve_invitation('replacement@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'released slot can be reserved immediately'
);
select is(
  public.account_capacity_occupied(),
  10,
  'replacement invitation consumes the released slot'
);
select throws_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'P0001',
  'ACCOUNT_CAPACITY_REACHED',
  'restoration cannot exceed ten occupied slots'
);
select lives_ok(
  $$select public.revoke_invitation((select id from public.invitations where email = 'replacement@example.test'))$$,
  'replacement reservation can be revoked'
);
select is(
  public.account_capacity_occupied(),
  9,
  'revoked reservation releases its slot'
);
select lives_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'released slot can restore the deactivated member'
);
select is(
  public.account_capacity_occupied(),
  10,
  'restored member consumes the released slot'
);

select lives_ok(
  $$update public.invitations set expires_at = now() - interval '1 second' where email = 'member2@example.test'$$,
  'pending reservation can reach its expiration time'
);
select is(
  public.account_capacity_occupied(),
  9,
  'expired pending reservation no longer consumes capacity'
);
select lives_ok(
  $$select public.reserve_invitation('after-expiration@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'expired reservation slot can be reused'
);
select is(
  public.account_capacity_occupied(),
  10,
  'reused expired slot returns capacity to ten'
);
select is(
  (select status from public.invitations where email = 'member2@example.test'),
  'expired'::public.invitation_status,
  'reservation cleanup marks the expired invitation'
);

select * from finish();
rollback;
