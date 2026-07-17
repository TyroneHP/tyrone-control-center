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
returns table (
  occupied_slots integer,
  maximum_slots integer
)
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
  select
    public.account_capacity_occupied(),
    public.account_capacity_limit();
end;
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

  v_reserved_count := public.account_capacity_occupied();

  if v_reserved_count >= public.account_capacity_limit() then
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

  v_reserved_count := public.account_capacity_occupied();

  if v_reserved_count >= public.account_capacity_limit() then
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

revoke execute on function public.account_capacity_limit()
from public, anon, authenticated;
revoke execute on function public.account_capacity_occupied()
from public, anon, authenticated;
revoke execute on function public.get_account_capacity()
from public, anon;

grant execute on function public.account_capacity_limit() to service_role;
grant execute on function public.account_capacity_occupied() to service_role;
grant execute on function public.get_account_capacity()
to authenticated, service_role;
