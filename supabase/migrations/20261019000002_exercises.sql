-- Exercise database: owner_id null = shared library, otherwise a user's custom exercise.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null default 'Other'
    check (category in ('Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Full body', 'Other')),
  equipment text not null default 'barbell'
    check (equipment in ('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'other')),
  load_basis text not null default 'total' check (load_basis in ('total', 'per_hand')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index exercises_owner_name_key on public.exercises (owner_id, lower(name)) nulls not distinct;

alter table public.exercises enable row level security;

create policy "exercises: read library and own" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises: owner inserts" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises: owner updates" on public.exercises
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "exercises: owner deletes" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.exercises from anon;
grant select, insert, update, delete on public.exercises to authenticated;
