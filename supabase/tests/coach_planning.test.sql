-- Coach planning: a coach edits the plan of a workout they assigned until the client starts it, and
-- never the log. Everything else of the client's stays read-only to them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- C = coach, A and B = C's clients, D = another coach of A, S = stranger.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'authenticated', 'authenticated', 'b@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-0000000000d0', 'authenticated', 'authenticated', 'd@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true
  where id in ('cccccccc-0000-4000-8000-0000000000c0', 'dddddddd-0000-4000-8000-0000000000d0');
insert into public.coach_clients (coach_id, client_id) values
  ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('cccccccc-0000-4000-8000-0000000000c0', 'bbbbbbbb-0000-4000-8000-0000000000b0'),
  ('dddddddd-0000-4000-8000-0000000000d0', 'aaaaaaaa-0000-4000-8000-0000000000a0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.bench() returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = 'Bench Press'
$$;

set local role authenticated;

-- A keeps a workout of their own.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.workouts (id, title) values ('a0000000-0000-4000-8000-00000000000a', 'A solo');
insert into public.workout_blocks (id, workout_id, type, title) values ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a', 'text', 'Mine');

-- C assigns a template to A, and puts a blank workout on A's calendar.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.workouts (id, kind, title) values ('c0000000-0000-4000-8000-00000000000f', 'template', 'Upper');
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-00000000000f', 'exercise', pg_temp.bench());
insert into public.workout_sets (block_id, target_reps, target_percent) values ('c0000000-0000-4000-8000-0000000000b1', 5, 80);
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f', array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid], '2026-11-02')),
  1::bigint, 'assigning still works, guards and all');
select set_config('test.w', (select id from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and assigned_by is not null)::text, true);
select set_config('test.b', (select id from public.workout_blocks where workout_id = current_setting('test.w')::uuid)::text, true);
select isnt((select assigned_by from public.workouts where id = current_setting('test.w')::uuid), null, 'the copy is stamped as assigned');
select is(public.assign_blank_workout('aaaaaaaa-0000-4000-8000-0000000000a0', '2026-11-03', 'c1000000-0000-4000-8000-000000000001'),
  'c1000000-0000-4000-8000-000000000001'::uuid, 'a coach puts a blank workout on a client''s calendar');
select is((select owner_id from public.workouts where id = 'c1000000-0000-4000-8000-000000000001'), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid,
  'the client owns it');
select throws_ok($$ select public.assign_blank_workout('eeeeeeee-0000-4000-8000-0000000000e0') $$, 'P0001', 'not_your_client',
  'not on a stranger''s calendar');

-- Before A starts it, C edits the plan.
select isnt_empty($$ update public.workouts set title = 'Upper (heavy)', subtitle = 'Week 1', scheduled_for = '2026-11-04'
                    where id = current_setting('test.w')::uuid returning id $$, 'the coach renames and reschedules it');
select lives_ok($$ insert into public.workout_blocks (id, workout_id, type, title, owner_id)
                   values ('c2000000-0000-4000-8000-0000000000b2', current_setting('test.w')::uuid, 'text', 'Warm-up', 'cccccccc-0000-4000-8000-0000000000c0') $$,
  'the coach adds a block');
select is((select owner_id from public.workout_blocks where id = 'c2000000-0000-4000-8000-0000000000b2'), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid,
  'which belongs to the client, whatever owner was sent');
select lives_ok($$ insert into public.workout_sets (id, block_id, target_reps, target_weight_kg)
                   values ('c3000000-0000-4000-8000-000000000001', current_setting('test.b')::uuid, 3, 90) $$, 'the coach adds a set');
select isnt_empty($$ update public.workout_sets set target_reps = 4 where id = 'c3000000-0000-4000-8000-000000000001' returning id $$,
  'the coach edits a set''s plan');
select is_empty($$ update public.workout_sets set owner_id = 'cccccccc-0000-4000-8000-0000000000c0' where id = 'c3000000-0000-4000-8000-000000000001'
                  and owner_id = 'cccccccc-0000-4000-8000-0000000000c0' returning id $$, 'a set can''t be handed to the coach');
select is((select owner_id from public.workout_sets where id = 'c3000000-0000-4000-8000-000000000001'), 'aaaaaaaa-0000-4000-8000-0000000000a0'::uuid,
  'it stays the client''s');
select lives_ok($$ select public.reorder_blocks(current_setting('test.w')::uuid,
                     array['c2000000-0000-4000-8000-0000000000b2'::uuid, current_setting('test.b')::uuid]) $$, 'the coach reorders blocks');
select lives_ok($$ select public.duplicate_block('c2000000-0000-4000-8000-0000000000b2') $$, 'the coach duplicates a block');
select isnt_empty($$ delete from public.workout_sets where id = 'c3000000-0000-4000-8000-000000000001' returning id $$, 'the coach deletes a set');

-- The plan only: never the log, the status or whose it is.
select throws_ok($$ update public.workouts set status = 'completed' where id = current_setting('test.w')::uuid $$, '42501', null,
  'the coach cannot finish it');
select throws_ok($$ update public.workouts set owner_id = 'bbbbbbbb-0000-4000-8000-0000000000b0' where id = current_setting('test.w')::uuid $$, '42501', null,
  'or move it to another client');
select throws_ok($$ update public.workouts set started_at = now() where id = current_setting('test.w')::uuid $$, '42501', null,
  'or start it');
select throws_ok($$ update public.workout_sets set actual_reps = 5 where block_id = current_setting('test.b')::uuid $$, '42501', null,
  'or log a set');
select throws_ok($$ insert into public.workout_sets (block_id, target_reps, completed_at) values (current_setting('test.b')::uuid, 5, now()) $$, '42501', null,
  'or add a set that''s already done');

-- Timed sets and supersets are plan too; a logged time and the session's RPE are the client's.
select isnt_empty($$ update public.workout_sets set target_seconds = 45 where block_id = current_setting('test.b')::uuid returning id $$,
  'the coach plans a timed set');
select isnt_empty($$ update public.workout_blocks set settings = '{"group": "g1", "measure": "sec"}' where id = current_setting('test.b')::uuid returning id $$,
  'and pairs or times an exercise');
select throws_ok($$ update public.workout_sets set actual_seconds = 40 where block_id = current_setting('test.b')::uuid $$, '42501', null,
  'but cannot log a time');
select throws_ok($$ insert into public.workout_sets (block_id, target_seconds, actual_seconds) values (current_setting('test.b')::uuid, 30, 30) $$, '42501', null,
  'or add a set with a time logged');
select throws_ok($$ update public.workouts set rpe = 8 where id = current_setting('test.w')::uuid $$, '42501', null,
  'or rate the session');

-- Not the client's own workouts, nor another coach's assignments.
select is_empty($$ update public.workouts set title = 'x' where id = 'a0000000-0000-4000-8000-00000000000a' returning id $$,
  'the client''s own workouts stay read-only');
select throws_ok($$ insert into public.workout_blocks (workout_id, type) values ('a0000000-0000-4000-8000-00000000000a', 'text') $$, '42501', null,
  'and get no new blocks');
select pg_temp.as_user('dddddddd-0000-4000-8000-0000000000d0');
select is_empty($$ update public.workouts set title = 'x' where id = current_setting('test.w')::uuid returning id $$,
  'another coach can''t edit C''s assignment');

-- The client still has full control of it.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select isnt_empty($$ update public.workout_sets set actual_reps = 5, actual_weight_kg = 80, completed_at = now()
                    where block_id = current_setting('test.b')::uuid returning id $$, 'the client logs a set');
update public.workouts set status = 'in_progress', started_at = now() where id = current_setting('test.w')::uuid;
select isnt_empty($$ update public.workouts set rpe = 7 where id = current_setting('test.w')::uuid returning id $$, 'the client rates the session');

-- Once A has started, it's A's alone.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is_empty($$ update public.workouts set title = 'late edit' where id = current_setting('test.w')::uuid returning id $$,
  'a started workout can''t be edited by the coach');
select is_empty($$ update public.workout_sets set target_reps = 9 where block_id = current_setting('test.b')::uuid returning id $$,
  'nor its sets');
select throws_ok($$ insert into public.workout_blocks (workout_id, type) values (current_setting('test.w')::uuid, 'text') $$, '42501', null,
  'nor added to');
select is_empty($$ delete from public.workouts where id = current_setting('test.w')::uuid returning id $$, 'nor taken back');
select isnt_empty($$ delete from public.workouts where id = 'c1000000-0000-4000-8000-000000000001' returning id $$,
  'an unstarted assignment can still be taken back');

-- Ending the relationship ends the editing.
select isnt_empty($$ select public.assign_blank_workout('bbbbbbbb-0000-4000-8000-0000000000b0', null, 'c1000000-0000-4000-8000-000000000002') $$,
  'C plans for B');
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-0000000000b0');
update public.coach_clients set status = 'ended' where client_id = 'bbbbbbbb-0000-4000-8000-0000000000b0';
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is_empty($$ update public.workouts set title = 'x' where id = 'c1000000-0000-4000-8000-000000000002' returning id $$,
  'a former coach edits nothing');

select * from finish();
rollback;
