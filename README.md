# Inside Out Training

A minimal, mobile-first strength-training journal: workouts are pages of collapsible text and exercise blocks, sets can be planned as a percentage of a stored 1RM, and Train mode logs what was actually lifted without overwriting the plan. Weeks are planned on a calendar, from saved workouts or multi-week programs. Built from `Training_App_Developer_Plan_With_Visuals.docx`.

**Status:** Phase 1 (personal journal), Phase 2 (coaching: invites, templates, assignment, client review, comments), planning (a plan calendar, saved workouts, multi-week programs, coaches planning their clients' weeks), coach notes, a 1RM calculator and push notifications are built. Custom email (SMTP) and password reset are next.

## Stack

Vite + React + TypeScript · React Router · TanStack Query · Tailwind CSS v4 · Motion · vaul (bottom sheets) · sonner (toasts) · Recharts · Supabase (Postgres, Auth, row-level security) · installable PWA.

## Run it locally

Requires Node, pnpm and Docker (for the local Supabase stack).

```sh
pnpm install
pnpm db:start                # local Supabase in Docker; prints the API URL and publishable key
cp .env.example .env.local   # paste the URL + publishable key from the previous step
pnpm db:reset                # applies migrations and loads the demo data
pnpm dev                     # http://localhost:5173
```

Already set up? `pnpm db:reset` replaces everything in the local database, your own account included. To pick up new migrations and keep your data, run `pnpm exec supabase migration up --local` and then `pnpm db:types`. The demo data only loads on a reset.

Demo accounts (all use password **password123**):

| Account | What it shows |
| --- | --- |
| `demo@local.test` | A client with 8 weeks of history, this week's planned workouts, two saved workouts, and a 4-week program starting next Monday |
| `coach@local.test` | Coach Casey: four clients, two templates, an 8-week program started for Alex from next Monday, and an open invite code `JOINDEMO` |
| `alex@`, `jordan@`, `taylor@local.test` | The brief's example clients (bench 1RM 185 / 225 / 275 lb) |

Supabase Studio is at http://127.0.0.1:54323.

> Use the project's own CLI (`pnpm exec supabase …` or the `db:*` scripts). The Homebrew build on this machine currently fails its code-signature check and is killed on launch.

To try it on a phone on the same Wi-Fi, run `pnpm dev --host` and set `VITE_SUPABASE_URL` to `http://<your-mac-ip>:54321`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Typecheck + production build (with service worker) |
| `pnpm test` | Unit tests: load math, summaries, progress, insights and calendar helpers, theme tokens and contrast |
| `pnpm typecheck` / `pnpm lint` | TypeScript / oxlint |
| `pnpm db:reset` | Rebuild the local database from migrations + `supabase/seed.sql` |
| `pnpm db:test` | pgTAP tests: owner-only data, coach access and planning, notes and times, assignment, programs and saving them, notifications, training totals and records, account deletion (`supabase/tests`) |
| `pnpm db:types` | Regenerate `src/lib/database.types.ts` after a migration |
| `pnpm icons` | Regenerate PWA icons from `public/favicon.svg` |
| `pnpm native:sync` | Production build, copied into the iOS and Android projects |
| `pnpm native:ios` / `pnpm native:android` | `native:sync`, then open the project in Xcode / Android Studio |
| `pnpm native:icons` | Regenerate the native app icons and splash screens from `assets/` |

## How it works

- **Weights are stored in kg** and converted to the user's unit (lb/kg) only for display, so switching units never loses precision.
- **Load math** lives in one pure module, `src/lib/load.ts`. Percentage load = max × %, rounded half-up to the user's plate increment, e.g. 225 lb × 75% → 170 lb. Typed loads are never rounded.
- **Planned vs actual:** each set has plan columns (`target_*`), frozen columns (`basis_max_kg`, `prescribed_load_kg`) and actual columns (`actual_*`). Completing a percentage set freezes the max it was based on. Updating a max later changes planned workouts but never completed ones.
- **Timed sets:** an exercise counts reps or time, chosen from its Reps column header (or its ⋯ → Reps or time). The choice lives in `workout_blocks.settings.measure` (`sec` or `min`). Time is stored in seconds (`target_seconds`, `actual_seconds`) and shown in seconds or minutes, the same way weights are stored in kg. Timed sets don't add reps or set records. Last and best show the times.
- **Supersets:** consecutive exercise blocks that share `settings.group` show as one card (A1, A2…), open together in Train mode, and move as one when reordering. Pair them from an exercise's ⋯. Every copy (save, repeat, assign, programs) copies `settings`, so supersets and timed exercises come along.
- **Notes:** each exercise has a note (`workout_blocks.notes`) and each workout has one (`workouts.notes`): form cues, tempo, the session's focus. They show above the sets and at the top of the page, and a collapsed exercise with a note shows a note icon. On a workout a coach assigned, the notes are the coach's: the client reads them as "Note from Coach" and replies in the comments (`protect_coach_*_notes` refuses a client's edit). Every copy carries them.
- **1RM calculator:** Exercises → the calculator icon, or an exercise's "Estimate from a set", estimates a 1RM from weight × reps with ten formulas (`src/lib/oneRepMax.ts`), shows their average or the one you pick, and a percentage table rounded to your plates. "Save as max" records it with a note saying where it came from. Records and charts still use Epley (`estimate1RM`, mirrored in SQL as `epley_kg`).
- **Session RPE:** the finish screen asks how hard the workout was, 1–10 (`workouts.rpe`). You can change it from the finished workout's summary, and History shows it. It's part of the trainee's log, so a coach can see it but not set it.
- **Saving:** every edit updates the screen immediately and saves in the background, in order, per workout. Text autosaves 500 ms after you stop typing. Deleting a block or set shows an Undo toast.
- **Security:** row-level security restricts every table to its owner. Child rows take their owner from their parent inside the database, so they can't be planted in someone else's workout.

## Design system

The look is "liquid glass" over a dark Midnight theme by default. Everything is driven by CSS custom properties in `src/styles/`, imported in order by `src/index.css`:

| File | What's in it |
| --- | --- |
| `tokens.css` | Type ramp (`text-display` … `text-micro`), radii, easing, animations, z-index, and the Tailwind names for the theme colours |
| `themes.css` | The five themes and six accents, then everything derived from them once (soft tints, the ambient background, the glass light, the heatmap ramp), then the solid fallbacks |
| `materials.css` | The glass classes: `glass-surface` and `glass-panel` (blurred: tab bar, bottom bars, sheets), `glass-card`, `glass-control`, `glass-tint` (the accent gradient on primary buttons and selections), `glass-field`, `glass-lens`, `glass-text` |
| `base.css`, `motion.css`, `vendor.css` | Body and ambient background, page transitions, and the sonner toast overrides (unlayered on purpose) |

`<html>` carries `data-theme` (dark/light), `data-scheme` (the theme), `data-accent` and `data-glass`. `src/lib/theme.ts` sets them from the profile, and an inline script in `index.html` does it before first paint. Only fixed chrome blurs; cards and controls are lit the same way without a blur. Glass off, `prefers-reduced-transparency` and `prefers-contrast: more` swap the glass tokens for solid surfaces.

**Adding a theme:** add a `[data-scheme='id']` block to `themes.css` with every token the others declare, add it to `THEMES` in `src/lib/theme.ts` and to the map in `index.html`. **Adding an accent:** add a dark-page and a light-page block, and the id to `ACCENTS` and `index.html`. `pnpm test` then checks every theme declares the full token set, that the three lists agree, and that text and buttons pass WCAG contrast on every theme × accent.

Components use the semantic names only (`bg-surface`, `text-muted`, `text-accent-text`), never raw colours. `cn()` (`src/ui/cn.ts`) merges classes with tailwind-merge, so a `className` passed to a component replaces its own; new token families go in its config too.

## Project layout

```
supabase/migrations   schema, functions (reorder, duplicate, copy, finish, stats, training summary, records), exercise library, programs, coach planning
supabase/seed.sql     local demo users, history, saved workouts and programs (never pushed)
supabase/tests        pgTAP tests (owner-only, coaching, coach planning, notes and times, programs, program saving, notifications, insights, appearance, account deletion)
supabase/functions    push-dispatch: the edge function that sends queued notifications (APNs, FCM, web push)
src/lib               load math, summaries, progress and calendar helpers, Supabase client, native.ts (everything that differs in the apps)
src/data              TanStack Query hooks (one per resource; useWorkout holds all block/set mutations)
src/styles            design tokens, themes, glass materials (see "Design system")
src/ui                design-system primitives; src/ui/charts holds the rings, heatmap and chart kit
src/features          pages: home, workouts, workout (editor, train mode, templates, coach view), plan (calendar, add sheets), library (saved workouts, programs), exercises, progress, settings, coaching, legal (privacy policy)
sw/sw.ts              service worker (app shell only, data is never cached) and web push
ios, android          native app projects (Capacitor); assets holds the sources for their icons and splash screens
```

## Deploying

1. Create a Supabase project, then `pnpm exec supabase link --project-ref <ref>` and `pnpm exec supabase db push`.
2. In the Supabase dashboard, set **Auth → URL configuration → Site URL** to your app's URL. Hosted Supabase sends confirmation emails by default, and its built-in mailer only delivers to project members. Either turn off "Confirm email" while it's just you, or add custom SMTP before inviting anyone.
3. Import the repo into Vercel and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (from the Supabase dashboard → Project settings → API keys). `vercel.json` already handles client-side routes.
4. On an iPhone, open the site in Safari → Share → **Add to Home Screen**. The installed app keeps its own sign-in.

Free Supabase projects pause after a week without use and have no automatic backups. Run `pnpm exec supabase db dump` now and then.

## Native apps

The iOS and Android apps are this same web app inside a native shell ([Capacitor](https://capacitorjs.com)). Web code changes go in `src/`, and `pnpm native:sync` copies them into `ios/` and `android/`.

**Setup:** in `.env.production.local`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_APP_URL` (the live website's address, which invite links point at). `native:sync` refuses to build unless both URLs are `https://`, so a store build can't ship with dead invite links or pointing at a local database.

**What differs in the apps** (all in `src/lib/native.ts`):

- The share sheet, clipboard, haptics, keep-awake and status bar use native plugins.
- The sign-in is kept in native storage, not localStorage, which a phone low on space can clear.
- There's no service worker or update prompt. Updates come through the stores, so people can be on an older version for a while: **database changes must keep working for the app versions still in use.**
- Push notifications come through APNs and FCM (`@capacitor/push-notifications`) instead of web push. They need the Push Notifications capability in Xcode and `google-services.json` for Android (see Notifications). Android shows them with `ic_stat_notify`, the dumbbell in white.
- Android's back button closes an open sheet, then goes back a page, then leaves the app.

**Invite links** open the website, where a client can accept and then use the app. In the app, Settings → Join a coach with a code does the same. Opening links straight in the app needs Universal Links and App Links, which aren't set up.

**Limits worth knowing:**

- The app id `com.insideouttraining.app` (`capacitor.config.json`) can't change once an app is published.
- The home screen shows the short name "Inside Out". The store listing's name is set in App Store Connect and Play Console.
- The minimum iOS version is 16.4, because Tailwind v4 needs Safari 16.4.
- Before Chromium 140, Android's web view can't draw behind the system bars, so older phones show dark bars above and below the page, even on a light theme.

**Before submitting:** fill in `CONTACT_EMAIL` in `src/features/legal/PrivacyPage.tsx` and review that policy. Google Play's deletion link is `<your site>/privacy#delete-account`.

## Account deletion

Settings → Delete account calls `delete_my_account` (`…_delete_account.sql`), which removes the login and everything that cascades from it. Clients keep the workouts a coach assigned. A client's workouts and maxes can point at the coach's custom exercises, so each client gets their own copy of those first, or keeps using one they already have by that name. `delete_account.test.sql` covers this.

## Planning

- **Plan:** Workouts → Plan is your week, a day at a time; tap the dates for the month. A workout sits on its planned date, or on the day it was finished. A missed one offers "Move to today", and on the current week older missed and undated ones are listed too. The week is in the URL, so Back returns to it.
- **Saved workouts:** any workout's ⋯ → Save workout keeps a copy in Workouts → Saved. The + on Home, or on a day of the plan, starts from one. A saved workout is a `kind = 'template'` workout, the same row a coach calls a template.
- **Programs:** a program is weeks of days, and each day holds template workouts (`workouts.program_id`, with `program_day` = week × 7 + weekday, Monday = 0). Each week is its own copy, so weeks can progress; "+ Week" copies the last one. Start program puts every day on the calendar from a Monday (`start_program`) and records it as a run (`program_runs`). Days already past are left out. Stopping a run takes off the workouts not yet started; deleting a program leaves what it already scheduled.
- **Saving programs:** Plan → ⋯ → Save weeks as program copies the workouts on a stretch of weeks into a new program, each on its weekday. Any workout's ⋯ → Add to program puts a copy on a day of a program, on a new week, or in a new program. A running program's ⋯ → Save to my library copies the run as a program of your own, including one a coach assigned. The app works out the days (`create_program_from_workouts`), except for runs, which are dates minus the run's Monday (`save_run_as_program`). When a workout a run put on your calendar is saved, the "Program · Week N" the run added to its subtitle comes off. Only plans are copied.
- **Times:** a planned workout can have a time of day (`scheduled_time`, wall-clock time where the trainee is), set beside its date, in Schedule, or when a coach assigns it. A day's workouts sort by time. Templates and program days have no dates, so no times; a dated copy keeps its source's time. Reminders turn date + time into an instant with the trainee's time zone (see Notifications).
- **Dates:** `scheduled_for` is a local calendar date, and the server never decides what "today" is (its clock is UTC). The app passes the dates, and `src/lib/calendar.ts` does day arithmetic on dates rather than milliseconds, so a daylight-saving change can't move a workout.

## Coaching

Turn on **Settings → Coaching tools**. Home then shows a Personal / Coaching switch. Personal mode doesn't change.

- **Invites:** Clients → invite icon creates a single-use link (and code) that expires in 14 days. The coach sends it however they like. A new person who opens it signs up and lands back on the invite. Either side can end the relationship later.
- **Templates:** a template is a workout page with no dates and no personal maxes, and percentage sets show "auto". A coach's templates are their saved workouts: one library, with programs alongside.
- **Assigning:** Assign → Workout copies a template into each selected client's own journal on a date (`assign_template`). The preview shows each client's load from their own max and rounding. Assign → Program starts a program for several clients from a Monday (`start_program`). Later edits to a template or program, or to another client's copy, never reach an assigned copy.
- **Planning a client's weeks:** the client page shows their calendar. Each day's + adds a template or a blank workout to it.
- **Reviewing:** a coach can read an active client's workouts, maxes and progress, and can record a client's max. Coach and client share a comment thread on each assigned workout.
- **Notes:** a coach writes a note for the whole workout and a cue on each exercise ("Cue for Alex: elbows tucked"). The client sees them labelled with the coach's name and can't change them; they answer in the comments.
- **Editing until started:** a workout the coach assigned stays theirs to change (title, date and time, notes, blocks and planned sets) until the client starts it by logging a set. After that it's read-only to the coach, and an edit in flight is refused with a message. A coach can take back an assignment the client hasn't started, and stop a program they assigned: its unstarted workouts come off the calendar.
- **Security:** coach access is extra policies keyed on active `coach_clients` rows (`…_coaching.sql`, `…_coach_planning.sql`). Guard triggers let anyone other than the owner change only the plan, never the log, the status or whose row it is. Security-definer functions run as their owner and are exempt, so assigning can still stamp rows. `coaching.test.sql` and `coach_planning.test.sql` check that strangers and former coaches see nothing, and that a coach's edits stop when the client starts.

## Notifications

Push notifications reach the iOS and Android apps and the website, even when the app is closed. People turn them on in **Settings → Notifications** (or from the "Get a reminder?" offer after giving a workout a time); nothing asks for permission on launch. What they get is set there too, the same on every device:

- **Workout reminders:** a set time before a workout planned at a time (default 30 minutes), and one reminder on the day for workouts without a time (default 8:00).
- **Nudge:** at 10:00 when nothing is planned and nothing was done or planned for a while (3, 5, 7 or 14 days; default 5).
- **From your coach:** a new workout (one per assignment) or program (one per program, not per workout).
- **Comments:** the other side replied on a workout.
- **Client activity** (coaches): a client finished a workout you assigned, or joined with your invite.

**How it works** (`…_notifications.sql`): every notification goes through one outbox table, `notifications`. Triggers queue the coaching ones as they happen. A `pg_cron` job runs `run_push_jobs` every minute: `queue_due_reminders` queues the reminders and nudges that have fallen due in each person's time zone, and if anything is waiting, `pg_net` calls the `push-dispatch` edge function. It claims a batch, sends each notification to every device the person has (`push_devices`), and reports back: delivered, retry later, or a dead token to remove. Dedupe keys mean a reminder is queued once however often the job runs, and a notification goes with its workout if that's deleted first. Devices register through `register_push_device`, which also records the time zone; signing out removes the device. Preferences live in `notification_prefs`, not on `profiles`, which coaches and clients can read.

### Setting it up

The migration is safe to deploy before any of this: until the dispatcher is configured, notifications just wait (and are tidied away after 30 days).

1. **Apple (iOS):** in the Apple Developer portal → Certificates, IDs & Profiles → **Keys**, create a key with **Apple Push Notifications service (APNs)**. Download the `.p8` file (only once) and note its Key ID and your Team ID. In Xcode, select the App target → Signing & Capabilities → **+ Capability → Push Notifications**.
2. **Android:** in the [Firebase console](https://console.firebase.google.com), create a project and add an Android app with the package name `com.insideouttraining.app`. Download `google-services.json` into `android/app/`. Then Project settings → Service accounts → **Generate new private key** (a JSON file; keep it secret).
3. **Web:** generate a key pair with `pnpm dlx web-push generate-vapid-keys`. Put the public key in Vercel as `VITE_VAPID_PUBLIC_KEY` (and redeploy). Without it the website doesn't offer notifications.
4. **Supabase:** set the function's secrets (see `supabase/functions/.env.example` for each one). `PUSH_DISPATCH_SECRET` is any long random string, e.g. `openssl rand -hex 24`.

   ```sh
   pnpm exec supabase secrets set --env-file supabase/functions/.env.production   # a filled-in copy of .env.example, kept apart from the local .env
   pnpm exec supabase functions deploy push-dispatch --no-verify-jwt
   pnpm exec supabase db push
   ```

   Then, in the dashboard's SQL editor, tell the database where the dispatcher is and the same secret:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
   select vault.create_secret('<the PUSH_DISPATCH_SECRET>', 'push_dispatch_secret');
   ```

5. **Apps:** ship new store builds (`pnpm native:sync`): native push needs the new plugin and the capability.

**Checking on it:** `select * from notifications order by created_at desc` shows what was queued and any `error`; `select * from cron.job_run_details order by start_time desc` shows the job; `net._http_response` shows the dispatcher's replies.

**Locally:** `db:start` leaves out the edge runtime, so serve the function on its own: `pnpm exec supabase functions serve push-dispatch --env-file supabase/functions/.env`, and store the local Vault values with the URL `http://host.docker.internal:54321/functions/v1/push-dispatch`. Web push needs the service worker, which only runs in a build: `pnpm build && pnpm preview` (that build reads `.env.production.local`; use `vite build --mode development` to keep the local database). An iPhone only gets web push from the site added to its Home Screen. A build run from Xcode uses Apple's development servers; the dispatcher notices and remembers that per device.

Not built yet: custom SMTP for emails, and password reset.
