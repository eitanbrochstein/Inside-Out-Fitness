-- Push notifications. Everything that should reach a phone goes through one outbox, `notifications`:
-- triggers queue coaching events as they happen, a job queues workout reminders and nudges once a
-- minute, and the push-dispatch edge function sends what's queued to every device the person has
-- (APNs, FCM, web push). None of it needs the app to be open. Purely additive: app versions that
-- predate this never touch these tables.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------- devices and preferences ----------

-- One row per phone or browser. The app registers it through register_push_device and removes it on
-- sign-out; the dispatcher removes tokens the push services say are dead.
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null unique, -- an APNs or FCM token, or a web subscription's endpoint
  subscription jsonb, -- web only: { endpoint, keys: { p256dh, auth } }
  apns_sandbox boolean not null default false, -- set by the dispatcher for builds run from Xcode
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_devices_user on public.push_devices (user_id);

-- Kept off profiles on purpose: coaches and clients can read each other's profile rows.
create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  timezone text not null default 'UTC', -- IANA name from the device, refreshed on every launch
  reminders boolean not null default true,
  reminder_lead_min int not null default 30 check (reminder_lead_min in (0, 10, 15, 30, 60, 120)),
  day_reminder_time time default '08:00', -- for workouts without a time; null = no reminder
  nudge_after_days int default 5 check (nudge_after_days in (3, 5, 7, 14)), -- null = no nudges
  coach_updates boolean not null default true, -- a coach assigned a workout or program
  comments boolean not null default true,
  client_activity boolean not null default true, -- coaches: a client finished a workout or joined
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- A time zone Postgres doesn't know would break every reminder query, so it falls back to UTC.
create function public.check_notification_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    new.timezone := 'UTC';
  end if;
  return new;
end $$;

create trigger notification_prefs_timezone before insert or update of timezone on public.notification_prefs
  for each row execute function public.check_notification_timezone();

-- The outbox. dedupe_key makes queueing idempotent (a reminder is queued once however often the job
-- runs); workout_id takes a notification away with its workout if that's deleted before it goes out.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category text not null check (category in ('reminder', 'nudge', 'coach_updates', 'comments', 'client_activity')),
  title text not null,
  body text not null default '',
  url text not null default '/', -- where tapping it goes in the app
  collapse_key text, -- a newer notification with the same key replaces the older one on the device
  dedupe_key text unique,
  workout_id uuid references public.workouts on delete cascade,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  attempts int not null default 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index notifications_pending on public.notifications (send_after) where sent_at is null;
create index notifications_user on public.notifications (user_id, category, created_at desc);

alter table public.push_devices enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notifications enable row level security;

create policy "push_devices: owner reads" on public.push_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_devices: owner removes" on public.push_devices
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "notification_prefs: owner all" on public.notification_prefs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner reads" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_devices, public.notification_prefs, public.notifications from anon;
grant select, delete on public.push_devices to authenticated;
grant select, insert, update on public.notification_prefs to authenticated;
grant select on public.notifications to authenticated;

-- Registers this device for the signed-in person, taking the token over if another account on the same
-- device had it, and records their time zone for reminders.
create function public.register_push_device(
  p_platform text,
  p_token text,
  p_subscription jsonb default null,
  p_timezone text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  if p_platform not in ('ios', 'android', 'web') or coalesce(btrim(p_token), '') = '' then
    raise exception 'bad_device';
  end if;

  insert into public.push_devices as d (user_id, platform, token, subscription)
  values (me, p_platform, p_token, p_subscription)
  on conflict (token) do update set
    user_id = me,
    platform = excluded.platform,
    subscription = excluded.subscription,
    apns_sandbox = d.apns_sandbox and d.user_id = me,
    last_seen_at = now();

  insert into public.notification_prefs as p (user_id, timezone) values (me, coalesce(p_timezone, 'UTC'))
  on conflict (user_id) do update set timezone = coalesce(p_timezone, p.timezone);
end $$;

-- ---------- queueing ----------

create function public.workout_title(p_title text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(p_title), ''), 'Untitled workout')
$$;

create function public.person_name(p_user uuid, p_fallback text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(btrim(display_name), '') from public.profiles where id = p_user), p_fallback)
$$;

-- "Thu, Nov 20" and "6:30 PM". Notifications are written on the server, so in English.
create function public.short_day(p_day date) returns text
language sql immutable set search_path = '' as $$ select to_char(p_day, 'Dy, Mon FMDD') $$;
create function public.short_time(p_time time) returns text
language sql immutable set search_path = '' as $$ select to_char(p_time, 'FMHH12:MI AM') $$;

-- Whether someone wants a category. No preferences row yet means the defaults: everything on.
create function public.wants_notification(p_user uuid, p_category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case p_category
      when 'reminder' then p.reminders
      when 'nudge' then p.nudge_after_days is not null
      when 'coach_updates' then p.coach_updates
      when 'comments' then p.comments
      when 'client_activity' then p.client_activity
      else true
    end
    from public.notification_prefs p where p.user_id = p_user
  ), true)
$$;

-- Queues a notification, unless the person turned that kind off or has no device to send it to.
create function public.enqueue_notification(
  p_user uuid,
  p_category text,
  p_title text,
  p_body text,
  p_url text,
  p_collapse_key text default null,
  p_dedupe_key text default null,
  p_send_after timestamptz default now(),
  p_workout uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null
     or not exists (select 1 from public.push_devices d where d.user_id = p_user)
     or not public.wants_notification(p_user, p_category) then
    return;
  end if;
  insert into public.notifications (user_id, category, title, body, url, collapse_key, dedupe_key, send_after, workout_id)
  values (p_user, p_category, left(p_title, 120), left(coalesce(p_body, ''), 240), coalesce(p_url, '/'), p_collapse_key,
    p_dedupe_key, coalesce(p_send_after, now()), p_workout)
  on conflict (dedupe_key) do nothing;
end $$;

create function public.coaches_actively(p_coach uuid, p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_clients where coach_id = p_coach and client_id = p_client and status = 'active')
$$;

-- ---------- coaching events ----------

-- A coach put a workout on a client's calendar: assign_template (copies, then stamps assigned_by) or
-- assign_blank_workout (inserts it stamped). A blank one is filled in from the editor right after, or
-- thrown away if left empty, so it waits a few minutes and goes with the workout if that's deleted.
-- Program workouts are left to the program's own notification.
create function public.notify_workout_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  blank boolean := tg_op = 'INSERT';
  v_when text := concat_ws(' · ', public.short_day(new.scheduled_for), public.short_time(new.scheduled_time));
begin
  perform public.enqueue_notification(
    new.owner_id,
    'coach_updates',
    'New workout from ' || public.person_name(new.assigned_by, 'your coach'),
    case when blank then coalesce(nullif(v_when, '') || ' · ', '') || 'Tap to see it.'
      else concat_ws(' · ', public.workout_title(new.title), nullif(v_when, '')) end,
    '/w/' || new.id,
    'assign:' || new.assigned_by,
    'assigned:' || new.id,
    now() + case when blank then interval '5 minutes' else interval '0' end,
    new.id
  );
  return null;
end $$;

create trigger workouts_notify_assigned_insert after insert on public.workouts
  for each row when (new.kind = 'workout' and new.assigned_by is not null and new.assigned_by <> new.owner_id and new.program_run_id is null)
  execute function public.notify_workout_assigned();
create trigger workouts_notify_assigned_update after update of assigned_by on public.workouts
  for each row when (old.assigned_by is null and new.kind = 'workout' and new.assigned_by is not null
    and new.assigned_by <> new.owner_id and new.program_run_id is null)
  execute function public.notify_workout_assigned();

-- One notification for a whole program, not one per workout.
create function public.notify_program_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_notification(
    new.owner_id,
    'coach_updates',
    public.person_name(new.assigned_by, 'Your coach') || ' started a program for you',
    new.title || ' · starts ' || public.short_day(new.start_date),
    '/workouts?week=' || new.start_date,
    'assign:' || new.assigned_by,
    'run:' || new.id
  );
  return null;
end $$;

create trigger program_runs_notify_assigned after insert on public.program_runs
  for each row when (new.assigned_by is not null and new.assigned_by <> new.owner_id)
  execute function public.notify_program_assigned();

-- A comment goes to the other side: the client when a coach writes, or the coaches in the thread (the
-- one who assigned it, and any who've commented) when the client does, while they still coach them.
create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w public.workouts;
  v_title text;
  v_coach uuid;
begin
  select * into w from public.workouts where id = new.workout_id;
  if not found then
    return null;
  end if;
  v_title := public.person_name(new.author_id, 'Someone') || ' commented on ' || public.workout_title(w.title);

  if new.author_id <> w.owner_id then
    perform public.enqueue_notification(w.owner_id, 'comments', v_title, new.body, '/w/' || w.id,
      'comments:' || w.id, 'comment:' || new.id || ':' || w.owner_id, now(), w.id);
  else
    for v_coach in
      select distinct c.id from (
        select w.assigned_by as id
        union
        select author_id from public.workout_comments where workout_id = w.id
      ) c
      where c.id is not null and c.id <> w.owner_id and public.coaches_actively(c.id, w.owner_id)
    loop
      perform public.enqueue_notification(v_coach, 'comments', v_title, new.body, '/w/' || w.id,
        'comments:' || w.id, 'comment:' || new.id || ':' || v_coach, now(), w.id);
    end loop;
  end if;
  return null;
end $$;

create trigger workout_comments_notify after insert on public.workout_comments
  for each row execute function public.notify_comment();

-- A client finished a workout their coach assigned.
create function public.notify_workout_finished() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.coaches_actively(new.assigned_by, new.owner_id) then
    perform public.enqueue_notification(
      new.assigned_by,
      'client_activity',
      public.person_name(new.owner_id, 'Your client') || ' finished ' || public.workout_title(new.title),
      'Tap to see how it went.',
      '/w/' || new.id,
      null,
      'finished:' || new.id,
      now(),
      new.id
    );
  end if;
  return null;
end $$;

create trigger workouts_notify_finished after update of status on public.workouts
  for each row when (old.status <> 'completed' and new.status = 'completed' and new.kind = 'workout'
    and new.assigned_by is not null and new.assigned_by <> new.owner_id)
  execute function public.notify_workout_finished();

-- Someone accepted a coach's invite.
create function public.notify_invite_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := public.person_name(new.accepted_by, null);
begin
  perform public.enqueue_notification(
    new.coach_id,
    'client_activity',
    coalesce(v_name || ' joined as your client', 'A new client joined'),
    coalesce('From your invite "' || nullif(btrim(new.label), '') || '".', 'They accepted your invite.'),
    '/coach/clients/' || new.accepted_by,
    null,
    'joined:' || new.code
  );
  return null;
end $$;

create trigger coach_invites_notify_accepted after update of accepted_by on public.coach_invites
  for each row when (old.accepted_by is null and new.accepted_by is not null)
  execute function public.notify_invite_accepted();

-- ---------- reminders and nudges (run every minute) ----------

-- Queues what falls due by p_now (a parameter so tests can move the clock). Each kind has a 15-minute
-- window, so a late or skipped run still sends, and a dedupe key, so overlapping runs don't send twice.
--  * A timed workout: `lead` minutes before its start, in the trainee's time zone. The key includes the
--    date and time, so a rescheduled workout is reminded again but a changed lead isn't.
--  * Untimed workouts: one notification on the day, at the trainee's chosen time.
--  * A nudge: at 10:00 local when nothing is planned from today, nothing was done or planned in the last
--    N days, and no nudge went in that time. Not in someone's first N days of notifications.
create function public.queue_due_reminders(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_lead text;
begin
  for r in
    select w.id, w.owner_id, w.title, w.scheduled_for, w.scheduled_time, p.reminder_lead_min as lead
    from public.workouts w
    join public.notification_prefs p on p.user_id = w.owner_id
    where w.kind = 'workout' and w.status = 'planned' and w.scheduled_time is not null and p.reminders
      -- Any time zone's today is within a day of UTC's, so this narrows the scan before the exact test.
      and w.scheduled_for between (p_now at time zone 'UTC')::date - 1 and (p_now at time zone 'UTC')::date + 2
      and ((w.scheduled_for + w.scheduled_time) at time zone p.timezone) - make_interval(mins => p.reminder_lead_min)
        between p_now - interval '15 minutes' and p_now
      and exists (select 1 from public.push_devices d where d.user_id = w.owner_id)
  loop
    v_lead := case
      when r.lead = 0 then 'Starting now.'
      when r.lead < 60 then 'Starts in ' || r.lead || ' minutes.'
      when r.lead = 60 then 'Starts in an hour.'
      else 'Starts in ' || r.lead / 60 || ' hours.'
    end;
    perform public.enqueue_notification(r.owner_id, 'reminder',
      public.workout_title(r.title) || ' at ' || public.short_time(r.scheduled_time), v_lead,
      '/w/' || r.id, 'workout:' || r.id, 'rem:' || r.id || ':' || r.scheduled_for || ':' || r.scheduled_time, p_now, r.id);
  end loop;

  for r in
    select p.user_id, l.today, count(*) as n,
      (array_agg(w.id order by w.created_at, w.id))[1] as first_id,
      array_agg(public.workout_title(w.title) order by w.created_at, w.id) as titles
    from public.notification_prefs p
    cross join lateral (select (p_now at time zone p.timezone)::date as today, (p_now at time zone p.timezone)::time as now_local) l
    join public.workouts w on w.owner_id = p.user_id and w.kind = 'workout' and w.status = 'planned'
      and w.scheduled_time is null and w.scheduled_for = l.today
    where p.reminders and p.day_reminder_time is not null
      and l.now_local - p.day_reminder_time >= interval '0' and l.now_local - p.day_reminder_time < interval '15 minutes'
      and exists (select 1 from public.push_devices d where d.user_id = p.user_id)
    group by p.user_id, l.today
  loop
    perform public.enqueue_notification(r.user_id, 'reminder',
      case when r.n = 1 then 'Workout today: ' || r.titles[1] else r.n || ' workouts today' end,
      case when r.n = 1 then 'Tap to open it.' else array_to_string(r.titles, ', ') end,
      case when r.n = 1 then '/w/' || r.first_id else '/workouts' end,
      'day:' || r.user_id, 'day:' || r.user_id || ':' || r.today, p_now,
      case when r.n = 1 then r.first_id end);
  end loop;

  for r in
    select p.user_id, p.nudge_after_days as days, l.today,
      (select max(w.completed_at) from public.workouts w where w.owner_id = p.user_id and w.kind = 'workout') as last_done,
      p.timezone
    from public.notification_prefs p
    cross join lateral (select (p_now at time zone p.timezone)::date as today, (p_now at time zone p.timezone)::time as now_local) l
    where p.nudge_after_days is not null
      and l.now_local - time '10:00' >= interval '0' and l.now_local - time '10:00' < interval '15 minutes'
      and p.created_at <= p_now - make_interval(days => p.nudge_after_days)
      and exists (select 1 from public.push_devices d where d.user_id = p.user_id)
      and not exists (
        select 1 from public.workouts w
        where w.owner_id = p.user_id and w.kind = 'workout' and (
          (w.status = 'planned' and w.scheduled_for >= l.today)
          or w.status = 'in_progress'
          or w.completed_at > p_now - make_interval(days => p.nudge_after_days)
          or w.created_at > p_now - make_interval(days => p.nudge_after_days)
        )
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.user_id and n.category = 'nudge' and n.created_at > p_now - make_interval(days => p.nudge_after_days)
      )
  loop
    perform public.enqueue_notification(r.user_id, 'nudge', 'Time to plan your next workout?',
      case when r.last_done is null then 'Nothing''s on your plan yet. Add a workout to get going.'
        else 'It''s been ' || (r.today - (r.last_done at time zone r.timezone)::date) || ' days since your last session.' end,
      '/workouts', 'nudge:' || r.user_id, 'nudge:' || r.user_id || ':' || r.today, p_now);
  end loop;
end $$;

-- ---------- dispatch ----------

-- Every minute: queue what's due, tidy up, and wake the dispatcher if anything is waiting. The
-- dispatcher's address and secret live in Vault (see README → Notifications); without them nothing is
-- sent and notifications wait, so this is safe to deploy before push is set up.
create function public.run_push_jobs() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  perform public.queue_due_reminders(now());
  delete from public.notifications where created_at < now() - interval '30 days';

  if not exists (
    select 1 from public.notifications
    where sent_at is null and send_after <= now() and (claimed_at is null or claimed_at < now() - interval '5 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  );
end $$;

-- The dispatcher takes a batch: due rows not already being sent (a claim older than five minutes is
-- presumed dead), each with the person's devices.
create function public.claim_push_batch(p_limit int default 100)
returns table (id uuid, user_id uuid, title text, body text, url text, collapse_key text, devices jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select n.id from public.notifications n
    where n.sent_at is null and n.send_after <= now() and (n.claimed_at is null or n.claimed_at < now() - interval '5 minutes')
    order by n.send_after
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.notifications n set claimed_at = now() from picked where n.id = picked.id
    returning n.id, n.user_id, n.title, n.body, n.url, n.collapse_key
  )
  select c.id, c.user_id, c.title, c.body, c.url, c.collapse_key,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'platform', d.platform, 'token', d.token,
        'subscription', d.subscription, 'apns_sandbox', d.apns_sandbox))
      from public.push_devices d where d.user_id = c.user_id
    ), '[]'::jsonb)
  from claimed c;
end $$;

-- What happened to a batch: [{ id, error?, retry?, dead?: [device ids], sandbox?: [device ids] }].
-- Dead tokens are removed and Xcode builds remembered. A temporary failure is tried twice more, a few
-- minutes apart; anything else is done.
create function public.complete_push(p_results jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_devices
  where id in (select jsonb_array_elements_text(coalesce(r -> 'dead', '[]'))::uuid from jsonb_array_elements(p_results) r);
  update public.push_devices set apns_sandbox = true
  where id in (select jsonb_array_elements_text(coalesce(r -> 'sandbox', '[]'))::uuid from jsonb_array_elements(p_results) r);

  update public.notifications n set
    attempts = n.attempts + 1,
    error = r.error,
    sent_at = case when coalesce(r.retry, false) and n.attempts < 2 then null else now() end,
    claimed_at = case when coalesce(r.retry, false) and n.attempts < 2 then null else n.claimed_at end,
    send_after = case when coalesce(r.retry, false) and n.attempts < 2 then now() + (n.attempts + 1) * interval '2 minutes' else n.send_after end
  from jsonb_to_recordset(p_results) as r(id uuid, error text, retry boolean)
  where n.id = r.id;
end $$;

-- Only the app's registration is callable by people; the rest is internal, or the dispatcher's.
revoke execute on function public.register_push_device, public.workout_title, public.person_name, public.short_day,
  public.short_time, public.wants_notification, public.enqueue_notification, public.coaches_actively,
  public.queue_due_reminders, public.run_push_jobs, public.claim_push_batch, public.complete_push
  from public, anon, authenticated;
grant execute on function public.register_push_device to authenticated;
grant execute on function public.claim_push_batch, public.complete_push to service_role;

select cron.schedule('push-jobs', '* * * * *', 'select public.run_push_jobs()');
