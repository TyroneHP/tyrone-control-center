begin;

create extension if not exists pgtap with schema extensions;

select plan(112);

select has_type('public', 'app_role', 'app_role enum exists');
select has_type('public', 'profile_status', 'profile_status enum exists');
select has_type('public', 'invitation_status', 'invitation_status enum exists');

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'invitations', 'invitations table exists');
select has_table('public', 'activity_log', 'activity_log table exists');
select has_table('public', 'function_rate_limits', 'server rate-limit table exists');

select columns_are(
  'public',
  'profiles',
  array[
    'id', 'email', 'display_name', 'role', 'status', 'invitation_id',
    'deactivated_at', 'deletion_scheduled_at', 'cleanup_claimed_at',
    'created_at', 'updated_at'
  ],
  'profiles exposes only foundation columns'
);
select columns_are(
  'public',
  'invitations',
  array[
    'id', 'email', 'role', 'status', 'invited_by', 'auth_user_id',
    'expires_at', 'accepted_at', 'revoked_at', 'created_at', 'updated_at'
  ],
  'invitations exposes only foundation columns'
);
select columns_are(
  'public',
  'activity_log',
    array[
      'id', 'actor_id', 'actor_subject_id', 'action', 'object_type', 'object_id',
      'metadata', 'created_at'
    ],
    'activity_log exposes only audit columns'
  );
select columns_are(
  'public',
  'function_rate_limits',
  array['key_hash', 'bucket_started_at', 'request_count', 'updated_at'],
  'rate-limit table contains only server-side bucket fields'
);

select has_function('public', 'current_user_role', array[]::text[], 'role helper exists');
select has_function('public', 'current_user_is_active', array[]::text[], 'active helper exists');
select has_function(
  'public',
  'reserve_invitation',
  array['text', 'app_role', 'uuid', 'timestamp with time zone'],
  'reservation function exists'
);
select has_function(
  'public',
  'revoke_invitation',
  array['uuid'],
  'reservation rollback function exists'
);
select has_function(
  'public',
  'accept_current_invitation',
  array[]::text[],
  'invitation acceptance function exists'
);
select has_function(
  'public',
  'deactivate_profile',
  array['uuid', 'uuid'],
  'deactivation function exists'
);
select has_function(
  'public',
  'restore_profile',
  array['uuid', 'uuid'],
  'restore function exists'
);
select has_function(
  'public',
  'list_cleanup_candidates',
  array[]::text[],
  'cleanup candidate function exists'
);
select has_function(
  'public',
  'claim_cleanup_candidate',
  array['uuid'],
  'cleanup claim function exists'
);
select has_function(
  'public',
  'release_cleanup_claim',
  array['uuid'],
  'cleanup claim release function exists'
);
select has_function(
  'public',
  'revoke_user_refresh_sessions',
  array['uuid'],
  'refresh-session revocation function exists'
);
select has_function(
  'public',
  'consume_function_rate_limit',
  array['text', 'integer', 'integer'],
  'transactional rate-limit function exists'
);
select has_function(
  'public',
  'set_activity_actor_subject',
  array[]::text[],
  'immutable audit actor snapshot function exists'
);
select has_function(
  'public',
  'audit_profile_deletion',
  array[]::text[],
  'final profile-deletion audit function exists'
);
select has_trigger(
  'public',
  'activity_log',
  'activity_log_set_actor_subject',
  'activity audit snapshots actor identity'
);
select has_trigger(
  'public',
  'profiles',
  'profiles_audit_final_deletion',
  'profile final deletion is audited transactionally'
);
select matches(
  pg_get_functiondef('public.deactivate_profile(uuid, uuid)'::regprocedure),
  'revoke_user_refresh_sessions',
  'deactivation revokes refresh sessions in the same transaction'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
  'invitations has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_log'::regclass),
  'activity_log has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.function_rate_limits'::regclass),
  'function_rate_limits has RLS enabled'
);

select policies_are(
  'public',
  'profiles',
  array['profiles_select_own_or_admin', 'profiles_update_own_display_name'],
  'profiles has exact foundation policies'
);
select policies_are(
  'public',
  'invitations',
  array['invitations_select_active_admin'],
  'invitations has exact foundation policies'
);
select policies_are(
  'public',
  'activity_log',
  array['activity_log_select_actor_or_admin'],
  'activity_log has exact foundation policies'
);
select policies_are(
  'public',
  'function_rate_limits',
  array[]::text[],
  'function_rate_limits has no client policies'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated users can select profiles through RLS'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'),
  'authenticated users can update display_name'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'),
  'authenticated users cannot update role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'status', 'update'),
  'authenticated users cannot update status'
);
select ok(
  has_table_privilege('authenticated', 'public.invitations', 'select'),
  'authenticated users can select allowed invitations through RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.activity_log', 'select'),
  'authenticated users can select allowed audit events through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.function_rate_limits', 'select'),
  'authenticated users cannot inspect rate-limit buckets'
);
select ok(
  has_table_privilege('service_role', 'public.function_rate_limits', 'select'),
  'service role can inspect rate-limit buckets'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_invitation(text, app_role, uuid, timestamp with time zone)',
    'execute'
  ),
  'authenticated users cannot reserve invitations directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.deactivate_profile(uuid, uuid)', 'execute'),
  'authenticated users cannot deactivate profiles directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.restore_profile(uuid, uuid)', 'execute'),
  'authenticated users cannot restore profiles directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_invitation(text, app_role, uuid, timestamp with time zone)',
    'execute'
  ),
  'service role can reserve invitations'
);
select ok(
  has_function_privilege('service_role', 'public.deactivate_profile(uuid, uuid)', 'execute'),
  'service role can deactivate profiles'
);
select ok(
  not has_function_privilege('authenticated', 'public.revoke_user_refresh_sessions(uuid)', 'execute'),
  'authenticated users cannot revoke refresh sessions directly'
);
select ok(
  has_function_privilege('service_role', 'public.revoke_user_refresh_sessions(uuid)', 'execute'),
  'service role can revoke refresh sessions'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_cleanup_candidate(uuid)', 'execute'),
  'authenticated users cannot claim cleanup candidates'
);
select ok(
  not has_function_privilege('authenticated', 'public.release_cleanup_claim(uuid)', 'execute'),
  'authenticated users cannot release cleanup claims'
);
select ok(
  has_function_privilege('service_role', 'public.claim_cleanup_candidate(uuid)', 'execute'),
  'service role can claim cleanup candidates'
);
select ok(
  has_function_privilege('service_role', 'public.release_cleanup_claim(uuid)', 'execute'),
  'service role can release cleanup claims'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_function_rate_limit(text, integer, integer)',
    'execute'
  ),
  'authenticated users cannot consume rate limits directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_function_rate_limit(text, integer, integer)',
    'execute'
  ),
  'service role can consume rate limits'
);
select ok(
  not has_function_privilege('authenticated', 'public.set_activity_actor_subject()', 'execute'),
  'authenticated users cannot invoke the audit snapshot trigger function'
);
select ok(
  not has_function_privilege('authenticated', 'public.audit_profile_deletion()', 'execute'),
  'authenticated users cannot invoke final deletion auditing'
);

select is(
  public.consume_function_rate_limit('test-rate-key', 2, 60),
  true,
  'first request consumes an available rate-limit slot'
);
select is(
  public.consume_function_rate_limit('test-rate-key', 2, 60),
  true,
  'second request consumes the final available rate-limit slot'
);
select is(
  public.consume_function_rate_limit('test-rate-key', 2, 60),
  false,
  'request above the configured limit is rejected'
);

select lives_ok(
  $$select public.reserve_invitation('admin@example.test', 'admin', null, now() + interval '7 days')$$,
  'service operation can reserve the bootstrap administrator'
);
select lives_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
      'authenticated', 'authenticated', 'admin@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $$,
  'reserved administrator auth user is accepted by the trigger'
);

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';
select lives_ok(
  $$select public.accept_current_invitation()$$,
  'administrator can accept the current invitation'
);
select throws_ok(
  $$select public.reserve_invitation('second-admin@example.test', 'admin', null, now() + interval '7 days')$$,
  'P0001',
  'BOOTSTRAP_CLOSED',
  'a second bootstrap administrator reservation is rejected'
);

select lives_ok(
  $$select public.reserve_invitation('member1@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'first member slot can be reserved'
);
select lives_ok(
  $$select public.reserve_invitation('member2@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'second member slot can be reserved'
);
select lives_ok(
  $$select public.reserve_invitation('member3@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'third member slot can be reserved'
);
select is(
  (select count(*) from public.activity_log where action = 'invitation.created'),
  4::bigint,
  'every successful reservation is audited in its database transaction'
);
select throws_ok(
  $$select public.reserve_invitation('member4@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'P0001',
  'ACCOUNT_CAPACITY_REACHED',
  'fifth account reservation is rejected transactionally'
);
select throws_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '99999999-9999-9999-9999-999999999999',
      'authenticated', 'authenticated', 'uninvited@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $$,
  'P0001',
  'INVITATION_REQUIRED',
  'uninvited auth users are rejected'
);
select lives_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '22222222-2222-2222-2222-222222222222',
      'authenticated', 'authenticated', 'member1@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $$,
  'reserved member auth user is accepted by the trigger'
);

set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select lives_ok(
  $$select public.accept_current_invitation()$$,
  'member can accept the current invitation'
);
select throws_ok(
  $$select public.deactivate_profile('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')$$,
  'P0001',
  'SELF_DEACTIVATION_FORBIDDEN',
  'administrator cannot deactivate the own account'
);
select throws_ok(
  $$select public.deactivate_profile('11111111-1111-1111-1111-111111111111', null)$$,
  'P0001',
  'LAST_ACTIVE_ADMIN',
  'last active administrator cannot be deactivated'
);
select lives_ok(
  $$select public.deactivate_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'administrator can deactivate a member'
);
select is(
  (select status from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'deactivated'::public.profile_status,
  'deactivation changes profile status immediately'
);
select ok(
  (select
    deactivated_at is not null
    and deletion_scheduled_at >= deactivated_at + interval '30 days'
   from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'),
  'deactivation schedules deletion after the grace period'
);
select lives_ok(
  $$select public.reserve_invitation('replacement@example.test', 'member', '11111111-1111-1111-1111-111111111111', now() + interval '7 days')$$,
  'deactivation frees an account slot immediately'
);
select throws_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'P0001',
  'ACCOUNT_CAPACITY_REACHED',
  'restore consumes a free slot transactionally'
);
select lives_ok(
  $$select public.revoke_invitation((select id from public.invitations where email = 'replacement@example.test'))$$,
  'replacement reservation can be released'
);
select is(
  (select count(*) from public.activity_log where action = 'invitation.revoked'),
  1::bigint,
  'reservation compensation is audited transactionally'
);
select lives_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'administrator can restore a member when a slot is free'
);
select ok(
  (select
    status = 'active'
    and deactivated_at is null
    and deletion_scheduled_at is null
   from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'),
  'restore clears all grace-period fields'
);

select lives_ok(
  $setup$
    do $$
    begin
      perform public.deactivate_profile(
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111'
      );
      update public.profiles
      set deletion_scheduled_at = now() - interval '1 minute'
      where id = '22222222-2222-2222-2222-222222222222';
    end
    $$
  $setup$,
  'a due deactivated profile can be prepared for cleanup'
);
select is(
  public.claim_cleanup_candidate('22222222-2222-2222-2222-222222222222'),
  true,
  'cleanup claims a still-due deactivated profile atomically'
);
select throws_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'P0001',
  'CLEANUP_IN_PROGRESS',
  'restore cannot race an active cleanup claim'
);
select lives_ok(
  $$update public.profiles set cleanup_claimed_at = now() - interval '16 minutes' where id = '22222222-2222-2222-2222-222222222222'$$,
  'a stale cleanup claim can be simulated'
);
select lives_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'a stale cleanup claim does not block restoration indefinitely'
);
select lives_ok(
  $setup$
    do $$
    begin
      perform public.deactivate_profile(
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111'
      );
      update public.profiles
      set deletion_scheduled_at = now() - interval '1 minute'
      where id = '22222222-2222-2222-2222-222222222222';
    end
    $$
  $setup$,
  'a retryable cleanup candidate can be prepared'
);
select is(
  public.claim_cleanup_candidate('22222222-2222-2222-2222-222222222222'),
  true,
  'retryable cleanup candidate is claimed'
);
select is(
  public.release_cleanup_claim('22222222-2222-2222-2222-222222222222'),
  true,
  'a failed auth deletion can release the cleanup claim'
);
select is(
  (select count(*) from public.activity_log where action = 'profile.cleanup_started'),
  2::bigint,
  'every claimed final-deletion attempt is audited transactionally'
);
select is(
  (select count(*) from public.activity_log where action = 'profile.cleanup_failed'),
  1::bigint,
  'a released cleanup claim records a durable failure event'
);
select lives_ok(
  $$select public.restore_profile('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'a released cleanup claim allows restoration'
);

select lives_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '33333333-3333-3333-3333-333333333333',
      'authenticated', 'authenticated', 'member2@example.test', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  $$,
  'a second reserved member can reach invited profile state'
);
select lives_ok(
  $$select public.deactivate_profile('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')$$,
  'administrator can cancel an invited profile through deactivation'
);
select throws_ok(
  $$select public.restore_profile('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')$$,
  'P0001',
  'PROFILE_NOT_RESTORABLE',
  'an invitation that was never accepted cannot be restored as active'
);
select lives_ok(
  $$delete from auth.users where id = '33333333-3333-3333-3333-333333333333'$$,
  'cancelled invited auth user can be removed'
);

set local role authenticated;
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'member sees only the own profile'
);
select is(
  (select count(*) from public.invitations),
  0::bigint,
  'member sees no invitations'
);
select is(public.current_user_role(), 'member'::public.app_role, 'member role is read from profile');
select lives_ok(
  $$update public.profiles set display_name = 'Member One' where id = auth.uid()$$,
  'member can update the own display name'
);
reset role;

set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select is((select count(*) from public.profiles), 2::bigint, 'admin sees all profiles');
select is((select count(*) from public.invitations), 5::bigint, 'admin sees all invitation states');
select is(
  (select count(*) from public.activity_log where action = 'invitation.accepted'),
  2::bigint,
  'admin sees acceptance audit events'
);
reset role;

select is(
  (
    select count(*)
    from public.activity_log
    where action = 'invitation.accepted'
      and actor_subject_id = actor_id
  ),
  2::bigint,
  'audit events retain an immutable actor subject snapshot'
);
select lives_ok(
  $$delete from auth.users where id = '22222222-2222-2222-2222-222222222222'$$,
  'final Auth deletion cascades through the profile'
);
select is(
  (
    select actor_id
    from public.activity_log
    where action = 'invitation.accepted'
      and actor_subject_id = '22222222-2222-2222-2222-222222222222'
  ),
  null::uuid,
  'deleted actors no longer retain a live profile foreign key'
);
select is(
  (
    select count(*)
    from public.activity_log
    where actor_subject_id = '22222222-2222-2222-2222-222222222222'
      and action = 'invitation.accepted'
  ),
  1::bigint,
  'deleted actors retain immutable historical attribution'
);
select is(
  (
    select count(*)
    from public.activity_log
    where action = 'profile.deleted'
      and object_id = '22222222-2222-2222-2222-222222222222'
  ),
  1::bigint,
  'scheduled profile deletion writes a durable audit event'
);

select * from finish();
rollback;
