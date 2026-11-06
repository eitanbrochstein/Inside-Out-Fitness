-- What the dashboards chart: training totals per workout, personal records and a weekly goal.
-- Like the other functions these run as the caller (security invoker), so RLS decides whose
-- training is visible: your own, or an active client's for their coach.

alter table public.profiles
  add column weekly_goal smallint not null default 3 check (weekly_goal between 1 and 14);

-- Epley's estimated 1RM, trusted for 1–12 reps. Mirrors estimate1RM in src/lib/load.ts.
create function public.epley_kg(p_weight numeric, p_reps int) returns numeric
language sql immutable set search_path = '' as $$
  select case when p_weight > 0 and p_reps between 1 and 12
    then case when p_reps = 1 then p_weight else p_weight * (1 + p_reps / 30.0) end
  end
$$;

-- One row per workout with logged sets since p_since: sets, reps and volume, in total and per muscle
-- group. Volume counts both hands of a per-hand exercise; bodyweight sets add reps but no volume.
-- One row per workout keeps a long history well under the API's row limit.
create function public.training_summary(
  p_owner uuid default auth.uid(),
  p_since timestamptz default now() - interval '26 weeks'
) returns table (
  workout_id uuid,
  title text,
  status text,
  started_at timestamptz,
  performed_at timestamptz,
  set_count int,
  rep_count int,
  volume_kg numeric,
  categories jsonb
)
language sql stable set search_path = '' as $$
  with sets as (
    select l.workout_id, l.performed_at,
           coalesce(e.category, 'Other') as category,
           coalesce(l.reps, 0) as reps,
           coalesce(l.weight_kg, 0) * coalesce(l.reps, 0) * case e.load_basis when 'per_hand' then 2 else 1 end as volume
    from public.set_log l
    left join public.exercises e on e.id = l.exercise_id
    where l.owner_id = p_owner and l.performed_at >= p_since
  ),
  by_category as (
    select s.workout_id, s.category, max(s.performed_at) as performed_at,
           count(*)::int as set_count, sum(s.reps)::int as rep_count, sum(s.volume) as volume_kg
    from sets s
    group by s.workout_id, s.category
  )
  select c.workout_id, w.title, w.status, w.started_at, max(c.performed_at),
         sum(c.set_count)::int, sum(c.rep_count)::int, sum(c.volume_kg),
         jsonb_object_agg(c.category, jsonb_build_object('sets', c.set_count, 'reps', c.rep_count, 'volume_kg', c.volume_kg))
  from by_category c
  join public.workouts w on w.id = c.workout_id
  group by c.workout_id, w.title, w.status, w.started_at
  order by max(c.performed_at) desc;
$$;

-- Personal records, newest first: the sessions that beat every earlier session of the same exercise
-- on heaviest weight, on estimated 1RM, or on reps for bodyweight sets. An exercise's first session
-- sets the baseline rather than a record, and a session counts once, by its strongest kind.
create function public.personal_records(
  p_owner uuid default auth.uid(),
  p_since timestamptz default null,
  p_workout uuid default null,
  p_limit int default 50
) returns table (
  exercise_id uuid,
  workout_id uuid,
  performed_at timestamptz,
  kind text,
  weight_kg numeric,
  reps int,
  value numeric,
  previous numeric
)
language sql stable set search_path = '' as $$
  with sessions as (
    select l.exercise_id, l.workout_id, max(l.performed_at) as performed_at,
           max(l.weight_kg) as best_weight,
           max(public.epley_kg(l.weight_kg, l.reps)) as best_e1rm,
           max(l.reps) filter (where l.weight_kg is null) as best_reps
    from public.set_log l
    where l.owner_id = p_owner
    group by l.exercise_id, l.workout_id
  ),
  running as (
    select s.*,
           max(s.best_weight) over earlier as prev_weight,
           max(s.best_e1rm) over earlier as prev_e1rm,
           max(s.best_reps) over earlier as prev_reps
    from sessions s
    window earlier as (partition by s.exercise_id order by s.performed_at, s.workout_id
                       rows between unbounded preceding and 1 preceding)
  ),
  events as (
    select r.exercise_id, r.workout_id, r.performed_at, 'weight' as kind, r.best_weight as value, r.prev_weight as previous
    from running r
    where r.best_weight > r.prev_weight
    union all
    select r.exercise_id, r.workout_id, r.performed_at, 'e1rm', r.best_e1rm, r.prev_e1rm
    from running r
    where r.best_e1rm > r.prev_e1rm + 0.01 and not coalesce(r.best_weight > r.prev_weight, false)
    union all
    select r.exercise_id, r.workout_id, r.performed_at, 'reps', r.best_reps, r.prev_reps
    from running r
    where r.best_reps > r.prev_reps
  )
  select e.exercise_id, e.workout_id, e.performed_at, e.kind, top.weight_kg, top.reps, e.value, e.previous
  from events e
  cross join lateral (
    -- The set that made the record.
    select l.weight_kg, l.reps
    from public.set_log l
    where l.owner_id = p_owner and l.exercise_id = e.exercise_id and l.workout_id = e.workout_id
    order by case e.kind
               when 'weight' then l.weight_kg
               when 'e1rm' then public.epley_kg(l.weight_kg, l.reps)
               else case when l.weight_kg is null then l.reps end
             end desc nulls last,
             l.reps desc nulls last
    limit 1
  ) top
  where (p_since is null or e.performed_at >= p_since)
    and (p_workout is null or e.workout_id = p_workout)
  order by e.performed_at desc, e.exercise_id
  limit p_limit;
$$;

-- exercise_stats gains the best estimated 1RM, so a set logged mid-workout can be checked for a record.
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
  best_e1rm_kg numeric
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
    select l.exercise_id, count(distinct l.workout_id) as session_count, max(public.epley_kg(l.weight_kg, l.reps)) as best_e1rm_kg
    from log l
    group by l.exercise_id
  )
  select lt.exercise_id, lt.weight_kg, lt.reps, lt.performed_at, lt.workout_id,
         b.weight_kg, b.reps, b.performed_at, c.session_count, c.best_e1rm_kg
  from last_top lt
  join best b on b.exercise_id = lt.exercise_id
  join counts c on c.exercise_id = lt.exercise_id;
$$;

-- Callers of an invoker function also need the functions it calls.
revoke execute on function public.epley_kg, public.training_summary, public.personal_records, public.exercise_stats
  from anon, public;
grant execute on function public.epley_kg, public.training_summary, public.personal_records, public.exercise_stats
  to authenticated;
