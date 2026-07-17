create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.app_role as enum ('admin', 'member');
create type public.profile_status as enum ('invited', 'active', 'deactivated');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  display_name text,
  role public.app_role not null,
  status public.profile_status not null default 'invited',
  invitation_id uuid unique,
  deactivated_at timestamptz,
  deletion_scheduled_at timestamptz,
  cleanup_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_deactivation_dates_check check (
    (status = 'deactivated' and deactivated_at is not null and deletion_scheduled_at is not null)
    or
    (status <> 'deactivated' and deactivated_at is null and deletion_scheduled_at is null)
  ),
  constraint profiles_cleanup_claim_check check (
    cleanup_claimed_at is null or status = 'deactivated'
  )
);

create table public.invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  email extensions.citext not null,
  role public.app_role not null default 'member',
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_normalized_check check (email = lower(trim(email::text))::extensions.citext),
  constraint invitations_state_dates_check check (
    (status = 'accepted' and accepted_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null and accepted_at is null)
    or (status in ('pending', 'expired') and accepted_at is null and revoked_at is null)
  )
);

alter table public.profiles
  add constraint profiles_invitation_id_fkey
  foreign key (invitation_id) references public.invitations(id) on delete set null;

create unique index invitations_one_pending_email_idx
  on public.invitations (email)
  where status = 'pending';
create index invitations_status_expires_idx
  on public.invitations (status, expires_at);
create index profiles_status_role_idx
  on public.profiles (status, role);

create table public.activity_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_subject_id uuid,
  action text not null check (length(trim(action)) > 0),
  object_type text not null check (length(trim(object_type)) > 0),
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_actor_created_idx
  on public.activity_log (actor_id, created_at desc);

create index activity_log_actor_subject_created_idx
  on public.activity_log (actor_subject_id, created_at desc);

create table public.function_rate_limits (
  key_hash text primary key check (length(trim(key_hash)) > 0),
  bucket_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create trigger function_rate_limits_set_updated_at
before update on public.function_rate_limits
for each row execute function public.set_updated_at();

create or replace function public.set_activity_actor_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actor_subject_id = new.actor_id;
  return new;
end;
$$;

create trigger activity_log_set_actor_subject
before insert on public.activity_log
for each row execute function public.set_activity_actor_subject();

create or replace function public.audit_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (
    actor_id,
    actor_subject_id,
    action,
    object_type,
    object_id,
    metadata
  ) values (
    null,
    null,
    'profile.deleted',
    'profile',
    old.id,
    jsonb_build_object('scheduled', old.deletion_scheduled_at is not null)
  );
  return old;
end;
$$;

create trigger profiles_audit_final_deletion
before delete on public.profiles
for each row execute function public.audit_profile_deletion();

create or replace function public.consume_function_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_bucket_started_at timestamptz;
begin
  if trim(p_key_hash) = ''
    or p_limit < 1
    or p_limit > 1000
    or p_window_seconds < 1
    or p_window_seconds > 86400
  then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public.function_rate_limit:' || p_key_hash, 0)
  );

  select request_count, bucket_started_at
  into v_count, v_bucket_started_at
  from public.function_rate_limits
  where key_hash = p_key_hash
  for update;

  if not found then
    insert into public.function_rate_limits (key_hash)
    values (p_key_hash);
    return true;
  end if;

  if v_bucket_started_at <= now() - make_interval(secs => p_window_seconds) then
    update public.function_rate_limits
    set bucket_started_at = now(), request_count = 1
    where key_hash = p_key_hash;
    return true;
  end if;

  update public.function_rate_limits
  set request_count = request_count + 1
  where key_hash = p_key_hash
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and status = 'active'
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
$$;

create or replace function public.reserve_invitation(
  p_email text,
  p_role public.app_role default 'member',
  p_invited_by uuid default null,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(trim(p_email))::extensions.citext;
  v_reserved_count integer;
  v_invitation_id uuid;
begin
  if v_email::text = '' then
    raise exception using errcode = '22023', message = 'INVALID_EMAIL';
  end if;

  if p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVALID_EXPIRATION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.account_capacity', 0));

  update public.invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now()
    and auth_user_id is null;

  if p_role = 'admin' and (
    exists (
      select 1
      from public.profiles
      where role = 'admin'
        and status in ('invited', 'active')
    )
    or exists (
      select 1
      from public.invitations
      where role = 'admin'
        and status = 'pending'
        and expires_at > now()
    )
  ) then
    raise exception using errcode = 'P0001', message = 'BOOTSTRAP_CLOSED';
  end if;

  if exists (
    select 1
    from public.profiles
    where email = v_email
      and status in ('invited', 'active')
  ) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.invitations
    where email = v_email
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'INVITATION_ALREADY_PENDING';
  end if;

  select
    (select count(*) from public.profiles where status in ('invited', 'active'))
    +
    (select count(*) from public.invitations
      where status = 'pending' and expires_at > now() and auth_user_id is null)
  into v_reserved_count;

  if v_reserved_count >= 4 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_CAPACITY_REACHED';
  end if;

  insert into public.invitations (email, role, invited_by, expires_at)
  values (v_email, p_role, p_invited_by, p_expires_at)
  returning id into v_invitation_id;

  insert into public.activity_log (actor_id, action, object_type, object_id, metadata)
  values (
    p_invited_by,
    'invitation.created',
    'invitation',
    v_invitation_id,
    jsonb_build_object('role', p_role)
  );

  return v_invitation_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked boolean;
begin
  update public.invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id
    and status = 'pending'
    and auth_user_id is null;

  v_revoked := found;
  if v_revoked then
    insert into public.activity_log (action, object_type, object_id)
    values ('invitation.revoked', 'invitation', p_invitation_id);
  end if;

  return v_revoked;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  if new.email is null then
    raise exception using errcode = 'P0001', message = 'INVITATION_REQUIRED';
  end if;

  select *
  into v_invitation
  from public.invitations
  where email = lower(trim(new.email))::extensions.citext
    and status = 'pending'
    and expires_at > now()
    and auth_user_id is null
  order by created_at
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_REQUIRED';
  end if;

  update public.invitations
  set auth_user_id = new.id
  where id = v_invitation.id;

  insert into public.profiles (id, email, role, status, invitation_id)
  values (new.id, lower(trim(new.email))::extensions.citext, v_invitation.role, 'invited', v_invitation.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.accept_current_invitation()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.status = 'active' then
    return v_profile;
  end if;

  if v_profile.status <> 'invited' then
    raise exception using errcode = 'P0001', message = 'PROFILE_INACTIVE';
  end if;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_profile.invitation_id
    and auth_user_id = auth.uid()
    and status = 'pending'
    and expires_at > now();

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID_OR_EXPIRED';
  end if;

  update public.profiles
  set status = 'active'
  where id = auth.uid()
  returning * into v_profile;

  insert into public.activity_log (actor_id, action, object_type, object_id)
  values (auth.uid(), 'invitation.accepted', 'profile', auth.uid());

  return v_profile;
end;
$$;

create or replace function public.revoke_user_refresh_sessions(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from auth.sessions
  where user_id = p_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.deactivate_profile(
  p_user_id uuid,
  p_actor_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_active_admin_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.account_capacity', 0));

  if p_actor_id is not null then
    if p_actor_id = p_user_id then
      raise exception using errcode = 'P0001', message = 'SELF_DEACTIVATION_FORBIDDEN';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = p_actor_id and role = 'admin' and status = 'active'
    ) then
      raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
    end if;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.status = 'deactivated' then
    return v_profile;
  end if;

  if v_profile.role = 'admin' and v_profile.status = 'active' then
    select count(*) into v_active_admin_count
    from public.profiles
    where role = 'admin' and status = 'active';

    if v_active_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ACTIVE_ADMIN';
    end if;
  end if;

  update public.profiles
  set
    status = 'deactivated',
    deactivated_at = now(),
    deletion_scheduled_at = now() + interval '30 days',
    cleanup_claimed_at = null
  where id = p_user_id
  returning * into v_profile;

  perform public.revoke_user_refresh_sessions(p_user_id);

  update public.invitations
  set status = 'revoked', revoked_at = now()
  where id = v_profile.invitation_id
    and status = 'pending';

  insert into public.activity_log (actor_id, action, object_type, object_id, metadata)
  values (
    p_actor_id,
    'profile.deactivated',
    'profile',
    p_user_id,
    jsonb_build_object('deletion_scheduled_at', v_profile.deletion_scheduled_at)
  );

  return v_profile;
end;
$$;

create or replace function public.restore_profile(
  p_user_id uuid,
  p_actor_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_reserved_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.account_capacity', 0));

  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.status <> 'deactivated' then
    return v_profile;
  end if;

  if not exists (
    select 1
    from public.invitations
    where id = v_profile.invitation_id
      and auth_user_id = v_profile.id
      and status = 'accepted'
  ) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_RESTORABLE';
  end if;

  if v_profile.cleanup_claimed_at is not null
    and v_profile.cleanup_claimed_at > now() - interval '15 minutes'
  then
    raise exception using errcode = 'P0001', message = 'CLEANUP_IN_PROGRESS';
  end if;

  select
    (select count(*) from public.profiles where status in ('invited', 'active'))
    +
    (select count(*) from public.invitations
      where status = 'pending' and expires_at > now() and auth_user_id is null)
  into v_reserved_count;

  if v_reserved_count >= 4 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_CAPACITY_REACHED';
  end if;

  update public.profiles
  set
    status = 'active',
    deactivated_at = null,
    deletion_scheduled_at = null,
    cleanup_claimed_at = null
  where id = p_user_id
  returning * into v_profile;

  insert into public.activity_log (actor_id, action, object_type, object_id)
  values (p_actor_id, 'profile.restored', 'profile', p_user_id);

  return v_profile;
end;
$$;

create or replace function public.list_cleanup_candidates()
returns table (
  user_id uuid,
  email text,
  deletion_scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select id, email::text, profiles.deletion_scheduled_at
  from public.profiles
  where status = 'deactivated'
    and profiles.deletion_scheduled_at <= now()
    and (
      profiles.cleanup_claimed_at is null
      or profiles.cleanup_claimed_at <= now() - interval '15 minutes'
    )
  order by profiles.deletion_scheduled_at
$$;

create or replace function public.claim_cleanup_candidate(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.account_capacity', 0));

  update public.profiles
  set cleanup_claimed_at = now()
  where id = p_user_id
    and status = 'deactivated'
    and deletion_scheduled_at <= now()
    and (
      cleanup_claimed_at is null
      or cleanup_claimed_at <= now() - interval '15 minutes'
    );

  v_claimed := found;
  if v_claimed then
    insert into public.activity_log (action, object_type, object_id)
    values ('profile.cleanup_started', 'profile', p_user_id);
  end if;

  return v_claimed;
end;
$$;

create or replace function public.release_cleanup_claim(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.account_capacity', 0));

  update public.profiles
  set cleanup_claimed_at = null
  where id = p_user_id
    and status = 'deactivated'
    and cleanup_claimed_at is not null;

  v_released := found;
  if v_released then
    insert into public.activity_log (action, object_type, object_id)
    values ('profile.cleanup_failed', 'profile', p_user_id);
  end if;

  return v_released;
end;
$$;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.activity_log enable row level security;
alter table public.function_rate_limits enable row level security;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    public.current_user_is_active()
    and public.current_user_role() = 'admin'
  )
);

create policy profiles_update_own_display_name
on public.profiles
for update
to authenticated
using (id = auth.uid() and status in ('invited', 'active'))
with check (id = auth.uid() and status in ('invited', 'active'));

create policy invitations_select_active_admin
on public.invitations
for select
to authenticated
using (
  public.current_user_is_active()
  and public.current_user_role() = 'admin'
);

create policy activity_log_select_actor_or_admin
on public.activity_log
for select
to authenticated
using (
  actor_id = auth.uid()
  or (
    public.current_user_is_active()
    and public.current_user_role() = 'admin'
  )
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.invitations from anon, authenticated;
revoke all on public.activity_log from anon, authenticated;
revoke all on public.function_rate_limits from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.invitations to authenticated;
grant select on public.activity_log to authenticated;

grant all on public.profiles to service_role;
grant all on public.invitations to service_role;
grant all on public.activity_log to service_role;
grant all on public.function_rate_limits to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_activity_actor_subject() from public, anon, authenticated;
revoke execute on function public.audit_profile_deletion() from public, anon, authenticated;
revoke execute on function public.consume_function_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.current_user_is_active() from public, anon;
revoke execute on function public.accept_current_invitation() from public, anon;
revoke execute on function public.reserve_invitation(text, public.app_role, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.revoke_invitation(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.deactivate_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.restore_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.list_cleanup_candidates() from public, anon, authenticated;
revoke execute on function public.claim_cleanup_candidate(uuid) from public, anon, authenticated;
revoke execute on function public.release_cleanup_claim(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_user_refresh_sessions(uuid) from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.accept_current_invitation() to authenticated;
grant execute on function public.reserve_invitation(text, public.app_role, uuid, timestamptz) to service_role;
grant execute on function public.revoke_invitation(uuid) to service_role;
grant execute on function public.deactivate_profile(uuid, uuid) to service_role;
grant execute on function public.restore_profile(uuid, uuid) to service_role;
grant execute on function public.list_cleanup_candidates() to service_role;
grant execute on function public.claim_cleanup_candidate(uuid) to service_role;
grant execute on function public.release_cleanup_claim(uuid) to service_role;
grant execute on function public.revoke_user_refresh_sessions(uuid) to service_role;
grant execute on function public.consume_function_rate_limit(text, integer, integer) to service_role;
