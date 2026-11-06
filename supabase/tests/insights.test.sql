-- Training totals and personal records: correct sums, records only against earlier sessions,
-- and visible to the owner and an active coach only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- A = athlete, C = A's coach, S = stranger.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true where id = 'cccccccc-0000-4000-8000-0000000000c0';

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.ex(p_name text) returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = p_name
$$;
-- Logs one completed set in a new or existing block of the given workout.
create function pg_temp.log(p_workout uuid, p_exercise text, p_weight numeric, p_reps int) returns void language sql as $$
  insert into public.workout_blocks (id, workout_id, type, exercise_id)
    select gen_random_uuid(), p_workout, 'exercise', pg_temp.ex(p_exercise)
    where not exists (select 1 from public.workout_blocks b where b.workout_id = p_workout and b.exercise_id = pg_temp.ex(p_exercise));
  insert into public.workout_sets (block_id, actual_weight_kg, actual_reps, completed_at)
    select b.id, p_weight, p_reps, now() from public.workout_blocks b
    where b.workout_id = p_workout and b.exercise_id = pg_temp.ex(p_exercise);
$$;

set local role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');

-- Three sessions, two weeks apart then a week apart then yesterday.
insert into public.workouts (id, title, status, started_at, completed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'W1', 'completed', now() - interval '14 days 1 hour', now() - interval '14 days'),
  ('a0000000-0000-4000-8000-000000000002', 'W2', 'completed', now() - interval '7 days 1 hour', now() - interval '7 days'),
  ('a0000000-0000-4000-8000-000000000003', 'W3', 'completed', now() - interval '1 day 1 hour', now() - interval '1 day');
select pg_temp.log('a0000000-0000-4000-8000-000000000001', 'Bench Press', 100, 5);
select pg_temp.log('a0000000-0000-4000-8000-000000000001', 'Dumbbell Shoulder Press', 30, 10);
select pg_temp.log('a0000000-0000-4000-8000-000000000001', 'Pull-Up', null, 10);
select pg_temp.log('a0000000-0000-4000-8000-000000000002', 'Bench Press', 105, 3);
select pg_temp.log('a0000000-0000-4000-8000-000000000002', 'Dumbbell Shoulder Press', 30, 10);
select pg_temp.log('a0000000-0000-4000-8000-000000000002', 'Pull-Up', null, 12);
select pg_temp.log('a0000000-0000-4000-8000-000000000003', 'Bench Press', 100, 8);
-- A second bench set in W1, and one planned but never logged.
insert into public.workout_sets (block_id, actual_weight_kg, actual_reps, completed_at)
  select id, 90, 8, now() from public.workout_blocks
  where workout_id = 'a0000000-0000-4000-8000-000000000001' and exercise_id = pg_temp.ex('Bench Press');
insert into public.workout_sets (block_id, target_reps)
  select id, 5 from public.workout_blocks
  where workout_id = 'a0000000-0000-4000-8000-000000000001' and exercise_id = pg_temp.ex('Bench Press');
-- A template with a ticked set never counts as training.
insert into public.workouts (id, kind, title) values ('a0000000-0000-4000-8000-0000000000ff', 'template', 'T');
select pg_temp.log('a0000000-0000-4000-8000-0000000000ff', 'Bench Press', 200, 5);

-- epley_kg
select is(round(public.epley_kg(100, 5), 2), 116.67, 'epley: 100 × 5 ≈ 116.67');
select is(public.epley_kg(100, 1), 100::numeric, 'epley: a single is the 1RM');
select is(public.epley_kg(100, 13), null, 'epley: not trusted past 12 reps');

-- training_summary
select is((select count(*) from public.training_summary()), 3::bigint, 'one summary row per logged workout, templates excluded');
select is((select set_count from public.training_summary() where title = 'W1'), 4, 'unlogged sets are not counted');
select is((select rep_count from public.training_summary() where title = 'W1'), 33, 'reps add up');
select is((select volume_kg from public.training_summary() where title = 'W1'), 1820::numeric,
  'volume: 100×5 + 90×8 + both hands of 30×10, bodyweight adds none');
select is((select categories -> 'Chest' ->> 'sets' from public.training_summary() where title = 'W1'), '2', 'sets are split by muscle group');
select is((select categories -> 'Shoulders' ->> 'volume_kg' from public.training_summary() where title = 'W1'), '600', 'per-hand volume per group');
select is((select (categories -> 'Back' ->> 'reps')::int from public.training_summary() where title = 'W1'), 10, 'bodyweight reps per group');
select is((select count(*) from public.training_summary(p_since => now() - interval '3 days')), 1::bigint, 'p_since limits the window');
select is((select status from public.training_summary() where title = 'W3'), 'completed', 'rows carry the workout status');

-- personal_records
select is((select count(*) from public.personal_records()), 3::bigint, 'first sessions are baselines; repeats are not records');
select results_eq(
  $$ select kind, weight_kg, reps, value, previous from public.personal_records() where kind = 'weight' $$,
  $$ values ('weight', 105::numeric, 3, 105::numeric, 100::numeric) $$,
  'a heavier top set is a weight record, against the earlier best');
select results_eq(
  $$ select kind, weight_kg, reps, round(value, 2) from public.personal_records() where kind = 'e1rm' $$,
  $$ values ('e1rm', 100::numeric, 8, 126.67) $$,
  'more reps at a lighter weight can be an estimated-1RM record');
select results_eq(
  $$ select kind, weight_kg, reps, value, previous from public.personal_records() where kind = 'reps' $$,
  $$ values ('reps', null::numeric, 12, 12::numeric, 10::numeric) $$,
  'bodyweight sets set rep records');
select is((select kind from public.personal_records(p_workout => 'a0000000-0000-4000-8000-000000000003')), 'e1rm', 'p_workout limits to one workout');
select is((select count(*) from public.personal_records(p_since => now() - interval '3 days')), 1::bigint, 'p_since limits the window');

-- exercise_stats
select is((select round(best_e1rm_kg, 2) from public.exercise_stats(array[pg_temp.ex('Bench Press')])), 126.67, 'exercise_stats reports the best e1RM');

-- weekly goal
select is((select weekly_goal from public.profiles where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 3::smallint, 'weekly goal defaults to 3');

-- Visibility: a stranger sees nothing; an active coach sees it all until the client leaves.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select is_empty($$ select * from public.training_summary('aaaaaaaa-0000-4000-8000-0000000000a0') $$, 'a stranger sees no totals');
select is_empty($$ select * from public.personal_records('aaaaaaaa-0000-4000-8000-0000000000a0') $$, 'a stranger sees no records');

select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.coach_invites (code) values ('INSIGHTS');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select public.accept_invite('INSIGHTS');
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is((select count(*) from public.personal_records('aaaaaaaa-0000-4000-8000-0000000000a0')), 3::bigint, 'the coach sees the client''s records');

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
update public.coach_clients set status = 'ended' where client_id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is_empty($$ select * from public.training_summary('aaaaaaaa-0000-4000-8000-0000000000a0') $$,
  'after the client leaves, the coach sees no totals');

select * from finish();
rollback;
