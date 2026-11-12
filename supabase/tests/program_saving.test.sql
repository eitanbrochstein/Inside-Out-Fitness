-- Saving programs from what's planned, and copies carrying timed sets and supersets.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- A = C's client, C = coach, S = stranger.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true where id = 'cccccccc-0000-4000-8000-0000000000c0';
insert into public.coach_clients (coach_id, client_id) values ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.ex(p_name text) returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = p_name
$$;

-- The prefix a program run puts on its days' subtitles comes off again.
select is(public.strip_run_prefix('Strength block · Week 3 · Heavy', 'Strength block'), 'Heavy', 'title and week come off');
select is(public.strip_run_prefix('Strength block · Week 12', 'Strength block'), '', 'leaving nothing when the day had no subtitle');
select is(public.strip_run_prefix('Week 2 · Light', 'Untitled program'), 'Light', 'an untitled program''s days have only the week');
select is(public.strip_run_prefix('Heavy · Week 2', 'Strength block'), 'Heavy · Week 2', 'anything else stays');

set local role authenticated;

-- A plans two weeks: a superset of a timed plank and push-ups on Monday, and a text day on Thursday of week 2.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.workouts (id, title, scheduled_for) values
  ('a1000000-0000-4000-8000-000000000001', 'Core', '2026-11-02'),
  ('a1000000-0000-4000-8000-000000000002', 'Mobility', '2026-11-12');
insert into public.workout_blocks (id, workout_id, position, type, exercise_id, settings) values
  ('a1000000-0000-4000-8000-0000000000b1', 'a1000000-0000-4000-8000-000000000001', 0, 'exercise', pg_temp.ex('Plank'), '{"group": "g1", "measure": "sec"}'),
  ('a1000000-0000-4000-8000-0000000000b2', 'a1000000-0000-4000-8000-000000000001', 1, 'exercise', pg_temp.ex('Push-Up'), '{"group": "g1"}'),
  ('a1000000-0000-4000-8000-0000000000b3', 'a1000000-0000-4000-8000-000000000001', 2, 'exercise', pg_temp.ex('Push-Up'), '{"group": "lonely"}');
insert into public.workout_sets (block_id, position, target_seconds, actual_seconds, completed_at)
  values ('a1000000-0000-4000-8000-0000000000b1', 0, 45, 50, now());
insert into public.workout_sets (block_id, position, target_reps) values ('a1000000-0000-4000-8000-0000000000b2', 0, 12);
insert into public.workout_blocks (workout_id, type, title) values ('a1000000-0000-4000-8000-000000000002', 'text', 'Hips');

-- Weeks saved as a program.
select is(public.create_program_from_workouts('Core block', 2,
    array['a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002']::uuid[], array[0, 10],
    'a2000000-0000-4000-8000-000000000001'),
  'a2000000-0000-4000-8000-000000000001'::uuid, 'weeks of a plan become a program');
select results_eq($$ select title, week_count::int from public.programs where id = 'a2000000-0000-4000-8000-000000000001' $$,
  $$ values ('Core block', 2) $$, 'with the title and number of weeks given');
select results_eq($$ select program_day::int, title, kind, owner_id from public.workouts
                    where program_id = 'a2000000-0000-4000-8000-000000000001' order by program_day $$,
  $$ values (0, 'Core', 'template', 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid), (10, 'Mobility', 'template', 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid) $$,
  'each workout a template on its day');
select results_eq($$ select s.target_seconds, s.actual_seconds, s.completed_at is null from public.workout_sets s
                    join public.workout_blocks b on b.id = s.block_id join public.workouts w on w.id = b.workout_id
                    where w.program_id = 'a2000000-0000-4000-8000-000000000001' and s.target_seconds is not null $$,
  $$ values (45, null::int, true) $$, 'timed plans are copied, the log is not');
select results_eq($$ select b.settings from public.workout_blocks b join public.workouts w on w.id = b.workout_id
                    where w.program_id = 'a2000000-0000-4000-8000-000000000001' and b.type = 'exercise' order by b.position $$,
  $$ values ('{"group": "g1", "measure": "sec"}'::jsonb), ('{"group": "g1"}'::jsonb), ('{"group": "lonely"}'::jsonb) $$,
  'supersets and measures come along');
select is((select count(*) from public.workouts where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002')
             and program_id is null and kind = 'workout'), 2::bigint, 'the plan itself is untouched');
select results_eq($$ select last_seconds, best_seconds from public.exercise_stats(array[pg_temp.ex('Plank')]) $$,
  $$ values (50, 50) $$, 'stats report a timed exercise''s logged time');

select throws_ok($$ select public.create_program_from_workouts('x', 1, array['a1000000-0000-4000-8000-000000000001']::uuid[], array[7]) $$,
  'P0001', 'bad_day', 'a day past the last week is refused');
select throws_ok($$ select public.create_program_from_workouts('x', 1, array[]::uuid[], array[]::int[]) $$,
  'P0001', 'nothing_to_save', 'so is nothing');
select throws_ok($$ select public.create_program_from_workouts('x', 1, array['a1000000-0000-4000-8000-000000000001']::uuid[], array[0, 1]) $$,
  'P0001', 'bad_days', 'and days that don''t match the workouts');
select throws_ok($$ select public.create_program_from_workouts('x', 53, array['a1000000-0000-4000-8000-000000000001']::uuid[], array[0]) $$,
  'P0001', 'bad_week_count', 'and more than 52 weeks');

-- A stranger can't save A's workouts.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select throws_ok($$ select public.create_program_from_workouts('Mine now', 1, array['a1000000-0000-4000-8000-000000000001']::uuid[], array[0]) $$,
  'P0001', null, 'a stranger can''t copy someone else''s workouts');
select is((select count(*) from public.programs), 0::bigint, 'and is left with no program');

-- Copies carry timed targets; duplicating doesn't spread a group no other block shares.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select public.duplicate_block('a1000000-0000-4000-8000-0000000000b1', 'a1000000-0000-4000-8000-0000000000c1');
select public.duplicate_block('a1000000-0000-4000-8000-0000000000b3', 'a1000000-0000-4000-8000-0000000000c3');
select is((select settings from public.workout_blocks where id = 'a1000000-0000-4000-8000-0000000000c1'), '{"group": "g1", "measure": "sec"}'::jsonb,
  'a duplicate inside a superset joins it');
select is((select settings from public.workout_blocks where id = 'a1000000-0000-4000-8000-0000000000c3'), '{}'::jsonb,
  'a duplicate of a block alone with a leftover group leaves it behind');
select is((select target_seconds from public.workout_sets where block_id = 'a1000000-0000-4000-8000-0000000000c1'), 45, 'and carries its timed target');
select is((select position from public.workout_blocks where id = 'a1000000-0000-4000-8000-0000000000c1'), 1, 'directly below the original');
-- (Copies are made in a statement of their own: a query can't see rows a function adds while it runs.)
select set_config('test.copy', public.copy_workout('a1000000-0000-4000-8000-000000000001')::text, true);
select is(
  (select s.target_seconds from public.workout_sets s join public.workout_blocks b on b.id = s.block_id
   where b.workout_id = current_setting('test.copy')::uuid and s.target_seconds is not null limit 1),
  45, 'repeating a workout keeps its timed targets');

-- C builds a program and starts it for A.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.programs (id, title, week_count) values ('c1000000-0000-4000-8000-000000000001', 'Strength block', 2);
insert into public.workouts (id, kind, title, subtitle, program_id, program_day) values
  ('c2000000-0000-4000-8000-000000000001', 'template', 'Upper', 'Heavy', 'c1000000-0000-4000-8000-000000000001', 0),
  ('c2000000-0000-4000-8000-000000000002', 'template', 'Lower', '', 'c1000000-0000-4000-8000-000000000001', 9);
select set_config('test.run', (select r::text from public.start_program('c1000000-0000-4000-8000-000000000001', '2026-11-02',
  array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid]) r), true);
select throws_ok($$ select public.save_run_as_program(current_setting('test.run')::uuid) $$, 'P0001', 'run_not_found',
  'the coach can''t save a run on the client''s calendar');

-- A saves the run as a program of their own.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select subtitle from public.workouts where program_run_id = current_setting('test.run')::uuid and scheduled_for = '2026-11-02'),
  'Strength block · Week 1 · Heavy', 'the run titles its days');
select lives_ok($$ select public.save_run_as_program(current_setting('test.run')::uuid, 'a3000000-0000-4000-8000-000000000001') $$,
  'the client saves the program a coach assigned');
select results_eq($$ select owner_id, title, week_count::int from public.programs where id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values ('aaaaaaaa-0000-4000-8000-0000000000a0'::uuid, 'Strength block', 2) $$, 'as their own, with the run''s title and weeks');
select results_eq($$ select program_day::int, title, subtitle from public.workouts
                    where program_id = 'a3000000-0000-4000-8000-000000000001' order by program_day $$,
  $$ values (0, 'Upper', 'Heavy'), (9, 'Lower', '') $$, 'each day where the run had it, without the run''s prefix');

-- A finished day still counts; one moved off the run's weeks doesn't.
update public.workouts set status = 'completed', completed_at = now()
  where program_run_id = current_setting('test.run')::uuid and scheduled_for = '2026-11-02';
update public.workouts set scheduled_for = '2026-12-31'
  where program_run_id = current_setting('test.run')::uuid and scheduled_for = '2026-11-11';
select lives_ok($$ select public.save_run_as_program(current_setting('test.run')::uuid, 'a3000000-0000-4000-8000-000000000002') $$,
  'saving again makes another program');
select results_eq($$ select program_day::int from public.workouts where program_id = 'a3000000-0000-4000-8000-000000000002' $$,
  $$ values (0) $$, 'with what''s still on its weeks');

-- Saving one day of the run on its own drops the prefix too.
select set_config('test.day', (select id::text from public.workouts
  where program_run_id = current_setting('test.run')::uuid and scheduled_for = '2026-11-02'), true);
select set_config('test.saved', public.copy_workout(current_setting('test.day')::uuid, 'template')::text, true);
select set_config('test.repeat', public.copy_workout(current_setting('test.day')::uuid, 'workout')::text, true);
select is((select subtitle from public.workouts where id = current_setting('test.saved')::uuid),
  'Heavy', 'saving one of its workouts drops the prefix');
select is((select subtitle from public.workouts where id = current_setting('test.repeat')::uuid),
  'Strength block · Week 1 · Heavy', 'repeating it as a workout keeps its subtitle');

-- A stranger can't save the run.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select throws_ok($$ select public.save_run_as_program(current_setting('test.run')::uuid) $$, 'P0001', 'run_not_found',
  'a stranger can''t save it');

select * from finish();
rollback;
