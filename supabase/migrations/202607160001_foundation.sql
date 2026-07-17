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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_deactivation_dates_check check (
    (status = 'deactivated' and deactivated_at is not null and deletion_scheduled_at is not null)
    or
    (status <> 'deactivated' and deactivated_at is null and deletion_scheduled_at is null)
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
  action text not null check (length(trim(action)) > 0),
  object_type text not null check (length(trim(object_type)) > 0),
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_actor_created_idx
  on public.activity_log (actor_id, created_at desc);

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

  return v_invitation_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id
    and status = 'pending'
    and auth_user_id is null;

  return found;
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
    deletion_scheduled_at = now() + interval '30 days'
  where id = p_user_id
  returning * into v_profile;

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
  set status = 'active', deactivated_at = null, deletion_scheduled_at = null
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
  order by profiles.deletion_scheduled_at
$$;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.activity_log enable row level security;

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

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.invitations to authenticated;
grant select on public.activity_log to authenticated;

grant all on public.profiles to service_role;
grant all on public.invitations to service_role;
grant all on public.activity_log to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.current_user_is_active() from public, anon;
revoke execute on function public.accept_current_invitation() from public, anon;
revoke execute on function public.reserve_invitation(text, public.app_role, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.revoke_invitation(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.deactivate_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.restore_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.list_cleanup_candidates() from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.accept_current_invitation() to authenticated;
grant execute on function public.reserve_invitation(text, public.app_role, uuid, timestamptz) to service_role;
grant execute on function public.revoke_invitation(uuid) to service_role;
grant execute on function public.deactivate_profile(uuid, uuid) to service_role;
grant execute on function public.restore_profile(uuid, uuid) to service_role;
grant execute on function public.list_cleanup_candidates() to service_role;
