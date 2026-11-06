-- Coaching access: a coach reads (never edits) an active client's training; strangers see nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- C = coach, A = client, S = stranger who is also a coach.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 's@test.local');
update public.profiles set is_coach = true where id in ('cccccccc-0000-4000-8000-0000000000c0', 'eeeeeeee-0000-4000-8000-0000000000e0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.bench() returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = 'Bench Press'
$$;

set local role authenticated;

-- A trains on their own and has a max.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.training_maxes (exercise_id, value_kg) values (pg_temp.bench(), 100);
insert into public.workouts (id, title) values ('a0000000-0000-4000-8000-00000000000a', 'A solo');
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a', 'exercise', pg_temp.bench());
insert into public.workout_sets (block_id, target_reps, actual_reps, actual_weight_kg, completed_at)
  values ('a0000000-0000-4000-8000-0000000000b1', 5, 5, 80, now());
select throws_ok($$ insert into public.coach_invites default values $$, '42501', null, 'non-coaches cannot create invites');

-- C invites A; before accepting, C sees nothing of A.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.coach_invites (code) values ('TESTCODE');
select is_empty($$ select * from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' $$,
  'before joining, the coach cannot see the client');
select is((select status from public.invite_preview('TESTCODE')), 'own', 'the coach cannot accept their own invite');

-- S cannot use or see the invite; A accepts it.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select is_empty($$ select * from public.coach_invites $$, 'invites are private to their coach');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select status from public.invite_preview('testcode')), 'valid', 'codes are case-insensitive');
select is(public.accept_invite('TESTCODE'), 'cccccccc-0000-4000-8000-0000000000c0'::uuid, 'the client accepts the invite');
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select throws_ok($$ select public.accept_invite('TESTCODE') $$, 'P0001', 'invite_used', 'an accepted invite cannot be reused');

-- C now reads A's training, but cannot change it.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is((select count(*) from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 1::bigint, 'coach reads client workouts');
select is((select count(*) from public.workout_sets where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 1::bigint, 'coach reads client sets');
select is((select count(*) from public.current_maxes where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 1::bigint, 'coach reads client maxes');
select is((select count(*) from public.exercise_stats(array[pg_temp.bench()], null, 'aaaaaaaa-0000-4000-8000-0000000000a0')), 1::bigint,
  'coach reads client exercise stats');
select isnt((select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), null, 'coach reads client profile');
select is_empty($$ update public.workouts set title = 'edited by coach' where id = 'a0000000-0000-4000-8000-00000000000a' returning id $$,
  'coach cannot edit a client workout');
select is_empty($$ update public.workout_sets set actual_reps = 99 where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' returning id $$,
  'coach cannot edit client sets');
select throws_ok($$ insert into public.workout_blocks (workout_id, type, title) values ('a0000000-0000-4000-8000-00000000000a', 'text', 'x') $$,
  '42501', null, 'coach cannot add blocks to a client workout');
select lives_ok($$ insert into public.training_maxes (owner_id, exercise_id, value_kg) values ('aaaaaaaa-0000-4000-8000-0000000000a0', pg_temp.bench(), 105) $$,
  'coach can record a client max');

-- Templates and assignment.
insert into public.workouts (id, kind, title) values ('c0000000-0000-4000-8000-00000000000f', 'template', 'Upper Body A');
insert into public.workout_blocks (id, workout_id, type, exercise_id)
  values ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-00000000000f', 'exercise', pg_temp.bench());
insert into public.workout_sets (block_id, target_reps, target_percent) values ('c0000000-0000-4000-8000-0000000000b1', 5, 80);
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f', array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid], current_date)),
  1::bigint, 'coach assigns a template to a client');
select throws_ok($$ select public.assign_template('c0000000-0000-4000-8000-00000000000f', array['eeeeeeee-0000-4000-8000-0000000000e0'::uuid]) $$,
  'P0001', 'not_your_client', 'coach cannot assign to someone who is not their client');

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select count(*) from public.workouts where assigned_by = 'cccccccc-0000-4000-8000-0000000000c0'), 1::bigint,
  'the client owns the assigned copy');
select is((select s.target_percent from public.workout_sets s join public.workout_blocks b on b.id = s.block_id
           join public.workouts w on w.id = b.workout_id where w.assigned_by is not null), 80::numeric,
  'the copy keeps the percentage, so it resolves against the client''s own max');
select is_empty($$ select * from public.workouts where kind = 'template' $$, 'the client cannot see the master template');
update public.workout_sets set target_percent = 70
  where block_id in (select b.id from public.workout_blocks b join public.workouts w on w.id = b.workout_id where w.assigned_by is not null);
select isnt_empty($$ select * from public.workouts where assigned_by is not null $$, 'the client can edit their copy');

select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is((select target_percent from public.workout_sets where block_id = 'c0000000-0000-4000-8000-0000000000b1'), 80::numeric,
  'client edits never reach the master template');

-- S (another coach) cannot see or assign to A.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select is_empty($$ select * from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' $$, 'another coach sees nothing');
select is_empty($$ select * from public.training_maxes where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' $$, 'another coach sees no maxes');
select throws_ok($$ insert into public.training_maxes (owner_id, exercise_id, value_kg) values ('aaaaaaaa-0000-4000-8000-0000000000a0', pg_temp.bench(), 500) $$,
  '42501', null, 'another coach cannot set a client max');
select throws_ok($$ select public.assign_template('c0000000-0000-4000-8000-00000000000f', array['aaaaaaaa-0000-4000-8000-0000000000a0'::uuid]) $$,
  'P0001', 'template_not_found', 'nobody can assign someone else''s template');

-- Comments: coach and client share a thread; strangers don't.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.workout_comments (workout_id, body) values ('a0000000-0000-4000-8000-00000000000a', 'Great bar speed.');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select is((select body from public.workout_comments), 'Great bar speed.', 'the client reads the coach''s comment');
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select is_empty($$ select * from public.workout_comments $$, 'strangers cannot read comments');
select throws_ok($$ insert into public.workout_comments (workout_id, body) values ('a0000000-0000-4000-8000-00000000000a', 'hi') $$,
  '42501', null, 'strangers cannot comment');

-- Ending the relationship removes access.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
update public.coach_clients set status = 'ended' where client_id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is_empty($$ select * from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' $$,
  'after the client leaves, the coach loses access');

select * from finish();
rollback;
