-- A note for the whole workout (exercise blocks already have workout_blocks.notes), and an optional time
-- of day for a planned one. scheduled_time is wall-clock time where the trainee is, like scheduled_for
-- is their calendar date; reminders turn the two into an instant with the trainee's time zone.
alter table public.workouts
  add column notes text not null default '',
  add column scheduled_time time;

-- Both are plan: a coach changes them on an assignment until the client starts it.
create or replace function public.protect_client_workout() returns trigger
language plpgsql set search_path = '' as $$
declare
  keep text[] := array['title', 'subtitle', 'notes', 'scheduled_for', 'scheduled_time', 'updated_at'];
begin
  if current_user = 'authenticated' and old.owner_id is distinct from auth.uid()
     and (to_jsonb(new) - keep) is distinct from (to_jsonb(old) - keep) then
    raise exception 'coach_edits_plan_only' using errcode = '42501';
  end if;
  return new;
end $$;

-- On a workout a coach assigned, the notes are the coach's: the client reads them and replies in the
-- comments. Only updates are checked, so undoing a deleted block or duplicating one keeps its note.
-- Security definer functions (copying, assigning) run as their owner and pass.
create function public.protect_coach_workout_notes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and old.owner_id = auth.uid()
     and old.assigned_by is not null and old.assigned_by <> old.owner_id
     and new.notes is distinct from old.notes then
    raise exception 'coach_note_locked' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger workouts_protect_notes before update of notes on public.workouts
  for each row execute function public.protect_coach_workout_notes();

create function public.protect_coach_block_notes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.notes is distinct from old.notes and exists (
    select 1 from public.workouts w
    where w.id = old.workout_id and w.owner_id = auth.uid()
      and w.assigned_by is not null and w.assigned_by <> w.owner_id
  ) then
    raise exception 'coach_note_locked' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger workout_blocks_protect_notes before update of notes on public.workout_blocks
  for each row execute function public.protect_coach_block_notes();

-- Copies carry the workout's note. A time comes along only onto a dated workout: templates and program
-- days have no dates, so no times.
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

  insert into public.workouts (id, owner_id, kind, title, subtitle, notes, scheduled_for, scheduled_time, source_workout_id)
  values (p_new_id, p_owner, p_kind, w.title, v_subtitle, w.notes, p_scheduled_for,
    case when p_kind = 'workout' and p_scheduled_for is not null then w.scheduled_time end, p_source);

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

-- Assigning can set the time too. The new parameter has a default, so apps calling it the old way
-- (by name, without a time) still work.
drop function public.assign_template(uuid, uuid[], date);

create function public.assign_template(
  p_template uuid,
  p_client_ids uuid[],
  p_scheduled_for date default null,
  p_scheduled_time time default null
) returns setof uuid
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
    update public.workouts
    set assigned_by = auth.uid(), assigned_at = now(),
      scheduled_time = case when p_scheduled_for is not null then p_scheduled_time end
    where id = v_id;
    return next v_id;
  end loop;
end $$;

revoke execute on function public.assign_template from anon, public;
grant execute on function public.assign_template to authenticated;
