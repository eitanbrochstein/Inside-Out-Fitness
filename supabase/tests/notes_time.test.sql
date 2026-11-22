-- Workout notes, exercise notes and planned times: a coach writes them on an assignment until the
-- client starts it; the client reads a coach's notes but can't change them, and keeps full control of
-- notes on their own workouts. Copies carry notes; only dated copies carry a time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- C = coach, A = C's client.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local');
update public.profiles set is_coach = true where id = 'cccccccc-0000-4000-8000-0000000000c0';
insert into public.coach_clients (coach_id, client_id) values ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.bench() returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = 'Bench Press'
$$;

set local role authenticated;

-- C writes a template with notes, and assigns it to A at 6:30 pm.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.workouts (id, kind, title, notes) values ('c0000000-0000-4000-8000-00000000000f', 'template', 'Upper', 'Rest 2 min between sets.');
insert into public.workout_blocks (id, workout_id, type, exercise_id, notes)
  values ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-00000000000f', 'exercise', pg_temp.bench(), 'Elbows tucked.');
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f',
  array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid], '2026-11-24', '18:30')), 1::bigint, 'the coach assigns it with a time');
select set_config('test.w', (select id from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and assigned_by is not null)::text, true);
select set_config('test.b', (select id from public.workout_blocks where workout_id = current_setting('test.w')::uuid)::text, true);
select is((select scheduled_time from public.workouts where id = current_setting('test.w')::uuid), '18:30'::time, 'the copy has the time');
select is((select notes from public.workouts where id = current_setting('test.w')::uuid), 'Rest 2 min between sets.', 'and the workout note');
select is((select notes from public.workout_blocks where id = current_setting('test.b')::uuid), 'Elbows tucked.', 'and the exercise note');
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f',
  array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid], null, '07:00')), 1::bigint, 'assigning without a date');
select is((select scheduled_time from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and scheduled_for is null),
  null, 'leaves out the time too');

-- Before A starts it, C edits the notes and the time.
select isnt_empty($$ update public.workouts set notes = 'Rest 3 min.', scheduled_time = '19:00'
                    where id = current_setting('test.w')::uuid returning id $$, 'the coach edits the workout note and time');
select isnt_empty($$ update public.workout_blocks set notes = 'Elbows tucked, pause on the chest.'
                    where id = current_setting('test.b')::uuid returning id $$, 'and the exercise note');

-- A reads them but can't change them.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select notes from public.workouts where id = current_setting('test.w')::uuid), 'Rest 3 min.', 'the client sees the coach''s note');
select throws_ok($$ update public.workouts set notes = 'meh' where id = current_setting('test.w')::uuid $$, '42501', 'coach_note_locked',
  'the client can''t change a coach''s workout note');
select throws_ok($$ update public.workout_blocks set notes = 'meh' where id = current_setting('test.b')::uuid $$, '42501', 'coach_note_locked',
  'or exercise note');
select isnt_empty($$ update public.workouts set scheduled_time = '06:00', title = 'Upper (early)' where id = current_setting('test.w')::uuid returning id $$,
  'but can move it to another time, and change the rest');
select lives_ok($$ select public.duplicate_block(current_setting('test.b')::uuid) $$, 'duplicating a coach''s exercise works');
select is((select count(*) from public.workout_blocks where workout_id = current_setting('test.w')::uuid and notes like 'Elbows tucked%'),
  2::bigint, 'and the copy keeps its note');

-- On their own workouts, notes are theirs.
insert into public.workouts (id, title, scheduled_for, scheduled_time) values ('a0000000-0000-4000-8000-00000000000a', 'Solo', '2026-11-25', '07:15');
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a', 'exercise', pg_temp.bench());
select isnt_empty($$ update public.workouts set notes = 'Felt strong.' where id = 'a0000000-0000-4000-8000-00000000000a' returning id $$,
  'the client writes a note on their own workout');
select isnt_empty($$ update public.workout_blocks set notes = 'Belt on.' where id = 'a0000000-0000-4000-8000-0000000000b1' returning id $$,
  'and on their own exercise');

-- Copies: a dated copy keeps the time, a template doesn't.
select set_config('test.repeat', public.copy_workout('a0000000-0000-4000-8000-00000000000a', 'workout',
  'aaaaaaaa-0000-4000-8000-0000000000a0', '2026-12-02')::text, true);
select set_config('test.saved', public.copy_workout('a0000000-0000-4000-8000-00000000000a', 'template')::text, true);
select is((select scheduled_time from public.workouts where id = current_setting('test.repeat')::uuid), '07:15'::time,
  'repeating a workout on another day keeps its time');
select is((select (notes, scheduled_time)::text from public.workouts where id = current_setting('test.saved')::uuid),
  '("Felt strong.",)', 'saving it keeps the note but not the time');

-- Once A starts the assignment, C can't change the notes any more.
select isnt_empty($$ update public.workouts set status = 'in_progress', started_at = now() where id = current_setting('test.w')::uuid returning id $$,
  'the client starts it');
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is_empty($$ update public.workout_blocks set notes = 'too late' where id = current_setting('test.b')::uuid returning id $$,
  'then the coach can''t edit the exercise note');

select * from finish();
rollback;
