-- Local development only (`supabase db reset`). Never pushed to hosted projects.
-- Sign in as demo@local.test / password123: 8 weeks of history, this week's planned workouts, two saved
-- workouts and a 4-week program starting next Monday (the planning demo at the end).

create function pg_temp.lb(x numeric) returns numeric language sql as $$ select x * 0.45359237 $$;
-- Half-up to the nearest 5 lb, matching load.ts.
create function pg_temp.r5(x numeric) returns numeric language sql as $$ select floor(x / 5 + 0.5) * 5 $$;
create function pg_temp.ex(p_name text) returns uuid language sql as $$
  select id from public.exercises where owner_id is null and name = p_name
$$;

create function pg_temp.text_block(p_workout uuid, p_pos int, p_title text, p_body text) returns void
language sql as $$
  insert into public.workout_blocks (workout_id, position, type, title, body)
  values (p_workout, p_pos, 'text', p_title, p_body)
$$;

create function pg_temp.exercise_block(p_workout uuid, p_pos int, p_exercise text) returns uuid
language sql as $$
  insert into public.workout_blocks (workout_id, position, type, exercise_id)
  values (p_workout, p_pos, 'exercise', pg_temp.ex(p_exercise))
  returning id
$$;

-- Weights in lb. p_done null = not logged.
create function pg_temp.add_set(
  p_block uuid, p_pos int, p_reps int, p_pct numeric, p_target_lb numeric,
  p_done timestamptz default null, p_max_lb numeric default null, p_actual_lb numeric default null, p_actual_reps int default null
) returns void language sql as $$
  insert into public.workout_sets (
    block_id, position, target_reps, target_percent, target_weight_kg,
    basis_max_kg, prescribed_load_kg, actual_reps, actual_weight_kg, completed_at
  ) values (
    p_block, p_pos, p_reps, p_pct, pg_temp.lb(p_target_lb),
    case when p_done is not null and p_pct is not null then pg_temp.lb(p_max_lb) end,
    case when p_done is not null and p_pct is not null then pg_temp.lb(pg_temp.r5(p_max_lb * p_pct / 100)) end,
    case when p_done is not null then coalesce(p_actual_reps, p_reps) end,
    case when p_done is not null then pg_temp.lb(coalesce(p_actual_lb,
      case when p_pct is not null then pg_temp.r5(p_max_lb * p_pct / 100) else p_target_lb end)) end,
    p_done
  )
$$;

do $$
declare
  uid constant uuid := '11111111-1111-4111-8111-111111111111';
  week0 constant timestamptz := date_trunc('week', now()) - interval '8 weeks';
  wk int;
  mon timestamptz;
  thu timestamptz;
  bench_max numeric;
  squat_max numeric;
  w uuid;
  b uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'demo@local.test',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Demo"}', now() - interval '9 weeks', now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', 'demo@local.test', 'email_verified', true),
    'email', now(), now(), now());

  -- Maxes: Bench 215 → 225, Squat 275 → 295, Deadlift 345.
  insert into public.training_maxes (owner_id, exercise_id, kind, value_kg, recorded_on, created_at) values
    (uid, pg_temp.ex('Bench Press'), 'one_rm', pg_temp.lb(215), (week0)::date, week0),
    (uid, pg_temp.ex('Bench Press'), 'one_rm', pg_temp.lb(225), (week0 + interval '4 weeks')::date, week0 + interval '4 weeks'),
    (uid, pg_temp.ex('Back Squat'), 'one_rm', pg_temp.lb(275), (week0)::date, week0),
    (uid, pg_temp.ex('Back Squat'), 'one_rm', pg_temp.lb(295), (week0 + interval '4 weeks')::date, week0 + interval '4 weeks'),
    (uid, pg_temp.ex('Deadlift'), 'one_rm', pg_temp.lb(345), (week0)::date, week0);

  for wk in 1..8 loop
    mon := week0 + (wk - 1) * interval '1 week' + interval '7 hours 30 minutes';
    thu := mon + interval '3 days' + interval '10 hours';
    bench_max := case when wk <= 4 then 215 else 225 end;
    squat_max := case when wk <= 4 then 275 else 295 end;

    -- Upper Body A
    insert into public.workouts (owner_id, title, subtitle, status, scheduled_for, started_at, completed_at, created_at)
    values (uid, 'Upper Body A', 'Strength block · Week ' || wk, 'completed', mon::date, mon, mon + interval '55 minutes', mon - interval '1 day')
    returning id into w;
    perform pg_temp.text_block(w, 0, 'Warm-up', E'5 min cardio, shoulder mobility,\n2–3 progressive warm-up sets.');
    perform pg_temp.text_block(w, 1, 'Strength', '');
    b := pg_temp.exercise_block(w, 2, 'Bench Press');
    perform pg_temp.add_set(b, 0, 8, 60, null, mon + interval '10 minutes', bench_max);
    perform pg_temp.add_set(b, 1, 5, 75, null, mon + interval '14 minutes', bench_max);
    perform pg_temp.add_set(b, 2, 3, 85, null, mon + interval '18 minutes', bench_max,
      null, case when wk = 7 then 2 end); -- one missed rep in week 7
    b := pg_temp.exercise_block(w, 3, 'Dumbbell Row');
    for i in 0..2 loop
      perform pg_temp.add_set(b, i, 10, null, null, mon + interval '25 minutes', null, 60 + 5 * ((wk - 1) / 2));
    end loop;
    b := pg_temp.exercise_block(w, 4, 'Overhead Press');
    for i in 0..2 loop
      perform pg_temp.add_set(b, i, 5, null, 85 + 5 * ((wk - 1) / 3), mon + interval '40 minutes');
    end loop;
    perform pg_temp.text_block(w, 5, 'Coaching notes', 'Controlled lowering; stop 1–2 reps shy.');

    -- Lower Body A
    insert into public.workouts (owner_id, title, subtitle, status, scheduled_for, started_at, completed_at, created_at)
    values (uid, 'Lower Body A', 'Strength block · Week ' || wk, 'completed', thu::date, thu, thu + interval '50 minutes', thu - interval '1 day')
    returning id into w;
    perform pg_temp.text_block(w, 0, 'Warm-up', 'Bike 5 min, hip openers, empty-bar squats.');
    b := pg_temp.exercise_block(w, 1, 'Back Squat');
    perform pg_temp.add_set(b, 0, 5, 65, null, thu + interval '12 minutes', squat_max);
    perform pg_temp.add_set(b, 1, 5, 75, null, thu + interval '17 minutes', squat_max);
    perform pg_temp.add_set(b, 2, 5, 80, null, thu + interval '22 minutes', squat_max);
    b := pg_temp.exercise_block(w, 2, 'Romanian Deadlift');
    for i in 0..2 loop
      perform pg_temp.add_set(b, i, 8, null, 135 + 10 * ((wk - 1) / 2), thu + interval '32 minutes');
    end loop;
    b := pg_temp.exercise_block(w, 3, 'Pull-Up');
    for i in 0..2 loop
      perform pg_temp.add_set(b, i, 8, null, null, thu + interval '42 minutes', null, null, 8 - i + (wk / 4));
    end loop;
  end loop;

  -- This week: planned sessions (matches the brief's "Upper Body — Day 1" wireframe).
  insert into public.workouts (owner_id, title, subtitle, scheduled_for)
  values (uid, 'Upper Body — Day 1', 'Strength block · Week 9', current_date)
  returning id into w;
  perform pg_temp.text_block(w, 0, 'Warm-up', E'5 min cardio, shoulder mobility,\n2–3 progressive warm-up sets.');
  perform pg_temp.text_block(w, 1, 'Strength', '');
  b := pg_temp.exercise_block(w, 2, 'Bench Press');
  perform pg_temp.add_set(b, 0, 8, 60, null);
  perform pg_temp.add_set(b, 1, 5, 75, null);
  perform pg_temp.add_set(b, 2, 3, 85, null);
  b := pg_temp.exercise_block(w, 3, 'Dumbbell Row');
  for i in 0..2 loop perform pg_temp.add_set(b, i, 10, null, null); end loop;
  b := pg_temp.exercise_block(w, 4, 'Overhead Press');
  for i in 0..2 loop perform pg_temp.add_set(b, i, 5, null, null); end loop;
  perform pg_temp.text_block(w, 5, 'Coaching notes', 'Controlled lowering; stop 1–2 reps shy.');

  insert into public.workouts (owner_id, title, subtitle, scheduled_for)
  values (uid, 'Lower Body — Day 2', 'Strength block · Week 9', current_date + 3)
  returning id into w;
  perform pg_temp.text_block(w, 0, 'Warm-up', 'Bike 5 min, hip openers, empty-bar squats.');
  b := pg_temp.exercise_block(w, 1, 'Back Squat');
  perform pg_temp.add_set(b, 0, 5, 70, null);
  perform pg_temp.add_set(b, 1, 5, 77.5, null);
  perform pg_temp.add_set(b, 2, 5, 82.5, null);
  b := pg_temp.exercise_block(w, 2, 'Romanian Deadlift');
  for i in 0..2 loop perform pg_temp.add_set(b, i, 8, null, 165); end loop;
end $$;

-- ---------- Coaching demo (Phase 2) ----------
-- coach@local.test / password123 coaches Demo plus the brief's three example clients
-- (alex@, jordan@, taylor@local.test, same password). Invite code JOINDEMO is left open for testing /join.

create function pg_temp.add_user(p_id uuid, p_email text, p_name text) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name), now() - interval '3 weeks', now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
end $$;

do $$
declare
  coach constant uuid := '22222222-2222-4222-8222-222222222222';
  demo constant uuid := '11111111-1111-4111-8111-111111111111';
  clients constant uuid[] := array[
    '33333333-3333-4333-8333-333333333331'::uuid,
    '33333333-3333-4333-8333-333333333332'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid];
  names constant text[] := array['Alex Morgan', 'Jordan Lee', 'Taylor Smith'];
  emails constant text[] := array['alex@local.test', 'jordan@local.test', 'taylor@local.test'];
  bench constant numeric[] := array[185, 225, 275];
  t uuid;
  w uuid;
  b uuid;
  day timestamptz;
begin
  perform pg_temp.add_user(coach, 'coach@local.test', 'Coach Casey');
  update public.profiles set is_coach = true where id = coach;
  insert into public.coach_clients (coach_id, client_id, created_at) values (coach, demo, now() - interval '3 weeks');

  for i in 1..3 loop
    perform pg_temp.add_user(clients[i], emails[i], names[i]);
    insert into public.coach_clients (coach_id, client_id, created_at) values (coach, clients[i], now() - interval '3 weeks');
    insert into public.training_maxes (owner_id, exercise_id, value_kg, recorded_on)
    values (clients[i], pg_temp.ex('Bench Press'), pg_temp.lb(bench[i]), current_date - 20);

    -- Two logged sessions each in the last two weeks.
    for k in 1..2 loop
      day := date_trunc('day', now()) - (k * 5 + i) * interval '1 day' + interval '18 hours';
      insert into public.workouts (owner_id, title, subtitle, status, scheduled_for, started_at, completed_at, assigned_by, assigned_at)
      values (clients[i], 'Upper Body A', 'Strength block', 'completed', day::date, day, day + interval '50 minutes', coach, day - interval '2 days')
      returning id into w;
      b := pg_temp.exercise_block(w, 0, 'Bench Press');
      perform pg_temp.add_set(b, 0, 8, 60, null, day + interval '10 minutes', bench[i]);
      perform pg_temp.add_set(b, 1, 5, 75, null, day + interval '15 minutes', bench[i]);
      perform pg_temp.add_set(b, 2, 3, 85, null, day + interval '20 minutes', bench[i]);
      b := pg_temp.exercise_block(w, 1, 'Dumbbell Row');
      for s in 0..2 loop
        perform pg_temp.add_set(b, s, 10, null, null, day + interval '30 minutes', null, 50 + 10 * i);
      end loop;
    end loop;
  end loop;

  -- Templates (the brief's "Upper Body A" example).
  insert into public.workouts (owner_id, kind, title, subtitle)
  values (coach, 'template', 'Upper Body A', 'Strength block')
  returning id into t;
  perform pg_temp.text_block(t, 0, 'Warm-up', E'5 min cardio, shoulder mobility,\n2–3 progressive warm-up sets.');
  b := pg_temp.exercise_block(t, 1, 'Bench Press');
  perform pg_temp.add_set(b, 0, 8, 60, null);
  perform pg_temp.add_set(b, 1, 5, 75, null);
  perform pg_temp.add_set(b, 2, 3, 85, null);
  b := pg_temp.exercise_block(t, 2, 'Dumbbell Row');
  for s in 0..2 loop perform pg_temp.add_set(b, s, 10, null, null); end loop;
  perform pg_temp.text_block(t, 3, 'Coaching notes', 'Controlled lowering; stop 1–2 reps shy.');

  insert into public.workouts (owner_id, kind, title, subtitle)
  values (coach, 'template', 'Lower Body A', 'Strength block')
  returning id into t;
  perform pg_temp.text_block(t, 0, 'Warm-up', 'Bike 5 min, hip openers, empty-bar squats.');
  b := pg_temp.exercise_block(t, 1, 'Back Squat');
  perform pg_temp.add_set(b, 0, 5, 70, null);
  perform pg_temp.add_set(b, 1, 5, 75, null);
  perform pg_temp.add_set(b, 2, 5, 80, null);
  b := pg_temp.exercise_block(t, 2, 'Romanian Deadlift');
  for s in 0..2 loop perform pg_temp.add_set(b, s, 8, null, null); end loop;

  insert into public.coach_invites (code, coach_id, label) values ('JOINDEMO', coach, 'Demo invite');
end $$;

-- ---------- Planning demo: saved workouts and programs ----------
-- Demo keeps Upper and Lower Body as saved workouts, and has a 4-week "Volume block" starting next Monday.
-- Coach Casey has an "8-week block" program, started for Alex from next Monday. Runs are made by
-- start_program itself, signed in as their owner, so they're exactly what the app would make.

-- An upper-body page: bench by percentage up to p_top%, then rows.
create function pg_temp.upper_plan(p_workout uuid, p_top numeric) returns void language plpgsql as $$
declare
  b uuid;
begin
  perform pg_temp.text_block(p_workout, 0, 'Warm-up', E'5 min cardio, shoulder mobility,\n2–3 progressive warm-up sets.');
  b := pg_temp.exercise_block(p_workout, 1, 'Bench Press');
  perform pg_temp.add_set(b, 0, 8, p_top - 25, null);
  perform pg_temp.add_set(b, 1, 5, p_top - 10, null);
  perform pg_temp.add_set(b, 2, 3, p_top, null);
  b := pg_temp.exercise_block(p_workout, 2, 'Dumbbell Row');
  for s in 0..2 loop perform pg_temp.add_set(b, s, 10, null, null); end loop;
end $$;

-- A lower-body page: squats by percentage up to p_top%, then Romanian deadlifts.
create function pg_temp.lower_plan(p_workout uuid, p_top numeric) returns void language plpgsql as $$
declare
  b uuid;
begin
  perform pg_temp.text_block(p_workout, 0, 'Warm-up', 'Bike 5 min, hip openers, empty-bar squats.');
  b := pg_temp.exercise_block(p_workout, 1, 'Back Squat');
  perform pg_temp.add_set(b, 0, 5, p_top - 15, null);
  perform pg_temp.add_set(b, 1, 5, p_top - 7.5, null);
  perform pg_temp.add_set(b, 2, 5, p_top, null);
  b := pg_temp.exercise_block(p_workout, 2, 'Romanian Deadlift');
  for s in 0..2 loop perform pg_temp.add_set(b, s, 8, null, null); end loop;
end $$;

-- A program of p_weeks weeks, Upper on Mondays and Lower on Thursdays, its top sets moving by p_steps
-- (percentage points per week, from the first week's top set).
create function pg_temp.upper_lower_program(p_owner uuid, p_title text, p_description text, p_steps numeric[]) returns uuid
language plpgsql as $$
declare
  p uuid;
  w uuid;
begin
  insert into public.programs (owner_id, title, description, week_count)
  values (p_owner, p_title, p_description, cardinality(p_steps))
  returning id into p;
  for wk in 1..cardinality(p_steps) loop
    insert into public.workouts (owner_id, kind, title, program_id, program_day)
    values (p_owner, 'template', 'Upper Body', p, (wk - 1) * 7) returning id into w;
    perform pg_temp.upper_plan(w, 80 + p_steps[wk]);
    insert into public.workouts (owner_id, kind, title, program_id, program_day)
    values (p_owner, 'template', 'Lower Body', p, (wk - 1) * 7 + 3) returning id into w;
    perform pg_temp.lower_plan(w, 80 + p_steps[wk]);
  end loop;
  return p;
end $$;

create function pg_temp.sign_in(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;

do $$
declare
  demo constant uuid := '11111111-1111-4111-8111-111111111111';
  coach constant uuid := '22222222-2222-4222-8222-222222222222';
  alex constant uuid := '33333333-3333-4333-8333-333333333331';
  next_monday constant date := date_trunc('week', current_date)::date + 7;
  w uuid;
  p uuid;
begin
  -- Demo's library.
  insert into public.workouts (owner_id, kind, title) values (demo, 'template', 'Upper Body A') returning id into w;
  perform pg_temp.upper_plan(w, 85);
  insert into public.workouts (owner_id, kind, title) values (demo, 'template', 'Lower Body A') returning id into w;
  perform pg_temp.lower_plan(w, 80);

  -- Demo's next block, on the calendar from next Monday.
  p := pg_temp.upper_lower_program(demo, 'Volume block', 'Four weeks building to a heavy week.', array[0, 2.5, 5, 7.5]);
  perform pg_temp.sign_in(demo);
  perform public.start_program(p, next_monday);

  -- Coach Casey's eight weeks: three building, a deload, then again from a little higher.
  p := pg_temp.upper_lower_program(coach, '8-week block', 'Two waves of three building weeks, each followed by a deload.',
    array[0, 2.5, 5, -10, 2.5, 5, 7.5, -10]);
  perform pg_temp.sign_in(coach);
  perform public.start_program(p, next_monday, array[alex]);
end $$;
