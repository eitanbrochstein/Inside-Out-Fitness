-- Programs: built by their owner, started onto a calendar as a run, for yourself or for a client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- C = coach, A = C's client, S = stranger.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true where id = 'cccccccc-0000-4000-8000-0000000000c0';
insert into public.coach_clients (coach_id, client_id) values ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.bench() returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = 'Bench Press'
$$;
-- Each run in this test starts on its own Monday.
create function pg_temp.run_on(p_owner uuid, p_start date) returns uuid language sql as $$
  select id from public.program_runs where owner_id = p_owner and start_date = p_start
$$;

set local role authenticated;

-- C builds a two-week program: a heavy Monday, and a Thursday copied from a saved workout.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.programs (id, title, week_count) values ('c1000000-0000-4000-8000-000000000001', 'Strength block', 2);
insert into public.workouts (id, kind, title, subtitle, program_id, program_day)
  values ('c2000000-0000-4000-8000-000000000001', 'template', 'Upper', 'Heavy', 'c1000000-0000-4000-8000-000000000001', 0);
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('c2000000-0000-4000-8000-0000000000b1', 'c2000000-0000-4000-8000-000000000001', 'exercise', pg_temp.bench());
insert into public.workout_sets (block_id, target_reps, target_percent) values ('c2000000-0000-4000-8000-0000000000b1', 5, 80);
insert into public.workouts (id, kind, title) values ('c3000000-0000-4000-8000-000000000001', 'template', 'Lower');
insert into public.workout_blocks (workout_id, type, title) values ('c3000000-0000-4000-8000-000000000001', 'text', 'Squats');

select is(public.add_program_workout('c1000000-0000-4000-8000-000000000001', 3, 'c3000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000003'), 'c2000000-0000-4000-8000-000000000003'::uuid, 'a saved workout is copied onto a program day');
select is((select count(*) from public.workout_blocks where workout_id = 'c2000000-0000-4000-8000-000000000003'), 1::bigint,
  'the copy brings its blocks');
select is((select program_day from public.workouts where id = 'c2000000-0000-4000-8000-000000000003'), 3::smallint, 'on the chosen day');
select throws_ok($$ select public.add_program_workout('c1000000-0000-4000-8000-000000000001', 14, 'c3000000-0000-4000-8000-000000000001') $$,
  'P0001', 'bad_day', 'days stay inside the program');
select throws_ok($$ insert into public.workouts (kind, program_id, program_day) values ('workout', 'c1000000-0000-4000-8000-000000000001', 1) $$,
  '23514', null, 'only templates belong to a program');
select throws_ok($$ insert into public.workouts (kind, program_id) values ('template', 'c1000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'a program workout has a day');

-- Weeks.
select lives_ok($$ select public.program_insert_week('c1000000-0000-4000-8000-000000000001', 2, 0) $$, 'add a third week copied from the first');
select is((select week_count from public.programs where id = 'c1000000-0000-4000-8000-000000000001'), 3::smallint, 'the program has three weeks');
select is((select array_agg(program_day order by program_day) from public.workouts where program_id = 'c1000000-0000-4000-8000-000000000001'),
  array[0, 3, 14, 17]::smallint[], 'week 3 repeats week 1''s days');
select is((select count(*) from public.workout_sets s join public.workout_blocks b on b.id = s.block_id join public.workouts w on w.id = b.workout_id
           where w.program_id = 'c1000000-0000-4000-8000-000000000001' and w.program_day = 14 and s.target_percent = 80), 1::bigint,
  'copied sets keep their percentages');
select lives_ok($$ select public.program_insert_week('c1000000-0000-4000-8000-000000000001', 0) $$, 'insert an empty first week');
select is((select min(program_day) from public.workouts where program_id = 'c1000000-0000-4000-8000-000000000001'), 7::smallint,
  'later weeks move down');
select lives_ok($$ select public.program_delete_week('c1000000-0000-4000-8000-000000000001', 0) $$, 'delete it again');
select is((select array_agg(program_day order by program_day) from public.workouts where program_id = 'c1000000-0000-4000-8000-000000000001'),
  array[0, 3, 14, 17]::smallint[], 'and they move back up');
insert into public.programs (id, title) values ('c1000000-0000-4000-8000-000000000002', 'One week');
select throws_ok($$ select public.program_delete_week('c1000000-0000-4000-8000-000000000002', 0) $$, 'P0001', 'last_week',
  'a program keeps at least one week');
select throws_ok($$ select public.program_insert_week('c1000000-0000-4000-8000-000000000002', 5) $$, 'P0001', 'bad_week',
  'weeks go inside the program');

-- A stranger can't see, extend or start it.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select is_empty($$ select * from public.programs $$, 'programs are private');
insert into public.workouts (id, kind) values ('e1000000-0000-4000-8000-000000000001', 'template');
select throws_ok($$ update public.workouts set program_id = 'c1000000-0000-4000-8000-000000000001', program_day = 0
                    where id = 'e1000000-0000-4000-8000-000000000001' $$, '23503', null, 'nobody can add to someone else''s program');
select throws_ok($$ select public.program_insert_week('c1000000-0000-4000-8000-000000000001', 1) $$, 'P0001', 'program_not_found',
  'nobody can change someone else''s weeks');
select throws_ok($$ select public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-02') $$, 'P0001', 'program_not_found',
  'nobody can start someone else''s program');

-- C starts it for themselves.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select throws_ok($$ select public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-03') $$, 'P0001', 'start_not_monday',
  'a program starts on a Monday');
select is((select count(*) from public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-02')), 1::bigint, 'starting makes one run');
select is((select array_agg(scheduled_for order by scheduled_for) from public.workouts
           where program_run_id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-02')),
  array['2026-11-02', '2026-11-05', '2026-11-16', '2026-11-19']::date[], 'every program day lands on its date');
select is((select subtitle from public.workouts
           where program_run_id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-02') and scheduled_for = '2026-11-02'),
  'Strength block · Week 1 · Heavy', 'the subtitle says where it came from');
select ok((select bool_and(kind = 'workout' and status = 'planned' and assigned_by is null) from public.workouts
           where program_run_id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-02')), 'your own run is plain planned workouts');
select is((select week_count from public.program_runs where id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-02')),
  3::smallint, 'the run keeps the program''s length');
select is((select count(*) from public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-09', null, '2026-11-12')), 1::bigint,
  'start one partway through its first week');
select is((select count(*) from public.workouts where program_run_id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-09')),
  3::bigint, 'days already past are left out');
update public.workout_sets set actual_reps = 5, actual_weight_kg = 80, completed_at = now() where block_id = 'c2000000-0000-4000-8000-0000000000b1';
select is_empty($$ select * from public.set_log where workout_id = 'c2000000-0000-4000-8000-000000000001' $$, 'a program day never counts as training');

-- C starts it for a client, never for a stranger.
select throws_ok($$ select public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-16', array['eeeeeeee-0000-4000-8000-0000000000e0'::uuid]) $$,
  'P0001', 'not_your_client', 'a coach starts programs only for their clients');
select is((select count(*) from public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-16', array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid])),
  1::bigint, 'a coach starts it for a client');
select isnt(pg_temp.run_on('aaaaaaaa-0000-4000-8000-0000000000a0', '2026-11-16'), null, 'the coach sees the client''s run');
select set_config('test.c_run', pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-02')::text, true);

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select count(*) from public.workouts where assigned_by = 'cccccccc-0000-4000-8000-0000000000c0' and program_run_id is not null), 4::bigint,
  'the client owns the assigned workouts');
select is((select assigned_by from public.program_runs), 'cccccccc-0000-4000-8000-0000000000c0'::uuid, 'the client sees the run, from their coach');
select is_empty($$ select * from public.programs $$, 'the client never sees the coach''s program');
update public.workouts set status = 'in_progress', started_at = now()
  where program_run_id = pg_temp.run_on('aaaaaaaa-0000-4000-8000-0000000000a0', '2026-11-16') and scheduled_for = '2026-11-16';
-- Foreign keys don't check visibility, so A can point one of their own workouts at C's run.
insert into public.workouts (id, title, program_run_id) values ('a1000000-0000-4000-8000-000000000001', 'Mine', current_setting('test.c_run')::uuid);
select set_config('test.a_run', pg_temp.run_on('aaaaaaaa-0000-4000-8000-0000000000a0', '2026-11-16')::text, true);

-- Stopping: unstarted workouts come off the calendar, started ones stay.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select throws_ok($$ select public.stop_program_run(current_setting('test.a_run')::uuid) $$, 'P0001', 'run_not_found', 'a stranger cannot stop a run');
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is(public.stop_program_run(current_setting('test.a_run')::uuid), 3, 'the assigning coach stops it: the unstarted workouts go');
select is((select count(*) from public.workouts where program_run_id = current_setting('test.a_run')::uuid), 1::bigint, 'the started one stays');
select isnt((select ended_at from public.program_runs where id = current_setting('test.a_run')::uuid), null, 'the run is over');
select is(public.stop_program_run(current_setting('test.c_run')::uuid), 4, 'an owner stops their own run');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select isnt_empty($$ select * from public.workouts where id = 'a1000000-0000-4000-8000-000000000001' $$, 'a run only ever removes its owner''s workouts');

-- Deleting the program takes its days, not what it already put on calendars.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
delete from public.programs where id = 'c1000000-0000-4000-8000-000000000001';
select is_empty($$ select * from public.workouts where program_id = 'c1000000-0000-4000-8000-000000000001' $$, 'deleting a program deletes its days');
select is((select count(*) from public.workouts where program_run_id = pg_temp.run_on('cccccccc-0000-4000-8000-0000000000c0', '2026-11-09')), 3::bigint,
  'the workouts it put on the calendar stay');

select * from finish();
rollback;
