-- Deleting an account: everything of yours goes, and what other people rely on stays.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- C = coach, A = their client, S = a stranger.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true where id = 'cccccccc-0000-4000-8000-0000000000c0';
insert into public.coach_clients (coach_id, client_id) values ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
-- The exercise behind A's block in the workout their coach assigned, by the note left on the block.
create function pg_temp.block_exercise(p_note text) returns uuid language sql as $$
  select exercise_id from public.workout_blocks
  where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and notes = p_note
$$;

set local role authenticated;

-- A trains with a custom exercise of their own, and already has their own "coach row".
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.exercises (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'A Curl'),
  ('a1000000-0000-4000-8000-000000000002', 'coach row');
insert into public.workouts (id, title) values ('a2000000-0000-4000-8000-000000000001', 'A solo');
insert into public.workout_blocks (workout_id, type, exercise_id)
  values ('a2000000-0000-4000-8000-000000000001', 'exercise', 'a1000000-0000-4000-8000-000000000001');
insert into public.training_maxes (exercise_id, value_kg) values ('a1000000-0000-4000-8000-000000000001', 40);

-- C writes a template from their own custom exercises, and a program.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.exercises (id, name, category, equipment, load_basis) values
  ('c1000000-0000-4000-8000-000000000001', 'Coach Press', 'Chest', 'dumbbell', 'per_hand'),
  ('c1000000-0000-4000-8000-000000000002', 'Coach Row', 'Back', 'cable', 'total');
insert into public.workouts (id, kind, title) values ('c2000000-0000-4000-8000-000000000001', 'template', 'Push day');
insert into public.workout_blocks (id, workout_id, type, exercise_id, notes) values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'exercise', 'c1000000-0000-4000-8000-000000000001', 'press'),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'exercise', 'c1000000-0000-4000-8000-000000000002', 'row');
insert into public.workout_sets (block_id, target_reps) values ('c3000000-0000-4000-8000-000000000001', 5);
insert into public.programs (id, title, week_count) values ('c4000000-0000-4000-8000-000000000001', 'Block', 1);
insert into public.workouts (id, kind, title, program_id, program_day)
  values ('c2000000-0000-4000-8000-000000000002', 'template', 'Program day', 'c4000000-0000-4000-8000-000000000001', 0);

-- C assigns both to A and comments.
do $$ begin
  perform public.assign_template('c2000000-0000-4000-8000-000000000001', array['aaaaaaaa-0000-4000-8000-0000000000a0']::uuid[], '2026-11-02');
  perform public.start_program('c4000000-0000-4000-8000-000000000001', '2026-11-02', array['aaaaaaaa-0000-4000-8000-0000000000a0']::uuid[]);
end $$;
insert into public.workout_comments (workout_id, body)
  select id, 'From the coach' from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and title = 'Push day';

-- A logs a set of it, records a max on the coach's exercise and replies.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
update public.workout_sets set actual_reps = 5, actual_weight_kg = 30, completed_at = now()
  where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
insert into public.training_maxes (exercise_id, value_kg) values ('c1000000-0000-4000-8000-000000000001', 50);
insert into public.workout_comments (workout_id, body)
  select id, 'From the client' from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and title = 'Push day';

-- ---------- who can call it ----------
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'signed-out visitors cannot call it');
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select public.delete_my_account() $$, '42501', 'not_authenticated', 'it needs a signed-in user');

-- ---------- a stranger leaves ----------
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select lives_ok($$ select public.delete_my_account() $$, 'a user with no data can delete their account');

set local role postgres;
select is((select count(*) from auth.users where id = 'eeeeeeee-0000-4000-8000-0000000000e0'), 0::bigint, 'their login is gone');
select is((select count(*) from auth.users where email in ('c@test.local', 'a@test.local')), 2::bigint, 'nobody else is touched');

-- ---------- the coach leaves: the client keeps everything of theirs ----------
set local role authenticated;
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select lives_ok($$ select public.delete_my_account() $$, 'a coach with assigned clients can delete their account');

set local role postgres;
select is((select count(*) from auth.users where id = 'cccccccc-0000-4000-8000-0000000000c0'), 0::bigint, 'the coach''s login is gone');
select is((select count(*) from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000c0'), 0::bigint, 'and their profile');
select is((select count(*) from public.exercises where owner_id = 'cccccccc-0000-4000-8000-0000000000c0'), 0::bigint, 'and their custom exercises');
select is((select count(*) from public.workouts where owner_id = 'cccccccc-0000-4000-8000-0000000000c0'), 0::bigint, 'and their templates');
select is((select count(*) from public.programs where owner_id = 'cccccccc-0000-4000-8000-0000000000c0'), 0::bigint, 'and their programs');
select is((select count(*) from public.coach_clients where client_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'the coaching relationship ends');

select is((select assigned_by from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and title = 'Push day'), null,
  'the client keeps the assigned workout, no longer credited to anyone');
select is((select count(*) from public.workout_sets where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and actual_weight_kg = 30), 1::bigint,
  'with the set they logged');
select is((select count(*) from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and title = 'Program day'), 1::bigint,
  'the program''s workouts stay on the client''s calendar');
select is((select assigned_by from public.program_runs where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), null,
  'and so does the program run');

select is((select owner_id from public.exercises where id = pg_temp.block_exercise('press')), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid,
  'the client gets their own copy of the coach''s exercise');
select results_eq(
  $$ select name, category, equipment, load_basis from public.exercises where id = pg_temp.block_exercise('press') $$,
  $$ values ('Coach Press'::text, 'Chest'::text, 'dumbbell'::text, 'per_hand'::text) $$,
  'an exact copy, so loads still work the same');
select is(pg_temp.block_exercise('row'), 'a1000000-0000-4000-8000-000000000002'::uuid,
  'a client who already has an exercise by that name keeps using theirs');
select is((select count(*) from public.exercises where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and lower(name) = 'coach row'), 1::bigint,
  'with no duplicate');
select is((select exercise_id from public.training_maxes where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and value_kg = 50), pg_temp.block_exercise('press'),
  'the client''s max moves to their copy rather than being lost');

select is((select array_agg(body) from public.workout_comments where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), array['From the client'], 'the coach''s comments go; the client''s stay');

-- ---------- the client leaves: nothing of theirs remains ----------
set local role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select lives_ok($$ select public.delete_my_account() $$, 'a user whose workouts use their own custom exercise can delete their account');

set local role postgres;
select is((select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their login is gone');
select is((select count(*) from public.profiles where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their profile is gone');
select is((select count(*) from public.exercises where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their exercises are gone');
select is((select count(*) from public.training_maxes where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their maxes are gone');
select is((select count(*) from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their workouts are gone');
select is((select count(*) from public.workout_sets where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint, 'their sets are gone');
select ok((select count(*) from public.exercises where owner_id is null) > 0, 'the shared exercise library is untouched');

select * from finish();
rollback;
