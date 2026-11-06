-- Programs: reusable blocks of weeks. A program's days are ordinary templates tied to it, so the workout
-- editor edits them unchanged. Starting a program copies every day onto someone's calendar (a "run"),
-- for yourself or, through the same function, for your clients.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  description text not null default '',
  week_count smallint not null default 1 check (week_count between 1 and 52),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_id_owner unique (id, owner_id)
);

create index programs_owner on public.programs (owner_id, updated_at desc);
create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

-- A program day is a template with a day number: week * 7 + weekday, Monday = 0. Each week is its own
-- copy, so weeks can progress. The key on (program, owner) keeps the days with the program's owner,
-- and deleting the program deletes its days.
alter table public.workouts
  add column program_id uuid,
  add column program_day smallint check (program_day between 0 and 363),
  add constraint workouts_program_fk foreign key (program_id, owner_id)
    references public.programs (id, owner_id) on delete cascade,
  add constraint workouts_program_day_pair check ((program_id is null) = (program_day is null)),
  add constraint workouts_program_is_template check (program_id is null or kind = 'template');

create index workouts_program on public.workouts (program_id, program_day) where program_id is not null;

-- A program started on a calendar. It keeps the program's title and length, so it reads the same after
-- the program is edited or deleted. Only the functions below write runs.
create table public.program_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade, -- whose calendar
  program_id uuid references public.programs on delete set null,
  title text not null,
  start_date date not null, -- a Monday
  week_count smallint not null check (week_count between 1 and 52),
  assigned_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index program_runs_owner on public.program_runs (owner_id, start_date desc);

alter table public.workouts add column program_run_id uuid references public.program_runs on delete set null;
create index workouts_program_run on public.workouts (program_run_id) where program_run_id is not null;

alter table public.programs enable row level security;
alter table public.program_runs enable row level security;

create policy "programs: owner all" on public.programs
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "program_runs: owner reads" on public.program_runs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "program_runs: coach reads clients" on public.program_runs
  for select to authenticated using (owner_id in (select public.my_client_ids()));

revoke all on public.programs, public.program_runs from anon;
grant select, insert, update, delete on public.programs to authenticated;
grant select on public.program_runs to authenticated;

-- ---------- building a program (as the caller, so RLS proves it's yours) ----------

-- Copies a saved workout onto a program day.
create function public.add_program_workout(
  p_program uuid,
  p_day int,
  p_source uuid,
  p_new_id uuid default gen_random_uuid()
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_weeks int;
begin
  select week_count into v_weeks from public.programs where id = p_program;
  if not found then
    raise exception 'program_not_found';
  end if;
  if p_day < 0 or p_day >= v_weeks * 7 then
    raise exception 'bad_day';
  end if;
  perform public.copy_workout(p_source, 'template', auth.uid(), null, p_new_id);
  update public.workouts set program_id = p_program, program_day = p_day where id = p_new_id;
  return p_new_id;
end $$;

-- Inserts a week at p_at (0-based), moving later weeks down. With p_copy_from it's filled with copies
-- of that week: "+ week" copies the last week, and "Duplicate week" puts a copy right after it.
create function public.program_insert_week(p_program uuid, p_at int, p_copy_from int default null) returns void
language plpgsql set search_path = '' as $$
declare
  p public.programs;
  w record;
  v_src int;
  v_id uuid;
begin
  select * into p from public.programs where id = p_program for update;
  if not found then
    raise exception 'program_not_found';
  end if;
  if p.week_count >= 52 then
    raise exception 'too_many_weeks';
  end if;
  if p_at not between 0 and p.week_count or (p_copy_from is not null and p_copy_from not between 0 and p.week_count - 1) then
    raise exception 'bad_week';
  end if;

  update public.workouts set program_day = program_day + 7 where program_id = p.id and program_day >= p_at * 7;
  update public.programs set week_count = week_count + 1 where id = p.id;

  if p_copy_from is not null then
    v_src := case when p_copy_from >= p_at then p_copy_from + 1 else p_copy_from end;
    for w in
      select id, program_day from public.workouts
      where program_id = p.id and program_day / 7 = v_src
      order by program_day, created_at
    loop
      v_id := public.copy_workout(w.id, 'template', p.owner_id);
      update public.workouts set program_id = p.id, program_day = p_at * 7 + w.program_day % 7 where id = v_id;
    end loop;
  end if;
end $$;

-- Deletes a week and its workouts, moving later weeks up. A program keeps at least one week.
create function public.program_delete_week(p_program uuid, p_week int) returns void
language plpgsql set search_path = '' as $$
declare
  p public.programs;
begin
  select * into p from public.programs where id = p_program for update;
  if not found then
    raise exception 'program_not_found';
  end if;
  if p.week_count = 1 then
    raise exception 'last_week';
  end if;
  if p_week not between 0 and p.week_count - 1 then
    raise exception 'bad_week';
  end if;

  delete from public.workouts where program_id = p.id and program_day / 7 = p_week;
  update public.workouts set program_day = program_day - 7 where program_id = p.id and program_day >= (p_week + 1) * 7;
  update public.programs set week_count = week_count - 1 where id = p.id;
end $$;

-- ---------- running a program (security definer: it writes clients' calendars) ----------

-- Copies every day of a program onto each trainee's calendar from p_start (a Monday): yourself when
-- p_client_ids is null, otherwise each client, stamped as assigned. Days before p_skip_before are left
-- out. Dates come from the caller because the server's clock is UTC. Returns the new runs.
create function public.start_program(
  p_program uuid,
  p_start date,
  p_client_ids uuid[] default null,
  p_skip_before date default null
) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.programs;
  t uuid;
  v_run uuid;
  w record;
  v_id uuid;
begin
  select * into p from public.programs where id = p_program and owner_id = me;
  if not found then
    raise exception 'program_not_found';
  end if;
  if extract(isodow from p_start) <> 1 then
    raise exception 'start_not_monday';
  end if;

  foreach t in array coalesce(p_client_ids, array[me]) loop
    if t <> me and not public.is_coach_of(t) then
      raise exception 'not_your_client';
    end if;

    insert into public.program_runs (owner_id, program_id, title, start_date, week_count, assigned_by)
    values (t, p.id, coalesce(nullif(btrim(p.title), ''), 'Untitled program'), p_start, p.week_count, nullif(me, t))
    returning id into v_run;

    for w in
      select id, program_day, subtitle from public.workouts
      where program_id = p.id and (p_skip_before is null or p_start + program_day >= p_skip_before)
      order by program_day, created_at
    loop
      v_id := public.copy_workout(w.id, 'workout', t, p_start + w.program_day);
      update public.workouts
      set program_run_id = v_run,
        assigned_by = nullif(me, t),
        assigned_at = case when t <> me then now() end,
        -- "Strength block · Week 3", plus the day's own subtitle.
        subtitle = concat_ws(' · ', nullif(btrim(p.title), ''), 'Week ' || (w.program_day / 7 + 1), nullif(w.subtitle, ''))
      where id = v_id;
    end loop;

    return next v_run;
  end loop;
end $$;

-- Ends a run: its workouts that haven't been started come off the calendar; started and finished ones
-- stay. The trainee can stop it, or the coach who assigned it while still coaching them.
create function public.stop_program_run(p_run uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.program_runs;
  n int;
begin
  select * into r from public.program_runs where id = p_run for update;
  if not found or not (r.owner_id = auth.uid() or (r.assigned_by = auth.uid() and public.is_coach_of(r.owner_id))) then
    raise exception 'run_not_found';
  end if;

  delete from public.workouts where program_run_id = r.id and owner_id = r.owner_id and status = 'planned';
  get diagnostics n = row_count;
  update public.program_runs set ended_at = coalesce(ended_at, now()) where id = r.id;
  return n;
end $$;

revoke execute on function public.add_program_workout, public.program_insert_week, public.program_delete_week,
  public.start_program, public.stop_program_run from anon, public;
grant execute on function public.add_program_workout, public.program_insert_week, public.program_delete_week,
  public.start_program, public.stop_program_run to authenticated;
