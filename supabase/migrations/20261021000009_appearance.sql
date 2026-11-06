-- Named themes and accents (src/lib/theme.ts), plus a switch for the glass material. Ids are checked
-- by shape rather than listed, so a new theme needs no migration; the app treats an unknown id as
-- the default. 'light' and 'dark' become the matching named themes.
alter table public.profiles drop constraint profiles_theme_check;
update public.profiles set theme = case theme when 'dark' then 'midnight' when 'light' then 'daylight' else theme end;
alter table public.profiles
  alter column theme set default 'midnight',
  add constraint profiles_theme_check check (theme ~ '^[a-z][a-z0-9-]{1,23}$'),
  add column accent text not null default 'theme' check (accent ~ '^[a-z][a-z0-9-]{1,23}$'),
  add column glass boolean not null default true;
