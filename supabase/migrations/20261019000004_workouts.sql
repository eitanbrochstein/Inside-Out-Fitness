-- Workouts are pages of ordered blocks; exercise blocks hold ordered sets.
-- Each set keeps three groups of columns: PLAN (edit mode), FROZEN (load at completion), ACTUAL (train mode).

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'workout' check (kind in ('workout', 'template')),
  title text not null default '',
  subtitle text not null default '',
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  source_workout_id uuid references public.workouts on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_current on public.workouts (owner_id, kind, status, scheduled_for);
create index workouts_history on public.workouts (owner_id, completed_at desc);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts on delete cascade,
  owner_id uuid not null references auth.users on delete cascade, -- copied from the workout by trigger
  position int not null default 0,
  type text not null check (type in ('text', 'exercise')),
  title text not null default '', -- text block heading; a title with no body renders as a section label
  body text not null default '',
  exercise_id uuid references public.exercises on delete restrict,
  max_kind text not null default 'one_rm' check (max_kind in ('one_rm', 'training_max')),
  notes text not null default '',
  settings jsonb not null default '{}', -- reserved for future block types (timers, supersets)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'exercise' or exercise_id is not null)
);

create index workout_blocks_order on public.workout_blocks (workout_id, position);
create index workout_blocks_exercise on public.workout_blocks (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.workout_blocks on delete cascade,
  owner_id uuid not null references auth.users on delete cascade, -- copied from the block by trigger
  position int not null default 0,
  -- PLAN: a percent set has target_percent; otherwise target_weight_kg is the typed load (null = none/bodyweight)
  target_reps int check (target_reps >= 0),
  target_percent numeric check (target_percent > 0 and target_percent <= 150),
  target_weight_kg numeric check (target_weight_kg >= 0),
  -- FROZEN: written when a percent set is completed so later max changes don't rewrite history
  basis_max_kg numeric,
  prescribed_load_kg numeric,
  -- ACTUAL
  actual_reps int check (actual_reps >= 0),
  actual_weight_kg numeric check (actual_weight_kg >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sets_order on public.workout_sets (block_id, position);
create index workout_sets_completed on public.workout_sets (owner_id, completed_at);

create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();
create trigger workout_blocks_updated_at before update on public.workout_blocks
  for each row execute function public.set_updated_at();
create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- Child rows take their owner from the parent, so a client can never plant rows in someone else's
-- workout: an invisible parent yields a null owner and the insert fails.
create function public.inherit_block_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  select w.owner_id into new.owner_id from public.workouts w where w.id = new.workout_id;
  return new;
end $$;

create function public.inherit_set_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  select b.owner_id into new.owner_id from public.workout_blocks b where b.id = new.block_id;
  return new;
end $$;

create trigger workout_blocks_owner before insert or update of workout_id on public.workout_blocks
  for each row execute function public.inherit_block_owner();
create trigger workout_sets_owner before insert or update of block_id on public.workout_sets
  for each row execute function public.inherit_set_owner();

alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.workout_sets enable row level security;

create policy "workouts: owner all" on public.workouts
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "workout_blocks: owner all" on public.workout_blocks
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "workout_sets: owner all" on public.workout_sets
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.workouts, public.workout_blocks, public.workout_sets from anon;
grant select, insert, update, delete on public.workouts, public.workout_blocks, public.workout_sets to authenticated;
