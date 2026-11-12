-- Timed sets, session RPE, and the copy functions catching up with supersets.
-- An exercise is measured in reps or time (workout_blocks.settings.measure, chosen per exercise). Time is
-- stored in seconds, like weights in kg, and shown in seconds or minutes. A superset is consecutive
-- exercise blocks sharing settings.group. Everything here is additive, so older app versions keep working.

alter table public.workout_sets
  add column target_seconds int check (target_seconds >= 0), -- PLAN
  add column actual_seconds int check (actual_seconds >= 0); -- ACTUAL

-- How hard the session felt, 1–10, rated when it's finished. The trainee's own log, so a coach can't set
-- it: protect_client_workout lets a non-owner change only the title, subtitle and date.
alter table public.workouts add column rpe smallint check (rpe between 1 and 10);

-- start_program titles each day "<program> · Week N · <day's subtitle>". Saving one of those days back
-- into a library or a program takes that prefix off again, so it isn't added twice when it runs again.
create function public.strip_run_prefix(p_subtitle text, p_title text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  s text := coalesce(p_subtitle, '');
  t text := btrim(coalesce(p_title, ''));
begin
  if t <> '' and left(s, length(t) + 3) = t || ' · ' then
    s := substr(s, length(t) + 4);
  end if;
  return regexp_replace(s, '^Week [0-9]+( · |$)', '');
end $$;

-- Deep copy of a workout's plan, now with timed targets. A copy saved as a template drops its run prefix.
create or replace function public.copy_workout(
  p_source uuid,
  p_kind text default 'workout',
  p_owner uuid default auth.uid(),
  p_scheduled_for date default null,
  p_new_id uuid default gen_random_uuid()
) returns uuid
language plpgsql set search_path = '' as $$
declare
  w public.workouts;
  b public.workout_blocks;
  v_block uuid;
  v_subtitle text;
begin
  select * into w from public.workouts where id = p_source;
  if not found then
    raise exception 'workout % not found', p_source;
  end if;

  v_subtitle := w.subtitle;
  if p_kind = 'template' and w.program_run_id is not null then
    v_subtitle := public.strip_run_prefix(w.subtitle, (select r.title from public.program_runs r where r.id = w.program_run_id));
  end if;

  insert into public.workouts (id, owner_id, kind, title, subtitle, scheduled_for, source_workout_id)
  values (p_new_id, p_owner, p_kind, w.title, v_subtitle, p_scheduled_for, p_source);

  for b in select * from public.workout_blocks where workout_id = p_source order by position loop
    v_block := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, position, type, title, body, exercise_id, max_kind, notes, settings)
    values (v_block, p_new_id, b.position, b.type, b.title, b.body, b.exercise_id, b.max_kind, b.notes, b.settings);

    insert into public.workout_sets (block_id, position, target_reps, target_seconds, target_percent, target_weight_kg)
    select v_block, s.position, s.target_reps, s.target_seconds, s.target_percent, s.target_weight_kg
    from public.workout_sets s where s.block_id = b.id;
  end loop;

  return p_new_id;
end $$;

-- Copies a block (plan fields only) directly below the original. Inside a superset the copy joins it;
-- a superset id no other block shares is left over, and the copy doesn't take it along.
create or replace function public.duplicate_block(
  p_block uuid,
  p_new_id uuid default gen_random_uuid(),
  p_set_ids uuid[] default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  b public.workout_blocks;
  v_settings jsonb;
begin
  select * into b from public.workout_blocks where id = p_block;
  if not found then
    raise exception 'block % not found', p_block;
  end if;

  v_settings := b.settings;
  if b.settings ? 'group' and not exists (
    select 1 from public.workout_blocks o
    where o.workout_id = b.workout_id and o.id <> b.id and o.settings -> 'group' = b.settings -> 'group'
  ) then
    v_settings := b.settings - 'group';
  end if;

  update public.workout_blocks set position = position + 1
  where workout_id = b.workout_id and position > b.position;

  insert into public.workout_blocks (id, workout_id, position, type, title, body, exercise_id, max_kind, notes, settings)
  values (p_new_id, b.workout_id, b.position + 1, b.type, b.title, b.body, b.exercise_id, b.max_kind, b.notes, v_settings);

  insert into public.workout_sets (id, block_id, position, target_reps, target_seconds, target_percent, target_weight_kg)
  select coalesce(p_set_ids[s.ord], gen_random_uuid()), p_new_id, s.position, s.target_reps, s.target_seconds, s.target_percent, s.target_weight_kg
  from (
    select ws.*, row_number() over (order by ws.position, ws.created_at) as ord
    from public.workout_sets ws where ws.block_id = p_block
  ) s;

  return p_new_id;
end $$;

-- On someone else's sets, nothing logged or frozen is written: the logged time joins the guarded columns.
create or replace function public.protect_client_sets() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.owner_id is distinct from auth.uid() then
    if (tg_op = 'INSERT' and num_nonnulls(new.actual_reps, new.actual_seconds, new.actual_weight_kg, new.completed_at, new.basis_max_kg, new.prescribed_load_kg) > 0)
       or (tg_op = 'UPDATE' and (new.actual_reps, new.actual_seconds, new.actual_weight_kg, new.completed_at, new.basis_max_kg, new.prescribed_load_kg)
           is distinct from (old.actual_reps, old.actual_seconds, old.actual_weight_kg, old.completed_at, old.basis_max_kg, old.prescribed_load_kg)) then
      raise exception 'coach_edits_plan_only' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Every completed set of a real workout, now with its logged time.
create or replace view public.set_log with (security_invoker = true) as
select
  s.id as set_id,
  s.owner_id,
  b.exercise_id,
  w.id as workout_id,
  w.title as workout_title,
  coalesce(w.completed_at, s.completed_at) as performed_at,
  s.actual_weight_kg as weight_kg,
  s.actual_reps as reps,
  b.position as block_position,
  s.position as set_position,
  s.actual_seconds as seconds
from public.workout_sets s
join public.workout_blocks b on b.id = s.block_id
join public.workouts w on w.id = b.workout_id
where s.completed_at is not null and w.kind = 'workout' and b.exercise_id is not null;

-- exercise_stats gains the longest set of the last session and of all time, for timed exercises.
drop function public.exercise_stats(uuid[], uuid, uuid);
create function public.exercise_stats(
  p_exercise_ids uuid[],
  p_exclude_workout uuid default null,
  p_owner uuid default auth.uid()
) returns table (
  exercise_id uuid,
  last_weight_kg numeric,
  last_reps int,
  last_performed_at timestamptz,
  last_workout_id uuid,
  best_weight_kg numeric,
  best_reps int,
  best_performed_at timestamptz,
  session_count bigint,
  best_e1rm_kg numeric,
  last_seconds int,
  best_seconds int
)
language sql stable set search_path = '' as $$
  with log as (
    select * from public.set_log l
    where l.owner_id = p_owner
      and l.exercise_id = any (p_exercise_ids)
      and (p_exclude_workout is null or l.workout_id <> p_exclude_workout)
  ),
  last_session as (
    select distinct on (l.exercise_id) l.exercise_id, l.workout_id
    from log l
    order by l.exercise_id, l.performed_at desc
  ),
  last_top as (
    select distinct on (l.exercise_id) l.exercise_id, l.weight_kg, l.reps, l.performed_at, l.workout_id
    from log l
    join last_session ls on ls.exercise_id = l.exercise_id and ls.workout_id = l.workout_id
    order by l.exercise_id, l.weight_kg desc nulls last, l.reps desc nulls last
  ),
  last_time as (
    select l.exercise_id, max(l.seconds) as last_seconds
    from log l
    join last_session ls on ls.exercise_id = l.exercise_id and ls.workout_id = l.workout_id
    group by l.exercise_id
  ),
  best as (
    select distinct on (l.exercise_id) l.exercise_id, l.weight_kg, l.reps, l.performed_at
    from log l
    order by l.exercise_id, l.weight_kg desc nulls last, l.reps desc nulls last, l.performed_at desc
  ),
  counts as (
    select l.exercise_id, count(distinct l.workout_id) as session_count,
           max(public.epley_kg(l.weight_kg, l.reps)) as best_e1rm_kg, max(l.seconds) as best_seconds
    from log l
    group by l.exercise_id
  )
  select lt.exercise_id, lt.weight_kg, lt.reps, lt.performed_at, lt.workout_id,
         b.weight_kg, b.reps, b.performed_at, c.session_count, c.best_e1rm_kg, t.last_seconds, c.best_seconds
  from last_top lt
  join best b on b.exercise_id = lt.exercise_id
  join counts c on c.exercise_id = lt.exercise_id
  join last_time t on t.exercise_id = lt.exercise_id;
$$;

revoke execute on function public.strip_run_prefix, public.exercise_stats from anon, public;
grant execute on function public.strip_run_prefix, public.exercise_stats to authenticated;
