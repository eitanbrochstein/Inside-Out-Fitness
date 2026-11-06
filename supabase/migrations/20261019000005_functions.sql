-- Multi-row operations. All run as the caller (security invoker), so RLS still applies.

create function public.reorder_blocks(p_workout uuid, p_ids uuid[]) returns void
language sql set search_path = '' as $$
  update public.workout_blocks b
  set position = t.ord - 1
  from unnest(p_ids) with ordinality as t(id, ord)
  where b.id = t.id and b.workout_id = p_workout;
$$;

-- Copies a block (plan fields only) directly below the original. Ids can come from the client so the
-- optimistic copy and the saved copy match.
create function public.duplicate_block(
  p_block uuid,
  p_new_id uuid default gen_random_uuid(),
  p_set_ids uuid[] default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  b public.workout_blocks;
begin
  select * into b from public.workout_blocks where id = p_block;
  if not found then
    raise exception 'block % not found', p_block;
  end if;

  update public.workout_blocks set position = position + 1
  where workout_id = b.workout_id and position > b.position;

  insert into public.workout_blocks (id, workout_id, position, type, title, body, exercise_id, max_kind, notes, settings)
  values (p_new_id, b.workout_id, b.position + 1, b.type, b.title, b.body, b.exercise_id, b.max_kind, b.notes, b.settings);

  insert into public.workout_sets (id, block_id, position, target_reps, target_percent, target_weight_kg)
  select coalesce(p_set_ids[s.ord], gen_random_uuid()), p_new_id, s.position, s.target_reps, s.target_percent, s.target_weight_kg
  from (
    select ws.*, row_number() over (order by ws.position, ws.created_at) as ord
    from public.workout_sets ws where ws.block_id = p_block
  ) s;

  return p_new_id;
end $$;

-- Deep copy of a workout's plan (Repeat now; template assignment in Phase 2).
create function public.copy_workout(
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
begin
  select * into w from public.workouts where id = p_source;
  if not found then
    raise exception 'workout % not found', p_source;
  end if;

  insert into public.workouts (id, owner_id, kind, title, subtitle, scheduled_for, source_workout_id)
  values (p_new_id, p_owner, p_kind, w.title, w.subtitle, p_scheduled_for, p_source);

  for b in select * from public.workout_blocks where workout_id = p_source order by position loop
    v_block := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, position, type, title, body, exercise_id, max_kind, notes, settings)
    values (v_block, p_new_id, b.position, b.type, b.title, b.body, b.exercise_id, b.max_kind, b.notes, b.settings);

    insert into public.workout_sets (block_id, position, target_reps, target_percent, target_weight_kg)
    select v_block, s.position, s.target_reps, s.target_percent, s.target_weight_kg
    from public.workout_sets s where s.block_id = b.id;
  end loop;

  return p_new_id;
end $$;

-- Freezes remaining percent sets (values computed client-side by load.ts) and completes the workout.
create function public.finish_workout(p_workout uuid, p_freezes jsonb default '[]') returns void
language plpgsql set search_path = '' as $$
begin
  update public.workout_sets s
  set basis_max_kg = f.basis_max_kg, prescribed_load_kg = f.prescribed_load_kg
  from jsonb_to_recordset(p_freezes) as f(id uuid, basis_max_kg numeric, prescribed_load_kg numeric)
  where s.id = f.id
    and s.basis_max_kg is null
    and s.block_id in (select id from public.workout_blocks where workout_id = p_workout);

  update public.workouts
  set status = 'completed', completed_at = coalesce(completed_at, now()), started_at = coalesce(started_at, now())
  where id = p_workout;
  if not found then
    raise exception 'workout % not found', p_workout;
  end if;
end $$;

-- Every completed set of a real workout, with the exercise and session it belongs to.
create view public.set_log with (security_invoker = true) as
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
  s.position as set_position
from public.workout_sets s
join public.workout_blocks b on b.id = s.block_id
join public.workouts w on w.id = b.workout_id
where s.completed_at is not null and w.kind = 'workout' and b.exercise_id is not null;

-- Per exercise: top set of the most recent session ("last performed"), heaviest set ever ("best"),
-- and the number of sessions. The workout being viewed can be excluded from "last".
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
  session_count bigint
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
  best as (
    select distinct on (l.exercise_id) l.exercise_id, l.weight_kg, l.reps, l.performed_at
    from log l
    order by l.exercise_id, l.weight_kg desc nulls last, l.reps desc nulls last, l.performed_at desc
  ),
  counts as (
    select l.exercise_id, count(distinct l.workout_id) as session_count
    from log l
    group by l.exercise_id
  )
  select lt.exercise_id, lt.weight_kg, lt.reps, lt.performed_at, lt.workout_id,
         b.weight_kg, b.reps, b.performed_at, c.session_count
  from last_top lt
  join best b on b.exercise_id = lt.exercise_id
  join counts c on c.exercise_id = lt.exercise_id;
$$;

revoke all on public.set_log from anon;
grant select on public.set_log to authenticated;
revoke execute on function public.reorder_blocks, public.duplicate_block, public.copy_workout,
  public.finish_workout, public.exercise_stats from anon, public;
grant execute on function public.reorder_blocks, public.duplicate_block, public.copy_workout,
  public.finish_workout, public.exercise_stats to authenticated;
