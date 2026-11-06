-- Row-level security: users only ever see and change their own rows. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'b@test.local');

select is((select count(*) from public.profiles where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')), 2::bigint,
  'signing up creates a profile');

-- User A builds a workout, a custom exercise and a max.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.exercises (id, name) values ('eeeeeeee-0000-4000-8000-00000000000a', 'A''s Secret Lift');
insert into public.training_maxes (exercise_id, value_kg)
  values ((select id from public.exercises where name = 'Bench Press' and owner_id is null), 100);
insert into public.workouts (id, title) values ('cccccccc-0000-4000-8000-00000000000a', 'A workout');
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('dddddddd-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-00000000000a', 'exercise',
          (select id from public.exercises where name = 'Bench Press' and owner_id is null));
insert into public.workout_sets (block_id, target_reps, target_percent, actual_reps, actual_weight_kg, completed_at)
  values ('dddddddd-0000-4000-8000-00000000000a', 5, 75, 5, 75, now());

select is((select owner_id from public.workout_sets limit 1), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'set owner is inherited from the block');
select is((select count(*) from public.set_log), 1::bigint, 'A sees their own completed set');
select isnt_empty($$ select copy_workout('cccccccc-0000-4000-8000-00000000000a') $$, 'A can copy their own workout');

-- User B sees none of it.
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select is_empty($$ select * from public.workouts $$, 'B cannot see A''s workouts');
select is_empty($$ select * from public.workout_blocks $$, 'B cannot see A''s blocks');
select is_empty($$ select * from public.workout_sets $$, 'B cannot see A''s sets');
select is_empty($$ select * from public.training_maxes $$, 'B cannot see A''s maxes');
select is_empty($$ select * from public.current_maxes $$, 'B cannot see A''s current maxes');
select is_empty($$ select * from public.set_log $$, 'B cannot see A''s set log');
select is_empty($$ select * from public.exercises where owner_id is not null $$, 'B cannot see A''s custom exercises');
select is((select count(*) from public.profiles), 1::bigint, 'B only sees their own profile');
select isnt_empty($$ select * from public.exercises where owner_id is null $$, 'B can read the shared library');
select is_empty(
  $$ select * from exercise_stats(array(select id from public.exercises where name = 'Bench Press'), null, 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'B cannot read A''s exercise stats');

select is_empty($$ update public.workouts set title = 'hacked' where id = 'cccccccc-0000-4000-8000-00000000000a' returning id $$,
  'B cannot update A''s workout');
select throws_ok($$ insert into public.workouts (owner_id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'planted') $$,
  '42501', null, 'B cannot create a workout owned by A');
select throws_ok($$ insert into public.workout_blocks (workout_id, type, title) values ('cccccccc-0000-4000-8000-00000000000a', 'text', 'planted') $$,
  '42501', null, 'B cannot add a block to A''s workout');
select throws_ok($$ insert into public.workout_sets (block_id, target_reps) values ('dddddddd-0000-4000-8000-00000000000a', 1) $$,
  '42501', null, 'B cannot add a set to A''s block');
select throws_ok($$ select copy_workout('cccccccc-0000-4000-8000-00000000000a') $$,
  'P0001', null, 'B cannot copy A''s workout');

-- Anonymous visitors get nothing.
reset role;
set local role anon;
select throws_ok($$ select * from public.workouts $$, '42501', null, 'anon has no table access');

select * from finish();
rollback;
