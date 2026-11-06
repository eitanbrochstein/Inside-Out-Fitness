-- Append-only history of 1RMs / training maxes. "Current" = latest entry per exercise and kind.

create table public.training_maxes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  kind text not null default 'one_rm' check (kind in ('one_rm', 'training_max')),
  value_kg numeric not null check (value_kg > 0),
  recorded_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index training_maxes_lookup on public.training_maxes (owner_id, exercise_id, kind, recorded_on desc, created_at desc);

alter table public.training_maxes enable row level security;

create policy "training_maxes: owner all" on public.training_maxes
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.training_maxes from anon;
grant select, insert, update, delete on public.training_maxes to authenticated;

create view public.current_maxes with (security_invoker = true) as
select distinct on (owner_id, exercise_id, kind)
  id, owner_id, exercise_id, kind, value_kg, recorded_on
from public.training_maxes
order by owner_id, exercise_id, kind, recorded_on desc, created_at desc;

revoke all on public.current_maxes from anon;
grant select on public.current_maxes to authenticated;
