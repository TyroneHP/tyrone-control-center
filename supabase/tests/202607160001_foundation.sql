begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

select has_type('public', 'app_role', 'app_role enum exists');
select has_type('public', 'profile_status', 'profile_status enum exists');
select has_type('public', 'invitation_status', 'invitation_status enum exists');

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'invitations', 'invitations table exists');
select has_table('public', 'activity_log', 'activity_log table exists');

select columns_are(
  'public',
  'profiles',
  array[
    'id', 'email', 'display_name', 'role', 'status', 'invitation_id',
    'deactivated_at', 'deletion_scheduled_at', 'created_at', 'updated_at'
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
  array['id', 'actor_id', 'action', 'object_type', 'object_id', 'metadata', 'created_at'],
  'activity_log exposes only audit columns'
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
  $$select public.deactivate_profile('11111111-1111-1111-1111-111111111111', null)$$,
  'P0001',
  'LAST_ACTIVE_ADMIN',
  'last active administrator cannot be deactivated'
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
select is((select count(*) from public.invitations), 4::bigint, 'admin sees all invitation states');
select is((select count(*) from public.activity_log), 2::bigint, 'admin sees acceptance audit events');
reset role;

select * from finish();
rollback;
