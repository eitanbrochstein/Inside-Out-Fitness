-- Saving programs from what's already planned: weeks of a calendar, one workout onto a new program, or
-- a whole program run (one a coach assigned included). Both run as the caller, so RLS proves every
-- workout copied is one they can read, and the new program and its days are theirs.

-- A new program from workouts, each on a program day (week * 7 + weekday, Monday = 0). The app works out
-- the days, since what a calendar shows on a day depends on the trainee's time zone. Plans only are
-- copied, as with saving a single workout.
create function public.create_program_from_workouts(
  p_title text,
  p_week_count int,
  p_workouts uuid[],
  p_days int[],
  p_new_id uuid default gen_random_uuid()
) returns uuid
language plpgsql set search_path = '' as $$
declare
  i int;
  v_id uuid;
begin
  if coalesce(cardinality(p_workouts), 0) = 0 then
    raise exception 'nothing_to_save';
  end if;
  if cardinality(p_workouts) <> coalesce(cardinality(p_days), 0) then
    raise exception 'bad_days';
  end if;
  if p_week_count is null or p_week_count not between 1 and 52 then
    raise exception 'bad_week_count';
  end if;
  if exists (select 1 from unnest(p_days) d where d is null or d < 0 or d >= p_week_count * 7) then
    raise exception 'bad_day';
  end if;

  insert into public.programs (id, title, week_count) values (p_new_id, btrim(coalesce(p_title, '')), p_week_count);

  for i in select t.ord from unnest(p_days) with ordinality as t(day, ord) order by t.day, t.ord loop
    v_id := public.copy_workout(p_workouts[i], 'template', auth.uid());
    update public.workouts set program_id = p_new_id, program_day = p_days[i] where id = v_id;
  end loop;

  return p_new_id;
end $$;

-- A program run on your own calendar, saved as a program of your own: every workout it put on a day of
-- its weeks, as planned (started and finished ones included), on that day. Days are dates minus the
-- run's Monday, so no clock is involved.
create function public.save_run_as_program(p_run uuid, p_new_id uuid default gen_random_uuid()) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.program_runs;
  v_ids uuid[];
  v_days int[];
begin
  select * into r from public.program_runs where id = p_run and owner_id = auth.uid();
  if not found then
    raise exception 'run_not_found';
  end if;

  select array_agg(w.id order by w.scheduled_for, w.created_at),
         array_agg(w.scheduled_for - r.start_date order by w.scheduled_for, w.created_at)
  into v_ids, v_days
  from public.workouts w
  where w.program_run_id = r.id and w.owner_id = r.owner_id and w.kind = 'workout'
    and w.scheduled_for >= r.start_date and w.scheduled_for < r.start_date + r.week_count * 7;

  return public.create_program_from_workouts(r.title, r.week_count, v_ids, v_days, p_new_id);
end $$;

revoke execute on function public.create_program_from_workouts, public.save_run_as_program from anon, public;
grant execute on function public.create_program_from_workouts, public.save_run_as_program to authenticated;
