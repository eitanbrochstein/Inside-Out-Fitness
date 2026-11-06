-- Profiles: per-user display preferences. One row per auth user, created by trigger.

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  unit text not null default 'lb' check (unit in ('lb', 'kg')),
  rounding_increment numeric not null default 5 check (rounding_increment > 0), -- in the profile unit
  rounding_mode text not null default 'nearest' check (rounding_mode in ('nearest', 'down')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;
