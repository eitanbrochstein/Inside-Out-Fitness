-- Phase 2: coaching. Purely additive: new tables, columns and permissive policies.
-- A coach reads an active client's data; clients keep full ownership of their own rows.

alter table public.profiles add column is_coach boolean not null default false;

create table public.coach_clients (
  coach_id uuid not null references public.profiles on delete cascade,
  client_id uuid not null references public.profiles on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  primary key (coach_id, client_id),
  check (coach_id <> client_id)
);

create index coach_clients_client on public.coach_clients (client_id);

-- Short codes without look-alike characters (no 0/O, 1/I).
create function public.new_invite_code() returns text
language sql volatile security definer set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
  from extensions.gen_random_bytes(8) as b, generate_series(0, 7) as i
$$;

-- Single-use invites the coach shares however they like (message, email, in person).
create table public.coach_invites (
  code text primary key default public.new_invite_code(),
  coach_id uuid not null default auth.uid() references public.profiles on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles on delete set null,
  accepted_at timestamptz
);

alter table public.workouts
  add column assigned_by uuid references public.profiles on delete set null,
  add column assigned_at timestamptz;

create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts on delete cascade,
  owner_id uuid not null references auth.users on delete cascade, -- the workout's owner, copied by trigger
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index workout_comments_workout on public.workout_comments (workout_id, created_at);

create function public.inherit_comment_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  select w.owner_id into new.owner_id from public.workouts w where w.id = new.workout_id;
  return new;
end $$;

create trigger workout_comments_owner before insert on public.workout_comments
  for each row execute function public.inherit_comment_owner();

-- Relationship lookups. Security definer so policies can call them without recursing through RLS.
create function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select client_id from public.coach_clients where coach_id = auth.uid() and status = 'active'
$$;

create function public.my_coach_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select coach_id from public.coach_clients where client_id = auth.uid() and status = 'active'
$$;

create function public.is_coach_of(p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and client_id = p_client and status = 'active'
  )
$$;

-- ---------- policies ----------

alter table public.coach_clients enable row level security;
alter table public.coach_invites enable row level security;
alter table public.workout_comments enable row level security;

create policy "coach_clients: either side reads" on public.coach_clients
  for select to authenticated using (coach_id = (select auth.uid()) or client_id = (select auth.uid()));
-- Either side can end the relationship (column grant below limits updates to status).
create policy "coach_clients: either side updates" on public.coach_clients
  for update to authenticated
  using (coach_id = (select auth.uid()) or client_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) or client_id = (select auth.uid()));

create policy "coach_invites: coach manages own" on public.coach_invites
  for select to authenticated using (coach_id = (select auth.uid()));
create policy "coach_invites: coaches create" on public.coach_invites
  for insert to authenticated with check (
    coach_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and is_coach)
  );
create policy "coach_invites: coach revokes" on public.coach_invites
  for delete to authenticated using (coach_id = (select auth.uid()));

create policy "profiles: coach and clients read each other" on public.profiles
  for select to authenticated using (
    id in (select public.my_client_ids()) or id in (select public.my_coach_ids())
  );

create policy "workouts: coach reads clients" on public.workouts
  for select to authenticated using (owner_id in (select public.my_client_ids()));
-- A coach can take back an assignment the client hasn't started.
create policy "workouts: coach removes unstarted assignment" on public.workouts
  for delete to authenticated using (
    assigned_by = (select auth.uid()) and status = 'planned' and owner_id in (select public.my_client_ids())
  );
create policy "workout_blocks: coach reads clients" on public.workout_blocks
  for select to authenticated using (owner_id in (select public.my_client_ids()));
create policy "workout_sets: coach reads clients" on public.workout_sets
  for select to authenticated using (owner_id in (select public.my_client_ids()));

create policy "training_maxes: coach reads clients" on public.training_maxes
  for select to authenticated using (owner_id in (select public.my_client_ids()));
create policy "training_maxes: coach records client maxes" on public.training_maxes
  for insert to authenticated with check (owner_id in (select public.my_client_ids()));

-- Clients see their coach's custom exercises (used in templates); coaches see clients' custom ones.
create policy "exercises: coach and clients read custom" on public.exercises
  for select to authenticated using (
    owner_id in (select public.my_coach_ids()) or owner_id in (select public.my_client_ids())
  );

create policy "workout_comments: owner and coach read" on public.workout_comments
  for select to authenticated using (
    owner_id = (select auth.uid()) or owner_id in (select public.my_client_ids())
  );
create policy "workout_comments: owner and coach write" on public.workout_comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (owner_id = (select auth.uid()) or owner_id in (select public.my_client_ids()))
  );
create policy "workout_comments: author deletes" on public.workout_comments
  for delete to authenticated using (author_id = (select auth.uid()));

revoke all on public.coach_clients, public.coach_invites, public.workout_comments from anon;
grant select on public.coach_clients to authenticated;
grant update (status) on public.coach_clients to authenticated;
grant select, insert, delete on public.coach_invites to authenticated;
grant select, insert, delete on public.workout_comments to authenticated;

-- ---------- invites ----------

-- What the join page shows before accepting. Anyone signed in with the code can see the coach's name.
create function public.invite_preview(p_code text)
returns table (coach_name text, status text)
language sql stable security definer set search_path = '' as $$
  select p.display_name,
    case
      when i.coach_id = auth.uid() then 'own'
      when i.accepted_by is not null and i.accepted_by <> auth.uid() then 'used'
      when i.accepted_by = auth.uid() then 'accepted'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.coach_invites i
  join public.profiles p on p.id = i.coach_id
  where i.code = upper(btrim(p_code))
$$;

create function public.accept_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.coach_invites;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  select * into inv from public.coach_invites where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'invite_invalid';
  elsif inv.coach_id = me then
    raise exception 'invite_own';
  elsif inv.accepted_by is not null and inv.accepted_by <> me then
    raise exception 'invite_used';
  elsif inv.accepted_by is null and inv.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  insert into public.coach_clients (coach_id, client_id) values (inv.coach_id, me)
  on conflict (coach_id, client_id) do update set status = 'active';
  update public.coach_invites set accepted_by = me, accepted_at = coalesce(accepted_at, now()) where code = inv.code;
  return inv.coach_id;
end $$;

-- ---------- assignment ----------

-- Deep-copies a template into each client's own workouts. The copy is the snapshot: later edits to the
-- template, or to another client's copy, never reach it. Percent sets resolve against each client's max.
create function public.assign_template(p_template uuid, p_client_ids uuid[], p_scheduled_for date default null)
returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
  v_id uuid;
begin
  if not exists (
    select 1 from public.workouts where id = p_template and owner_id = auth.uid() and kind = 'template'
  ) then
    raise exception 'template_not_found';
  end if;

  foreach c in array p_client_ids loop
    if not public.is_coach_of(c) then
      raise exception 'not_your_client';
    end if;
    v_id := public.copy_workout(p_template, 'workout', c, p_scheduled_for);
    update public.workouts set assigned_by = auth.uid(), assigned_at = now() where id = v_id;
    return next v_id;
  end loop;
end $$;

revoke execute on function public.new_invite_code, public.my_client_ids, public.my_coach_ids, public.is_coach_of,
  public.invite_preview, public.accept_invite, public.assign_template from anon, public;
grant execute on function public.new_invite_code, public.my_client_ids, public.my_coach_ids, public.is_coach_of,
  public.invite_preview, public.accept_invite, public.assign_template to authenticated;
