-- Push notifications: devices and preferences are private; coaching events queue one notification for
-- the right person; reminders and nudges fall due in the trainee's own time zone, once; the dispatcher
-- alone claims and completes them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- C = coach, A = C's client, B = C's client with no device, N = someone to nudge, E = joins by invite.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-0000000000c0', 'authenticated', 'authenticated', 'c@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000b0', 'authenticated', 'authenticated', 'b@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-0000000000d0', 'authenticated', 'authenticated', 'n@test.local'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000e0', 'authenticated', 'authenticated', 'e@test.local');
update public.profiles set is_coach = true, display_name = 'Casey' where id = 'cccccccc-0000-4000-8000-0000000000c0';
update public.profiles set display_name = 'Alex' where id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
update public.profiles set display_name = 'Erin' where id = 'eeeeeeee-0000-4000-8000-0000000000e0';
insert into public.coach_clients (coach_id, client_id) values
  ('cccccccc-0000-4000-8000-0000000000c0', 'aaaaaaaa-0000-4000-8000-0000000000a0'),
  ('cccccccc-0000-4000-8000-0000000000c0', 'bbbbbbbb-0000-4000-8000-0000000000b0');

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
-- The outbox read as the test's superuser, past RLS, whatever role is set.
create function pg_temp.n_count(p uuid, p_category text default null) returns bigint
language sql security definer as $$
  select count(*) from public.notifications where user_id = p and (p_category is null or category = p_category)
$$;
create function pg_temp.n_key(p uuid, p_key text) returns text
language sql security definer as $$
  select (title, body, url)::text from public.notifications where user_id = p and dedupe_key like p_key || '%'
$$;
create function pg_temp.n_workout(p_workout uuid) returns setof public.notifications
language sql security definer as $$
  select * from public.notifications where workout_id = p_workout
$$;

set local role authenticated;

-- ---------- devices and preferences ----------

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select lives_ok($$ select public.register_push_device('ios', 'apns-token-a', null, 'America/New_York') $$, 'a client registers a phone');
select is((select count(*) from public.push_devices), 1::bigint, 'and sees their device');
select is((select timezone from public.notification_prefs), 'America/New_York', 'with their time zone recorded');
select lives_ok($$ select public.register_push_device('web', 'https://push.example/a', '{"endpoint": "https://push.example/a", "keys": {}}', 'America/New_York') $$,
  'and a browser');
select throws_ok($$ select public.register_push_device('fax', 'x') $$, 'P0001', 'bad_device', 'an unknown platform is refused');

select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select lives_ok($$ select public.register_push_device('android', 'fcm-token-c', null, 'Mars/Olympus_Mons') $$, 'the coach registers a phone');
select is((select timezone from public.notification_prefs), 'UTC', 'an unknown time zone falls back to UTC');
select is((select count(*) from public.push_devices), 1::bigint, 'the coach sees only their own device');
select is((select count(*) from public.notification_prefs), 1::bigint, 'and only their own preferences');
select is_empty($$ update public.notification_prefs set reminders = false where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' returning 1 $$,
  'and can''t change a client''s');
select throws_ok($$ insert into public.push_devices (user_id, platform, token) values ('cccccccc-0000-4000-8000-0000000000c0', 'ios', 'planted') $$,
  '42501', null, 'devices are only added through registration');
select throws_ok($$ select public.enqueue_notification('aaaaaaaa-0000-4000-8000-0000000000a0', 'nudge', 'hi', 'there', '/') $$,
  '42501', null, 'nobody queues notifications directly');
select throws_ok($$ select * from public.claim_push_batch(10) $$, '42501', null, 'or claims them');

-- The same browser signing into another account moves the subscription with it.
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select lives_ok($$ select public.register_push_device('web', 'https://push.example/a', '{"endpoint": "https://push.example/a", "keys": {}}', 'Europe/London') $$,
  'another account registers the same browser');
select is((select user_id from public.push_devices where token = 'https://push.example/a'), 'eeeeeeee-0000-4000-8000-0000000000e0'::uuid,
  'and takes it over');

-- ---------- coaching events ----------

select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.workouts (id, kind, title) values ('c0000000-0000-4000-8000-00000000000f', 'template', 'Upper');
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f',
  array['aaaaaaaa-0000-4000-8000-0000000000a0', 'bbbbbbbb-0000-4000-8000-0000000000b0']::uuid[], '2026-11-20', '18:30')), 2::bigint,
  'the coach assigns a workout to two clients');
select set_config('test.w', (select id::text from public.workouts where owner_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and title = 'Upper'), true);
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'coach_updates'), 1::bigint, 'the client with a phone is notified');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'assigned:'),
  format('("New workout from Casey","Upper · Fri, Nov 20 · 6:30 PM",/w/%s)', current_setting('test.w')),
  'saying who, what and when, and opening it');
select is(pg_temp.n_count('bbbbbbbb-0000-4000-8000-0000000000b0'), 0::bigint, 'nothing is queued for someone with no device');

select is(public.assign_blank_workout('aaaaaaaa-0000-4000-8000-0000000000a0', '2026-11-21', 'c1000000-0000-4000-8000-000000000001'),
  'c1000000-0000-4000-8000-000000000001'::uuid, 'a blank workout on the client''s calendar');
select ok((select send_after >= now() + interval '4 minutes' from pg_temp.n_workout('c1000000-0000-4000-8000-000000000001')),
  'waits a few minutes, while the coach fills it in');
delete from public.workouts where id = 'c1000000-0000-4000-8000-000000000001';
select is((select count(*) from pg_temp.n_workout('c1000000-0000-4000-8000-000000000001')), 0::bigint,
  'and goes if the coach throws it away');

-- A program is one notification, however many workouts it puts on the calendar.
insert into public.programs (id, title, week_count) values ('c2000000-0000-4000-8000-000000000001', 'Strength block', 1);
insert into public.workouts (kind, title, program_id, program_day) values
  ('template', 'Day 1', 'c2000000-0000-4000-8000-000000000001', 0),
  ('template', 'Day 2', 'c2000000-0000-4000-8000-000000000001', 2);
select lives_ok($$ select public.start_program('c2000000-0000-4000-8000-000000000001', '2026-11-23', array['aaaaaaaa-0000-4000-8000-0000000000a0']::uuid[]) $$,
  'the coach starts a program for the client');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'coach_updates'), 2::bigint, 'which is one more notification, not one per workout');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'run:'),
  '("Casey started a program for you","Strength block · starts Mon, Nov 23",/workouts?week=2026-11-23)', 'naming the program and its start');

-- Comments go to the other side.
insert into public.workout_comments (workout_id, body) values (current_setting('test.w')::uuid, 'Go easy on the last set.');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'comments'), 1::bigint, 'a coach''s comment notifies the client');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'comment:'),
  format('("Casey commented on Upper","Go easy on the last set.",/w/%s)', current_setting('test.w')), 'with what they said');
select is(pg_temp.n_count('cccccccc-0000-4000-8000-0000000000c0', 'comments'), 0::bigint, 'not the coach who wrote it');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
insert into public.workout_comments (workout_id, body) values (current_setting('test.w')::uuid, 'Will do!');
select is(pg_temp.n_count('cccccccc-0000-4000-8000-0000000000c0', 'comments'), 1::bigint, 'and the client''s reply notifies the coach');

-- Turning a kind off stops it.
update public.notification_prefs set coach_updates = false;
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
select is((select count(*) from public.assign_template('c0000000-0000-4000-8000-00000000000f',
  array['aaaaaaaa-0000-4000-8000-0000000000a0']::uuid[], '2026-11-27')), 1::bigint, 'the coach assigns another');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'coach_updates'), 2::bigint, 'but a client who turned coach updates off isn''t told');

-- The client finishing it tells the coach.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-0000000000a0');
select lives_ok($$ select public.finish_workout(current_setting('test.w')::uuid) $$, 'the client finishes the assigned workout');
select is(pg_temp.n_key('cccccccc-0000-4000-8000-0000000000c0', 'finished:'),
  format('("Alex finished Upper","Tap to see how it went.",/w/%s)', current_setting('test.w')), 'and the coach hears about it');

-- Someone joining by invite tells the coach.
select pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c0');
insert into public.coach_invites (code, label) values ('NOTIFY01', 'Gym friends');
select pg_temp.as_user('eeeeeeee-0000-4000-8000-0000000000e0');
select lives_ok($$ select public.accept_invite('NOTIFY01') $$, 'someone accepts the invite');
select is(pg_temp.n_key('cccccccc-0000-4000-8000-0000000000c0', 'joined:'),
  '("Erin joined as your client","From your invite ""Gym friends"".",/coach/clients/eeeeeeee-0000-4000-8000-0000000000e0)',
  'and the coach hears who joined');

-- ---------- reminders ----------

reset role;
delete from public.notifications;
-- A: an evening workout in New York, one the morning after the clocks change, and two untimed ones.
insert into public.workouts (id, owner_id, title, scheduled_for, scheduled_time) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Evening', '2026-11-20', '18:30'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'After DST', '2026-03-09', '09:00'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Squats', '2026-11-21', null),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'Conditioning', '2026-11-21', null);

-- 18:30 in New York on Nov 20 is 23:30 UTC; 30 minutes before is 23:00.
select public.queue_due_reminders('2026-11-20 22:59:00+00');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'reminder'), 0::bigint, 'not before the lead time');
select public.queue_due_reminders('2026-11-20 23:01:00+00');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'rem:a1000000-0000-4000-8000-000000000001'),
  '("Evening at 6:30 PM","Starts in 30 minutes.",/w/a1000000-0000-4000-8000-000000000001)', 'half an hour before, in their time zone');
select public.queue_due_reminders('2026-11-20 23:02:00+00');
select public.queue_due_reminders('2026-11-20 23:30:00+00');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'reminder'), 1::bigint, 'once, however often the job runs');

-- Clocks went forward on Mar 8, 2026: 09:00 on Mar 9 is 13:00 UTC (EDT), not 14:00 (EST).
select public.queue_due_reminders('2026-03-09 12:31:00+00');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'rem:a1000000-0000-4000-8000-000000000002'),
  '("After DST at 9:00 AM","Starts in 30 minutes.",/w/a1000000-0000-4000-8000-000000000002)', 'across a daylight-saving change');

-- Untimed workouts: one notification at 8:00 local (13:00 UTC in November).
select public.queue_due_reminders('2026-11-21 12:59:00+00');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'reminder'), 2::bigint, 'untimed workouts wait for the morning reminder');
select public.queue_due_reminders('2026-11-21 13:03:00+00');
select is(pg_temp.n_key('aaaaaaaa-0000-4000-8000-0000000000a0', 'day:'), '("2 workouts today","Squats, Conditioning",/workouts)',
  'then come together in one');

-- A workout under way isn't reminded.
update public.workouts set status = 'in_progress', scheduled_for = '2026-11-22' where id = 'a1000000-0000-4000-8000-000000000001';
select public.queue_due_reminders('2026-11-22 23:01:00+00');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'reminder'), 3::bigint, 'a workout already under way gets no reminder');

-- Nor is anyone who turned reminders off.
update public.notification_prefs set reminders = false where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0';
update public.workouts set status = 'planned' where id = 'a1000000-0000-4000-8000-000000000001';
select public.queue_due_reminders('2026-11-22 23:01:00+00');
select is(pg_temp.n_count('aaaaaaaa-0000-4000-8000-0000000000a0', 'reminder'), 3::bigint, 'or for someone who turned reminders off');

-- ---------- nudges ----------

-- N has had notifications on for a month, in UTC, and nothing planned.
insert into public.push_devices (user_id, platform, token) values ('dddddddd-0000-4000-8000-0000000000d0', 'android', 'fcm-token-n');
insert into public.notification_prefs (user_id, timezone, created_at) values ('dddddddd-0000-4000-8000-0000000000d0', 'UTC', '2026-10-01');
select public.queue_due_reminders('2026-11-20 09:59:00+00');
select is(pg_temp.n_count('dddddddd-0000-4000-8000-0000000000d0', 'nudge'), 0::bigint, 'nudges wait for 10:00');
select public.queue_due_reminders('2026-11-20 10:02:00+00');
select is(pg_temp.n_key('dddddddd-0000-4000-8000-0000000000d0', 'nudge:'),
  '("Time to plan your next workout?","Nothing''s on your plan yet. Add a workout to get going.",/workouts)',
  'then nudge someone with nothing planned');
select public.queue_due_reminders('2026-11-22 10:02:00+00');
select is(pg_temp.n_count('dddddddd-0000-4000-8000-0000000000d0', 'nudge'), 1::bigint, 'and not again within the next five days');
insert into public.workouts (owner_id, title, scheduled_for) values ('dddddddd-0000-4000-8000-0000000000d0', 'Back at it', '2026-11-30');
select public.queue_due_reminders('2026-11-27 10:02:00+00');
select is(pg_temp.n_count('dddddddd-0000-4000-8000-0000000000d0', 'nudge'), 1::bigint, 'nor once something is on the plan');

-- ---------- dispatch ----------

update public.notifications set send_after = now() - interval '1 minute';
set local role service_role;
select is((select count(*) from public.claim_push_batch(100) where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 3::bigint,
  'the dispatcher claims what''s due');
select is((select count(*) from public.claim_push_batch(100) where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0'), 0::bigint,
  'and nothing is claimed twice');
select public.complete_push((
  select jsonb_agg(jsonb_build_object('id', n.id, 'dead', jsonb_build_array(d.id)))
  from public.notifications n, public.push_devices d
  where n.user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and d.token = 'apns-token-a'
));
select public.complete_push((
  select jsonb_agg(jsonb_build_object('id', n.id, 'error', 'timeout', 'retry', true))
  from public.notifications n where n.user_id = 'dddddddd-0000-4000-8000-0000000000d0'
));
reset role;
select is((select count(*) from public.push_devices where token = 'apns-token-a'), 0::bigint, 'a dead token is removed');
select is((select count(*) from public.notifications where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a0' and sent_at is null), 0::bigint,
  'and the batch is done');
select is((select (sent_at is null, attempts, error)::text from public.notifications where user_id = 'dddddddd-0000-4000-8000-0000000000d0'),
  '(t,1,timeout)', 'a temporary failure is tried again later');

select * from finish();
rollback;
